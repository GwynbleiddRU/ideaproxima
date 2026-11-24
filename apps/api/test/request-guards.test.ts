import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import * as crypto from "../src/modules/identity/crypto";
import * as identity from "../src/modules/identity/service";
import { passwordHashQueueDepth } from "../src/observability/metrics";
import { createHarness, type Harness } from "./harness";

vi.hoisted(() => {
  vi.stubEnv("PASSWORD_HASH_CONCURRENCY", "1");
  vi.stubEnv("PASSWORD_HASH_QUEUE", "1");
});

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await h.close();
});

it("limits the 601st API read before resolving its session, including the API index", async () => {
  const app = createApp({ db: h.db, config: loadConfig({ NODE_ENV: "test", TRUST_PROXY_HOPS: "1" }) });
  const headers = { "x-forwarded-for": "192.0.2.4" };
  const resolve = vi.spyOn(identity, "resolveSession");
  try {
    for (let i = 0; i < 600; i++) expect((await app.request("/v1", { headers })).status).toBe(200);
    const response = await app.request("/v1/me", {
      headers: { ...headers, authorization: `Bearer ${"x".repeat(43)}` },
    });
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(resolve).not.toHaveBeenCalled();
    expect((await app.request("/v1", { headers: { "x-forwarded-for": "192.0.2.5" } })).status).toBe(200);
  } finally {
    resolve.mockRestore();
  }
});

it("only looks up well-formed bearer and cookie tokens", async () => {
  const app = createApp({ db: h.db, config: loadConfig({ NODE_ENV: "test" }) });
  const resolve = vi.spyOn(identity, "resolveSession");
  try {
    for (const token of ["short", "x".repeat(44), "!".repeat(43)]) {
      expect((await app.request("/v1/me", { headers: { authorization: `Bearer ${token}` } })).status).toBe(
        401,
      );
      expect((await app.request("/v1/me", { headers: { cookie: `ip_session=${token}` } })).status).toBe(401);
    }
    expect(resolve).not.toHaveBeenCalled();
    const user = await h.user("cookie-member");
    expect((await app.request("/v1/me", { headers: { cookie: `ip_session=${user.token}` } })).status).toBe(
      200,
    );
    expect(resolve).toHaveBeenCalledTimes(1);
  } finally {
    resolve.mockRestore();
  }
});

const login = (email: string) =>
  h.call("POST", "/auth/login", { body: { email, password: "wrong password" } });

it("verifies exactly once for known, unknown and deactivated accounts", async () => {
  await h.user("login-member");
  const mod = await h.user("login-mod", "moderator");
  const verify = vi.spyOn(crypto, "verifyPassword");
  try {
    const known = "login-member@example.test";
    expect((await login(known)).status).toBe(401);
    expect(verify.mock.calls).toEqual([["wrong password", expect.stringMatching(/^scrypt\$/)]]);
    verify.mockClear();
    expect((await login("absent@example.test")).status).toBe(401);
    expect(verify.mock.calls).toEqual([["wrong password", undefined]]);
    const deactivation = await h.call("POST", "/people/login-member/deactivate", {
      token: mod.token,
      body: { reason: "Test deactivation" },
    });
    expect(deactivation.status).toBe(200);
    verify.mockClear();
    expect((await login(known)).status).toBe(401);
    expect(verify.mock.calls).toEqual([["wrong password", undefined]]);
  } finally {
    verify.mockRestore();
  }
});

it("admits one active and one waiting login, returns 503 on overflow and recovers", async () => {
  const queueDepth = vi.spyOn(passwordHashQueueDepth, "set");
  try {
    const email = "queue@example.test";
    const replies = await Promise.all([login(email), login(email), login(email)]);
    expect(replies.map((reply) => reply.status).sort()).toEqual([401, 401, 503]);
    const busy = replies.find((reply) => reply.status === 503)!;
    expect(busy.body.error.code).toBe("unavailable");
    expect(busy.headers.get("Retry-After")).toBe("1");
    expect(queueDepth.mock.calls).toEqual([[1], [0]]);
    expect((await login(email)).status).toBe(401);
  } finally {
    queueDepth.mockRestore();
  }
});
