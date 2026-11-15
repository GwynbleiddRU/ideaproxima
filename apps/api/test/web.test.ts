import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { contentSecurityPolicy } from "../src/http/web";
import { createHarness, type Harness } from "./harness";

const INDEX = `<!doctype html><html><head><script>document.documentElement.dataset.theme="dark"</script></head><body><div id="root"></div></body></html>`;
const SCRIPT = `console.log(${JSON.stringify("x".repeat(4000))});`;

let h: Harness;
let root: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  h = await createHarness();
  root = mkdtempSync(join(tmpdir(), "ipx-web-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), INDEX);
  writeFileSync(join(root, "favicon.svg"), "<svg/>");
  writeFileSync(join(root, "assets", "app-abc123.js"), SCRIPT);
  app = createApp({ db: h.db, config: loadConfig({ NODE_ENV: "test" }), webRoot: root });
});
afterAll(async () => {
  rmSync(root, { recursive: true, force: true });
  await h.close();
});

const html = { accept: "text/html,application/xhtml+xml" };

describe("the web app served by the API process", () => {
  it("serves the app shell at / with a CSP that allows its inline script by hash", async () => {
    const res = await app.request("/", { headers: html });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toBe(contentSecurityPolicy(INDEX));
    expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
    expect(await res.text()).toBe(INDEX);
  });

  it("answers client-side routes with the shell, but lets missing files and the API fall through", async () => {
    expect(await (await app.request("/ideas/some-idea/evidence", { headers: html })).text()).toBe(INDEX);
    expect((await app.request("/assets/missing.js")).status).toBe(404);
    const api = await app.request("/v1", { headers: html });
    expect(api.headers.get("content-type")).toContain("application/json");
    expect(((await api.json()) as { apiVersion: string }).apiVersion).toBe("v1");
    expect((await app.request("/", { method: "POST", headers: html })).status).toBe(404);
  });

  it("caches hashed assets for a year and compresses them", async () => {
    const res = await app.request("/assets/app-abc123.js", { headers: { "accept-encoding": "gzip, br" } });
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("content-type")).toContain("text/javascript");
    expect(res.headers.get("content-encoding")).toBe("br");
    expect(res.headers.get("vary")).toBe("accept-encoding");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBeLessThan(SCRIPT.length / 4);
    expect(brotliDecompressSync(body).toString()).toBe(SCRIPT);
  });

  it("revalidates with ETags and leaves small files uncompressed", async () => {
    const first = await app.request("/favicon.svg", { headers: { "accept-encoding": "br" } });
    expect(first.headers.get("content-encoding")).toBeNull();
    const etag = first.headers.get("etag")!;
    const again = await app.request("/favicon.svg", { headers: { "if-none-match": etag } });
    expect(again.status).toBe(304);
  });
});
