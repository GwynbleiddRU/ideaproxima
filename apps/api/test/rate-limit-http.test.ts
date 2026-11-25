import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { RateLimitOverrides } from "@ideaproxima/domain";
import { createApp, type App } from "../src/app";
import { loadConfig } from "../src/config";
import { PostgresRateLimitStore } from "../src/modules/rate-limits/postgres";
import { createHarness, type Harness } from "./harness";

let h: Harness;
const apps: App[] = [];
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  for (const app of apps) await app.closeRateLimits();
  await h.close();
});

function instance(overrides: RateLimitOverrides, env: NodeJS.ProcessEnv = {}) {
  const config = loadConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    RATE_LIMIT_OVERRIDES: JSON.stringify(overrides),
    ...env,
  });
  const app = createApp({ db: h.db, config });
  apps.push(app);
  return app;
}
const one = { limit: 1, periodSeconds: 60 };
const daily = { limit: 10, periodSeconds: 86400 };
const postgres = { RATE_LIMIT_STORE: "postgres", RATE_LIMIT_KEY_SECRET: "shared-test-key" };

async function denied(response: Response, policy: string, scope: string, limit: number) {
  expect(response.status).toBe(429);
  const seconds = Number(response.headers.get("retry-after"));
  expect(seconds).toBeGreaterThan(0);
  expect(response.headers.get("ratelimit-policy")).toContain(policy);
  expect(response.headers.get("ratelimit")).toContain(policy);
  expect(await response.json()).toMatchObject({
    error: {
      code: "rate_limited",
      details: {
        reason: "too_many_requests",
        policy,
        scope,
        limit,
        periodSeconds: 60,
        retryAfterSeconds: seconds,
      },
    },
  });
}

it("shares the search budget between instances and search routes while browsing stays cheap", async () => {
  const overrides = { "read.search": { anonymous: [one] } };
  const first = instance(overrides, postgres);
  const origin = "https://reader.example.test";
  const second = instance(overrides, { ...postgres, CORS_ORIGINS: origin });
  const search = await first.request("/v1/ideas?q=test");
  expect(search.status).toBe(200);
  expect(search.headers.get("ratelimit-policy")).toBe('"read.search";q=1;w=60');
  expect(search.headers.get("ratelimit")).toBe('"read.search";a=0;w=60');
  const limited = await second.request("/v1/search?q=test", { headers: { origin } });
  expect(limited.headers.get("access-control-expose-headers")?.split(",")).toEqual(
    expect.arrayContaining(["Retry-After", "RateLimit", "RateLimit-Policy"]),
  );
  await denied(limited, "read.search", "network", 1);
  for (const path of ["/v1/ideas", "/v1/ideas?q=%20", "/v1/topics"]) {
    const response = await second.request(path);
    expect(response.status).toBe(200);
    expect(response.headers.has("ratelimit")).toBe(false);
  }
  const signedIn = await h.user("search-member");
  expect(
    (await second.request("/v1/search?q=test", { headers: { authorization: "Bearer " + signedIn.token } }))
      .status,
  ).toBe(200);
});

it("charges deep graphs three units from the same heavy-read budget as feeds", async () => {
  const app = instance({ "read.heavy": { anonymous: [{ limit: 3, periodSeconds: 60 }] } });
  const graph = await app.request("/v1/ideas/no-such-idea/graph?depth=3");
  expect(graph.status).toBe(404);
  expect(graph.headers.get("ratelimit")).toBe('"read.heavy";a=0;w=60;c=3');
  await denied(await app.request("/v1/activity"), "read.heavy", "network", 3);
});

it("charges each kind of member write before business validation, and isolates accounts", async () => {
  const newAccount = { new: [one, daily] };
  const app = instance({
    "write.discussion": newAccount,
    "write.idea": newAccount,
    "write.knowledge": newAccount,
    "write.signal": newAccount,
  });
  const member = await h.user("write-member");
  const other = await h.user("write-other");
  for (const [policy, path] of [
    ["write.idea", "/ideas"],
    ["write.discussion", "/ideas/missing/comments"],
    ["write.knowledge", "/sources"],
    ["write.signal", "/evaluations"],
  ] as const) {
    const send = (token: string) =>
      app.request("/v1" + path, {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: "{}",
      });
    expect((await send(member.token)).status).toBe(400);
    await denied(await send(member.token), policy, "account", 1);
    expect((await send(other.token)).status).toBe(400);
  }
});

it("charges registration to the same network even when the next caller has a session", async () => {
  const app = instance({ "auth.register": { anonymous: [one, daily] } });
  const user = await h.user("register-member");
  const path = "/v1/auth/register";
  expect((await app.request(path, { method: "POST" })).status).toBe(400);
  await denied(
    await app.request(path, { method: "POST", headers: { authorization: "Bearer " + user.token } }),
    "auth.register",
    "network",
    1,
  );
});

it("clears email failure debt on success and keeps existing sessions usable during a throttle", async () => {
  const app = instance(
    { "auth.login.failures": { anonymous: [{ limit: 2, periodSeconds: 60 }] } },
    { ...postgres, TRUST_PROXY_HOPS: "1" },
  );
  const user = await h.user("failure-budget");
  const login = (password: string, network = "192.0.2.1") =>
    app.request("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": network },
      body: JSON.stringify({ email: "FAILURE-BUDGET@example.test", password }),
    });
  expect((await login("wrong")).status).toBe(401);
  expect((await login("correct horse battery")).status).toBe(200);
  expect((await login("wrong")).status).toBe(401);
  expect((await login("wrong")).status).toBe(401);
  await denied(await login("correct horse battery", "192.0.2.2"), "auth.login.failures", "email", 2);
  expect((await app.request("/v1/me", { headers: { authorization: "Bearer " + user.token } })).status).toBe(
    200,
  );
});

it("allows reads and writes when L2 is unavailable and closes credential operations", async () => {
  const app = instance({}, postgres);
  const user = await h.user("outage-member");
  const store = vi
    .spyOn(PostgresRateLimitStore.prototype, "consume")
    .mockRejectedValue(new Error("unavailable"));
  try {
    expect((await app.request("/v1/activity")).status).toBe(200);
    expect(
      (
        await app.request("/v1/me", {
          method: "PATCH",
          headers: { authorization: "Bearer " + user.token, "content-type": "application/json" },
          body: JSON.stringify({ bio: "testing recovery" }),
        })
      ).status,
    ).toBe(200);
    const login = await app.request("/v1/auth/login", { method: "POST" });
    expect(login.status).toBe(503);
    expect(await login.json()).toMatchObject({
      error: { code: "unavailable", details: { reason: "rate_limit_unavailable" } },
    });
    store.mockClear();
    const off = instance({ "net.requests": { anonymous: [one] } }, { ...postgres, RATE_LIMITS: "off" });
    for (let i = 0; i < 2; i++)
      expect((await off.request("/v1/auth/register", { method: "POST" })).status).toBe(400);
    expect(store).not.toHaveBeenCalled();
  } finally {
    store.mockRestore();
  }
});
