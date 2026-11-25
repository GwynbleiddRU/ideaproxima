import { describe, expect, it } from "vitest";
import { gcra, graphTraversalCost, resolveRateLimitPolicy, trustTier } from "../src";

describe("GCRA in microseconds", () => {
  const rule = { limit: 10, periodSeconds: 60 };
  const second = 1_000_000;
  it("admits the initial burst, then exactly one unit every six seconds", () => {
    let tat = 0;
    for (let i = 1; i <= 10; i++) {
      const result = gcra(rule, tat, 0);
      expect(result.decision).toEqual({
        allowed: true,
        limit: 10,
        remaining: 10 - i,
        retryAfterSeconds: 0,
        resetSeconds: 6 * i,
      });
      tat = result.tatUs!;
    }
    for (const time of [0, 6, 12]) {
      const now = time * second;
      expect(gcra(rule, tat, now)).toEqual({
        tatUs: tat,
        decision: { allowed: false, limit: 10, remaining: 0, retryAfterSeconds: 6, resetSeconds: 60 },
      });
      expect(gcra(rule, tat, now + 6 * second - 1).decision.retryAfterSeconds).toBe(1);
      const next = gcra(rule, tat, now + 6 * second);
      expect(next.decision).toMatchObject({ allowed: true, remaining: 0 });
      tat = next.tatUs!;
    }
  });
  it("preserves existing debt on denial, peek and clock rollback, and discards expired debt", () => {
    const small = { ...rule, burst: 4 };
    const { tatUs } = gcra(small, null, second, 3);
    expect(tatUs).toBe(19 * second);
    expect(gcra(small, tatUs, second, 2)).toMatchObject({
      tatUs,
      decision: { allowed: false, remaining: 1, retryAfterSeconds: 6 },
    });
    expect(gcra(small, tatUs, 0)).toMatchObject({
      tatUs,
      decision: { allowed: false, retryAfterSeconds: 1 },
    });
    expect(gcra(small, tatUs, 20 * second, 1, "peek")).toMatchObject({
      tatUs,
      decision: { remaining: 4, resetSeconds: 0 },
    });
  });
});

it("derives all trust tiers with restriction, staff and verification precedence", () => {
  const now = new Date("2026-11-25T00:00:00Z");
  const boundary = now.getTime() - 72 * 3_600_000;
  const member = {
    role: "member" as const,
    createdAt: new Date(boundary),
    restrictedUntil: null,
    establishedAt: null,
    emailVerifiedAt: null,
  };
  expect(trustTier(null, now, false)).toBe("anonymous");
  expect(trustTier(member, now, false)).toBe("member");
  expect(trustTier({ ...member, createdAt: new Date(boundary + 1) }, now, false)).toBe("new");
  expect(trustTier({ ...member, establishedAt: now }, now, true)).toBe("new");
  expect(trustTier({ ...member, establishedAt: now, emailVerifiedAt: now }, now, true)).toBe("established");
  for (const role of ["admin", "moderator"] as const) {
    expect(trustTier({ ...member, role, restrictedUntil: now }, now, true)).toBe("staff");
    expect(trustTier({ ...member, role, restrictedUntil: new Date(+now + 1) }, now, true)).toBe("restricted");
  }
});

it("resolves scopes, multi-period budgets, overrides and derived tiers without changing defaults", () => {
  expect(resolveRateLimitPolicy("auth.recovery", "staff", {}, 4)).toEqual([
    { scope: "email", limit: 3, periodSeconds: 3600 },
    { scope: "network", limit: 10, periodSeconds: 3600 },
  ]);
  expect(resolveRateLimitPolicy("auth.register", "staff")).toEqual(
    resolveRateLimitPolicy("auth.register", "anonymous"),
  );
  expect(resolveRateLimitPolicy("write.any", "anonymous")).toEqual([]);
  expect(resolveRateLimitPolicy("read.heavy", "anonymous")[0]?.scope).toBe("network");
  expect(resolveRateLimitPolicy("read.heavy", "staff")[0]).toMatchObject({ scope: "account", limit: 960 });
  expect(resolveRateLimitPolicy("moderation.report", "staff")[1]?.limit).toBe(100);
  const overrides = {
    "write.idea": {
      new: [
        { limit: 10, periodSeconds: 3600, burst: 4 },
        { limit: 30, periodSeconds: 86400 },
      ],
    },
  };
  expect(resolveRateLimitPolicy("write.idea", "restricted", overrides, 3)).toEqual([
    { scope: "account", limit: 15, burst: 6, periodSeconds: 3600 },
    { scope: "account", limit: 45, periodSeconds: 86400 },
  ]);
  expect(resolveRateLimitPolicy("write.idea", "restricted").map((r) => r.limit)).toEqual([1, 1]);
  expect(graphTraversalCost(2)).toBe(1);
  expect(graphTraversalCost(3)).toBe(3);
  expect(() => resolveRateLimitPolicy("read.heavy", "restricted", {}, 0.01)).toThrow(RangeError);
  expect(() => resolveRateLimitPolicy("auth.login", "member", { "auth.login": { member: [] } })).toThrow(
    RangeError,
  );
});
