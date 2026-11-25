import { once } from "node:events";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { startMetricsServer } from "../src/observability/internal-server";
import { createLogger } from "../src/observability/logger";
import { dbErrors, httpInFlight } from "../src/observability/metrics";
import { createHarness, type Harness } from "./harness";

const UUID_V7 = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

let h: Harness;
let webRoot: string;
beforeAll(async () => {
  h = await createHarness();
  webRoot = mkdtempSync(join(tmpdir(), "ipx-observability-"));
  mkdirSync(join(webRoot, "assets"));
  writeFileSync(join(webRoot, "index.html"), "<h1>Fixture</h1>");
  writeFileSync(join(webRoot, "assets/site.js"), "test");
});
afterAll(async () => {
  rmSync(webRoot, { recursive: true, force: true });
  await h.close();
});

function loggedApp(env: NodeJS.ProcessEnv = {}) {
  const config = loadConfig({ NODE_ENV: "test", LOG_REQUESTS: "true", LOG_FORMAT: "json", ...env });
  const logs: string[] = [];
  const logger = createLogger(config.log, { write: (line) => logs.push(line) });
  return { app: createApp({ db: h.db, config, logger, webRoot }), logs };
}

it("echoes valid IDs and generates UUIDv7s for absent or invalid IDs", async () => {
  const { app } = loggedApp();
  for (const value of ["Ab12_3-4", "a".repeat(64)]) {
    const response = await app.request("/v1", { headers: { "X-Request-Id": value } });
    expect(response.headers.get("X-Request-Id")).toBe(value);
  }
  for (const value of ["", "short", "a".repeat(65), "abc=defg", "two, ids", "a@example.test"]) {
    const response = await app.request("/missing", { headers: { "X-Request-Id": value } });
    const requestId = response.headers.get("X-Request-Id");
    expect(requestId).toMatch(UUID_V7);
    expect(await response.json()).toMatchObject({ error: { code: "not_found", requestId } });
  }
  const response = await app.request("/v1");
  expect(response.headers.get("X-Request-Id")).toMatch(UUID_V7);
});

it("correlates one 500 with redacted logs for IPv4 and IPv6, and uses route patterns", async () => {
  const { app, logs } = loggedApp({ TRUST_PROXY_HOPS: "1" });
  const person = await h.user("observability-member");
  app.post("/v1/log-fixture/:person", async (c) => {
    throw Object.assign(new Error(`SQL with bound parameters: ${await c.req.text()}`), {
      cause: { code: "XX000", detail: "driver-secret" },
    });
  });

  for (const [ip, requestId] of [
    ["192.0.2.42", "correlate-v4"],
    ["2001:db8:ab12::42", "correlate-v6"],
  ]) {
    const response = await app.request("/v1/log-fixture/private-handle?q=private-search", {
      method: "POST",
      headers: {
        "X-Request-Id": requestId!,
        "X-Forwarded-For": ip!,
        authorization: `Bearer ${person.token}`,
        cookie: "ip_session=private-cookie",
      },
      body: "private-email@example.test private-password",
    });
    expect(response.status).toBe(500);
    expect(response.headers.get("X-Request-Id")).toBe(requestId);
    expect(await response.json()).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong.",
        requestId,
        details: { reason: "internal_failure" },
      },
    });
    const lines = logs.splice(0);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: 50, requestId, pgCode: "XX000" });
    expect(JSON.parse(lines[1]!)).toMatchObject({
      level: 30,
      requestId,
      method: "POST",
      route: "/v1/log-fixture/:person",
      status: 500,
      durationMs: expect.any(Number),
      actorId: person.id,
      bytesOut: null,
    });
    expect(lines.join("")).not.toMatch(
      /192\.0\.2\.42|2001:db8:ab12|private-|driver-secret|bound parameters|authorization|cookie/,
    );
    expect(lines.join("")).not.toContain(person.token);
  }
  expect((await dbErrors.get()).values).toContainEqual({ labels: { code: "XX" }, value: 2 });
});

it("includes IDs on early exits and uses documented codes for Hono exceptions", async () => {
  const { app } = loggedApp({
    CORS_ORIGINS: "https://frontend.example.test",
    MAX_BODY_BYTES: "32",
    RATE_LIMIT_REQUESTS_PER_MINUTE: "1",
  });
  app.get("/exception/:status", (c) => {
    throw new HTTPException(c.req.param("status") === "404" ? 404 : 405);
  });
  const headers = { "X-Request-Id": "early-exit-id" };
  const preflight = await app.request("/v1", {
    method: "OPTIONS",
    headers: { ...headers, origin: "https://frontend.example.test", "Access-Control-Request-Method": "POST" },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("X-Request-Id")).toBe("early-exit-id");

  const oversized = await app.request("/v1/auth/login", {
    method: "POST",
    body: "x".repeat(33),
    headers: { ...headers, origin: "https://frontend.example.test" },
  });
  expect(oversized.status).toBe(413);
  expect(oversized.headers.get("Access-Control-Expose-Headers")).toBe("X-Request-Id");
  expect(await oversized.json()).toMatchObject({
    error: { code: "payload_too_large", requestId: "early-exit-id" },
  });

  for (const [status, code] of [
    [404, "not_found"],
    [405, "validation_failed"],
  ] as const) {
    const response = await app.request(`/exception/${status}`, { headers });
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code, requestId: "early-exit-id" } });
  }

  expect((await app.request("/v1")).status).toBe(200);
  const limited = await app.request("/v1", { headers });
  expect(limited.status).toBe(429);
  expect(await limited.json()).toMatchObject({ error: { code: "rate_limited", requestId: "early-exit-id" } });
});

it("logs static assets at debug with byte counts and honours HEAD", async () => {
  const { app, logs } = loggedApp({ LOG_LEVEL: "debug" });
  const get = await app.request("/assets/site.js");
  expect(get.headers.get("X-Request-Id")).toMatch(UUID_V7);
  await app.request("/assets/site.js", { method: "HEAD" });
  expect(logs.map((line) => JSON.parse(line))).toMatchObject([
    { level: 20, method: "GET", route: "unmatched", bytesOut: 4 },
    { level: 20, method: "HEAD", route: "unmatched", bytesOut: 0 },
  ]);
});

it("serves metrics only on the internal listener and bounds public labels", async () => {
  const { app } = loggedApp({ RATE_LIMIT_REQUESTS_PER_MINUTE: "1" });
  const publicServer = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  const privateServer = startMetricsServer(0, h.db);
  try {
    await Promise.all([once(publicServer, "listening"), once(privateServer, "listening")]);
    function url(server: typeof publicServer) {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
      return `http://127.0.0.1:${address.port}`;
    }
    const publicOrigin = url(publicServer);
    const privateOrigin = url(privateServer);
    const publicMetrics = await fetch(`${publicOrigin}/metrics`, { headers: { accept: "text/html" } });
    expect(publicMetrics.status).toBe(404);
    expect(await publicMetrics.json()).toMatchObject({ error: { code: "not_found" } });
    expect((await fetch(`${publicOrigin}/v1/people/private-metric-handle`)).status).toBe(404);
    expect((await fetch(`${publicOrigin}/v1/search?q=private-metric-query`)).status).toBe(429);
    expect((await fetch(`${privateOrigin}/v1`)).status).toBe(404);
    const response = await fetch(`${privateOrigin}/metrics`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/plain/);
    const metrics = await response.text();
    expect(metrics).toContain('http_requests_total{method="GET",route="/v1/people/:handle",status="404"} 1');
    expect(metrics).toContain('method="GET",route="/v1/search",status_class="4xx"');
    expect(metrics).toContain('http_requests_total{method="GET",route="unmatched",status="404"}');
    expect(metrics).toContain('rate_limit_decisions_total{policy="requests",outcome="denied"}');
    expect(metrics).toContain("http_requests_in_flight 0");
    expect(metrics).toContain("password_hash_queue_depth 0");
    expect(metrics).toContain("nodejs_eventloop_lag_seconds");
    expect(metrics).not.toMatch(/private-metric-|\/metrics"/);
  } finally {
    await Promise.all(
      [publicServer, privateServer].map(
        (server) => new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  }
});

it("counts a pending request until its handler completes", async () => {
  const { app } = loggedApp();
  let announceStarted!: () => void;
  let finish!: () => void;
  const started = new Promise<void>((resolve) => (announceStarted = resolve));
  const canFinish = new Promise<void>((resolve) => (finish = resolve));
  app.get("/slow-fixture", async (c) => {
    announceStarted();
    await canFinish;
    return c.text("done");
  });
  const pending = app.request("/slow-fixture");
  await started;
  try {
    expect((await httpInFlight.get()).values[0]?.value).toBe(1);
  } finally {
    finish();
    await pending;
  }
  expect((await httpInFlight.get()).values[0]?.value).toBe(0);
});
