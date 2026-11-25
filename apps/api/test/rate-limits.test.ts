import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryRateLimitStore } from "../src/modules/rate-limits/memory";
import { PostgresRateLimitStore } from "../src/modules/rate-limits/postgres";
import { rateLimitKey, type RateLimitStore } from "../src/modules/rate-limits/store";
import { openTestDatabase, type TestDatabase } from "./database";

const key = (subject: string) => rateLimitKey("write.any", 0, "account", subject, "test-secret");
const rule = { limit: 10, periodSeconds: 60 };

describe.each(["memory", "postgres"] as const)("%s store", (backend) => {
  let store: RateLimitStore, db: TestDatabase | undefined;
  beforeAll(async () => {
    if (backend === "memory") store = new MemoryRateLimitStore();
    else {
      db = await openTestDatabase();
      store = new PostgresRateLimitStore(db.handle.db);
    }
  });
  afterAll(async () => {
    await store?.close();
    await db?.dispose();
  });

  it("charges cost atomically, peeks without spending, isolates keys and resets", async () => {
    const k = key("weighted");
    const small = { ...rule, burst: 4 };
    const full = { allowed: true, limit: 10, remaining: 4, resetSeconds: 0, retryAfterSeconds: 0 };
    expect(await store.peek(k, small)).toEqual(full);
    await expect(store.consume(k, small, 5)).rejects.toThrow(RangeError);
    expect(await store.consume(k, small, 3)).toEqual({ ...full, remaining: 1, resetSeconds: 18 });
    expect(await store.consume(k, small, 2)).toMatchObject({
      allowed: false,
      remaining: 1,
      retryAfterSeconds: 6,
    });
    expect(await store.peek(k, small)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await store.consume(k, small)).toMatchObject({ allowed: true, remaining: 0 });
    expect(await store.peek(k, small)).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 6 });
    expect(await store.peek(key("other"), small)).toEqual(full);
    await store.reset(k);
    await store.reset(k);
    expect(await store.peek(k, small)).toEqual(full);
  });

  it("refills on the store clock after exhausting a burst", async () => {
    const k = key("refill");
    const single = { limit: 1, periodSeconds: 1 };
    expect((await store.consume(k, single)).allowed).toBe(true);
    expect((await store.consume(k, single)).retryAfterSeconds).toBe(1);
    await expect
      .poll(() => store.peek(k, single), { timeout: 5000 })
      .toMatchObject({ allowed: true, remaining: 1, resetSeconds: 0 });
    expect((await store.consume(k, single)).remaining).toBe(0);
  });

  it("admits exactly ten of fifty concurrent requests for one key", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => store.consume(key("race"), { limit: 10, periodSeconds: 3600 })),
    );
    const admitted = results.filter((r) => r.allowed);
    expect(admitted.map((r) => r.remaining).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(results.filter((r) => !r.allowed)).toHaveLength(40);
  });
});

it("evicts the least recently charged memory key at capacity", async () => {
  const store = new MemoryRateLimitStore(2);
  try {
    for (const subject of ["a", "b", "a", "c"]) await store.consume(key(subject), rule);
    expect((await store.peek(key("a"), rule)).remaining).toBe(8);
    expect((await store.peek(key("b"), rule)).remaining).toBe(10);
  } finally {
    await store.close();
  }
});

it("uses keyed digests for private subjects and canonicalises email", () => {
  const email = (value: string, secret: string) =>
    rateLimitKey("auth.login.failures", 0, "email", value, secret);
  expect(email(" Example@Example.TEST ", "one")).toBe(email("example@example.test", "one"));
  expect(email("example@example.test", "one")).toMatch(/^rl:auth\.login\.failures:0:email:[a-f0-9]{64}$/);
  expect(email("example@example.test", "two")).not.toBe(email("example@example.test", "one"));
  expect(rateLimitKey("net.requests", 0, "network", "v4:192.0.2.1", "one")).toMatch(
    /^rl:net\.requests:0:network:[a-f0-9]{64}$/,
  );
});

it("sweeps expired memory keys while preserving live debt", async () => {
  vi.useFakeTimers();
  const store = new MemoryRateLimitStore(2);
  try {
    await store.consume(key("older-live"), { limit: 1, periodSeconds: 120 });
    await store.consume(key("expired"), { limit: 1, periodSeconds: 10 });
    vi.advanceTimersByTime(30_000);
    await store.consume(key("replacement"), rule);
    expect(await store.peek(key("older-live"), { limit: 1, periodSeconds: 120 })).toMatchObject({
      allowed: false,
      retryAfterSeconds: 90,
    });
  } finally {
    await store.close();
    vi.useRealTimers();
  }
});
