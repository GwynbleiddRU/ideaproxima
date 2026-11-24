import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompress, brotliCompressSync, constants as zlib, gzip, gzipSync } from "node:zlib";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./env";

/**
 * Serves the built web app (apps/web/dist) from the API process. One origin serves both the interface and
 * `/v1`, so there is no CORS and the session cookie stays first-party.
 *
 * - The build output is immutable, so every file is read once at startup and served from memory. Nothing
 *   touches the filesystem per request, which also rules out path traversal.
 * - Compressible files are brotli- and gzip-encoded at maximum quality in the background at startup (on the
 *   libuv thread pool, never blocking requests). A request arriving before that finishes gets a fast,
 *   lower-quality encoding instead, which the background pass then replaces.
 * - Content-hashed files under /assets/ are cached for a year; everything else revalidates with an ETag.
 * - Any other GET that accepts HTML, outside /v1, receives index.html: those are client-side routes.
 * - HTML responses carry a Content-Security-Policy; index.html's inline scripts are allowed by hash.
 */

interface StaticFile {
  body: Buffer;
  type: string;
  etag: string;
  cacheControl: string;
  compressible: boolean;
  encoded: Partial<Record<"br" | "gzip", Buffer>>;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;
const MIN_COMPRESS_BYTES = 1024;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function loadFiles(root: string): Map<string, StaticFile> {
  const files = new Map<string, StaticFile>();
  for (const path of walk(root)) {
    const urlPath = "/" + relative(root, path).split(sep).join("/");
    const body = readFileSync(path);
    const type = TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
    files.set(urlPath, {
      body,
      type,
      etag: `"${createHash("sha1").update(body).digest("base64url")}"`,
      cacheControl: urlPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      compressible: COMPRESSIBLE.test(type) && body.length >= MIN_COMPRESS_BYTES,
      encoded: {},
    });
  }
  return files;
}

/** CSP for the app shell. Inline `<script>` blocks of index.html (the theme bootstrap) are allowed by hash. */
export function contentSecurityPolicy(indexHtml: string): string {
  const hashes = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => `'sha256-${createHash("sha256").update(m[1]!).digest("base64")}'`,
  );
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    // React writes computed widths and colours into style attributes (meters, charts).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function pickEncoding(acceptEncoding: string | undefined): "br" | "gzip" | null {
  const accepted = (acceptEncoding ?? "").toLowerCase();
  if (/\bbr\b/.test(accepted)) return "br";
  if (/\bgzip\b/.test(accepted)) return "gzip";
  return null;
}

function encodedBody(file: StaticFile, encoding: "br" | "gzip"): Buffer {
  return (file.encoded[encoding] ??=
    encoding === "br"
      ? brotliCompressSync(file.body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 4 } })
      : gzipSync(file.body, { level: 6 }));
}

/** Best-quality encodings of every compressible file, computed off the event loop. Source maps are skipped. */
function precompress(files: Map<string, StaticFile>) {
  for (const [path, file] of files) {
    if (!file.compressible || path.endsWith(".map")) continue;
    brotliCompress(
      file.body,
      { params: { [zlib.BROTLI_PARAM_QUALITY]: 11, [zlib.BROTLI_PARAM_SIZE_HINT]: file.body.length } },
      (error, out) => {
        if (!error) file.encoded.br = out;
      },
    );
    gzip(file.body, { level: 9 }, (error, out) => {
      if (!error) file.encoded.gzip = out;
    });
  }
}

/**
 * Middleware serving the web app from `root`. Mount it before session resolution: static requests need no
 * database work. Requests it does not answer (other methods, `/v1`, unknown non-HTML paths) fall through.
 */
export function webApp(root: string): MiddlewareHandler<AppEnv> {
  const files = loadFiles(root);
  const index = files.get("/index.html");
  if (!index) throw new Error(`${root} contains no index.html. Build the web app first (npm run build).`);
  const csp = contentSecurityPolicy(index.body.toString("utf8"));
  precompress(files);

  return async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    if ((method !== "GET" && method !== "HEAD") || path === "/v1" || path.startsWith("/v1/")) return next();

    let file = files.get(path);
    if (!file) {
      // Client-side routes are documents; a missing image, script or font stays a 404.
      if (!(c.req.header("accept") ?? "").includes("text/html")) return next();
      file = index;
    }

    c.set("webRoute", file === index ? "web" : "static");
    const headers: Record<string, string> = {
      "content-type": file.type,
      "cache-control": file.cacheControl,
      etag: file.etag,
    };
    if (file === index) headers["content-security-policy"] = csp;
    if (c.req.header("if-none-match") === file.etag) return c.body(null, 304, headers);

    let body = file.body;
    if (file.compressible) {
      headers.vary = "accept-encoding";
      const encoding = pickEncoding(c.req.header("accept-encoding"));
      if (encoding) {
        body = encodedBody(file, encoding);
        headers["content-encoding"] = encoding;
      }
    }
    headers["content-length"] = String(body.length);
    if (method === "HEAD") return c.body(null, 200, headers);
    return c.body(new Uint8Array(body), 200, headers);
  };
}

/**
 * Where the built web app is: `WEB_ROOT` when set ("off" disables serving it), otherwise `fallback` (the
 * repository's apps/web/dist, passed in by the entry point) if it has been built.
 */
export function resolveWebRoot(configured: string | undefined, fallback: URL): string | null {
  if (configured === "off") return null;
  if (configured) return resolve(configured);
  const path = fileURLToPath(fallback);
  return existsSync(join(path, "index.html")) ? path : null;
}
