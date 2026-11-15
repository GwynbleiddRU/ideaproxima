import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENDPOINTS, buildOpenApiDocument, type EndpointSpec } from "@ideaproxima/contracts";
import { API_DOCS_PATHS, renderApiDocs } from "../../../scripts/docs/api-reference";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { assertContract, createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

/** The app itself, for requests outside /v1 (the harness's `call` is scoped to /v1 and checks contracts). */
const bareApp = () => createApp({ db: h.db, config: loadConfig({ NODE_ENV: "test" }) });

describe("the endpoint catalogue is the API", () => {
  it("lists exactly the routes the server exposes", () => {
    const app = createApp({ db: h.db, config: loadConfig({}) });
    const served = new Set(
      app.routes
        .filter((r) => r.method !== "ALL" && (r.path === "/v1" || r.path.startsWith("/v1/")))
        .map((r) => `${r.method} ${r.path}`),
    );
    const catalogued = new Set(
      Object.values(ENDPOINTS as Record<string, EndpointSpec>).map((e) => `${e.method} ${e.path}`),
    );
    expect([...served].filter((r) => !catalogued.has(r))).toEqual([]);
    expect([...catalogued].filter((r) => !served.has(r))).toEqual([]);
  });

  it("produces an OpenAPI document whose every reference resolves", async () => {
    const doc = buildOpenApiDocument() as {
      paths: Record<string, Record<string, unknown>>;
      components: { schemas: Record<string, unknown> };
    };
    const operations = Object.values(doc.paths).flatMap((p) => Object.keys(p));
    expect(operations).toHaveLength(Object.keys(ENDPOINTS).length);
    const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(refs.length).toBeGreaterThan(50);
    expect(refs.filter((r) => !(r in doc.components.schemas))).toEqual([]);
    const served = await h.call("GET", "/openapi.json");
    expect(served.body).toEqual(JSON.parse(JSON.stringify(doc)));
  });

  it("has an up-to-date generated reference in docs/developer (run `npm run docs:api` if this fails)", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
    const { openapi, markdown } = renderApiDocs();
    expect(read(API_DOCS_PATHS.openapi) === openapi, `${API_DOCS_PATHS.openapi} is stale`).toBe(true);
    expect(read(API_DOCS_PATHS.markdown) === markdown, `${API_DOCS_PATHS.markdown} is stale`).toBe(true);
  });

  it("serves a database-backed health check", async () => {
    expect((await h.call("GET", "/health")).body).toEqual({ ok: true, database: "up" });
  });

  it("serves an index at /v1 whose links resolve, and sends the bare root there", async () => {
    const index = await h.call("GET", "");
    expect(index.status).toBe(200);
    for (const link of Object.values(index.body.links as Record<string, string>)) {
      const path = link.replace("{query}", "energy").replace(/^\/v1/, "");
      expect((await h.call("GET", path)).status, link).toBe(200);
    }
    const root = await bareApp().request("/");
    expect(root.status).toBe(302);
    expect(root.headers.get("location")).toBe("/v1");
  });

  it("answers unknown paths with a 404 that points to the index", async () => {
    const res = await bareApp().request("/nothing-here");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { message: string } }).error.message).toMatch(/GET \/v1/);
  });
});

describe("the contract check itself", () => {
  const person = { id: "0190f5c2-1234-7abc-8def-0123456789ab", handle: "x", displayName: "X" };
  const okBody = { stances: ["important"] };
  const path = `/v1/ideas/${person.id}/stances/important`;

  it("accepts a conforming response", () => {
    expect(() => assertContract("PUT", path, 200, okBody)).not.toThrow();
  });

  it("rejects undocumented fields, wrong shapes, undocumented statuses and uncatalogued routes", () => {
    expect(() => assertContract("PUT", path, 200, { ...okBody, secret: 1 })).toThrow(/not in its contract/);
    expect(() => assertContract("PUT", path, 200, { stances: ["nonsense"] })).toThrow(/does not match/);
    expect(() => assertContract("PUT", path, 201, okBody)).toThrow(/not documented/);
    expect(() => assertContract("GET", "/v1/not-catalogued", 200, {})).toThrow(
      /not in the endpoint catalogue/,
    );
    expect(() => assertContract("GET", "/v1/ideas", 404, { oops: true })).toThrow(/error envelope/);
  });
});
