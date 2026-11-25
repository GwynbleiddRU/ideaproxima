import type { PersonRole } from "../vocabulary/people";

export type TrustTier = "anonymous" | "restricted" | "new" | "member" | "established" | "staff";

interface TrustAccount {
  role: PersonRole;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  restrictedUntil: Date | null;
  establishedAt: Date | null;
}

/** Tiers gate limits and pre-moderation only. Contribution quality alone can earn influence. */
export function trustTier(account: TrustAccount | null, now: Date, requireVerifiedEmail: boolean): TrustTier {
  if (!account) return "anonymous";
  if (account.restrictedUntil && account.restrictedUntil > now) return "restricted";
  if (account.role === "admin" || account.role === "moderator") return "staff";
  if (
    now.getTime() - account.createdAt.getTime() < 72 * 3_600_000 ||
    (requireVerifiedEmail && !account.emailVerifiedAt)
  )
    return "new";
  return account.establishedAt && account.establishedAt <= now ? "established" : "member";
}

export interface RateLimitRule {
  limit: number;
  periodSeconds: number;
  burst?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

/** Both engines use whole microseconds, the resolution of a PostgreSQL timestamp. */
export function gcraTiming(rule: RateLimitRule, cost: number) {
  const burst = rule.burst ?? rule.limit;
  if (
    ![rule.limit, rule.periodSeconds, burst, cost].every((n) => Number.isSafeInteger(n) && n > 0) ||
    cost > burst
  )
    throw new RangeError("Expected positive integer rate, period, burst and cost, with cost within burst");
  const intervalUs = Math.ceil((rule.periodSeconds * 1_000_000) / rule.limit);
  const capacityUs = burst * intervalUs;
  if (!Number.isSafeInteger(capacityUs)) throw new RangeError("Rate-limit burst exceeds timestamp precision");
  return { intervalUs, capacityUs, chargeUs: cost * intervalUs };
}

/** Describe the debt left by a decision, including units still available after a multi-unit denial. */
export function describeRateLimit(
  limit: number,
  timing: ReturnType<typeof gcraTiming>,
  debtUs: number,
  retryUs: number,
): RateLimitDecision {
  const resetUs = Math.max(0, debtUs);
  return {
    allowed: retryUs === 0,
    limit,
    remaining: Math.max(0, Math.floor((timing.capacityUs - resetUs) / timing.intervalUs)),
    resetSeconds: Math.ceil(resetUs / 1_000_000),
    retryAfterSeconds: Math.ceil(retryUs / 1_000_000),
  };
}

/** Inspect the budget at nowUs. A successful consume advances TAT, while a peek or denial preserves it. */
export function gcra(
  rule: RateLimitRule,
  storedTatUs: number | null,
  nowUs: number,
  cost = 1,
  mode: "consume" | "peek" = "consume",
) {
  const timing = gcraTiming(rule, cost);
  const debtUs = Math.max(0, (storedTatUs ?? nowUs) - nowUs);
  const retryUs = Math.max(0, debtUs + timing.chargeUs - timing.capacityUs);
  const spend = retryUs === 0 && mode === "consume";
  const resetUs = spend ? debtUs + timing.chargeUs : debtUs;
  const decision = describeRateLimit(rule.limit, timing, resetUs, retryUs);
  return { tatUs: spend ? nowUs + resetUs : storedTatUs, decision };
}

export type RateLimitScope = "account" | "email" | "network";
interface ScopedRule extends RateLimitRule {
  scope: RateLimitScope;
}
type CatalogueTier = "anonymous" | "new" | "member" | "established";
type TierRules = Record<CatalogueTier, readonly ScopedRule[]>;

const minute = 60,
  hour = 3600,
  day = 86400;
const rule = (scope: RateLimitScope, limit: number, periodSeconds: number): ScopedRule => ({
  scope,
  limit,
  periodSeconds,
});
const network = (limit: number, period: number) => rule("network", limit, period);
const account = (limit: number, period: number) => rule("account", limit, period);
const everyone = (...rules: ScopedRule[]): TierRules => ({
  anonymous: rules,
  new: rules,
  member: rules,
  established: rules,
});
type WriteQuotas = readonly [fresh: number, member: number, established: number];
function writes(period: number, quotas: WriteQuotas, daily?: WriteQuotas): TierRules {
  const tier = (i: 0 | 1 | 2) =>
    daily ? [account(quotas[i], period), account(daily[i], day)] : [account(quotas[i], period)];
  return { anonymous: [], new: tier(0), member: tier(1), established: tier(2) };
}
function reads(anon: number, fresh: number, member: number, established: number): TierRules {
  return {
    anonymous: [network(anon, minute)],
    new: [account(fresh, minute)],
    member: [account(member, minute)],
    established: [account(established, minute)],
  };
}

export const RATE_LIMIT_POLICIES = {
  "net.requests": everyone(network(600, minute)),
  "auth.login": everyone(network(10, minute), network(60, hour)),
  "auth.login.failures": everyone(rule("email", 10, 15 * minute)),
  "auth.register": { anonymous: [network(3, hour), network(10, day)], new: [], member: [], established: [] },
  "auth.recovery": everyone(rule("email", 3, hour), network(10, hour)),
  "write.any": writes(minute, [30, 120, 240]),
  "write.signal": writes(minute, [20, 60, 120], [200, 2000, 5000]),
  "write.discussion": writes(minute, [5, 20, 40], [30, 300, 1000]),
  "write.knowledge": writes(minute, [5, 20, 40], [30, 200, 600]),
  "write.idea": writes(hour, [2, 10, 30], [3, 30, 100]),
  "moderation.report": writes(hour, [5, 20, 40], [10, 50, 100]),
  "read.search": reads(20, 30, 60, 120),
  "read.heavy": reads(30, 60, 120, 240),
} satisfies Record<string, TierRules>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
export type RateLimitOverrides = Partial<
  Record<RateLimitPolicyName, Partial<Record<CatalogueTier, readonly RateLimitRule[]>>>
>;
const deepGraphCost = 3;
export const graphTraversalCost = (depth: number) => (depth > 2 ? deepGraphCost : 1);

/** Overrides replace each base tier's rules in catalogue order, preserving scopes. Then apply tier and scale. */
export function resolveRateLimitPolicy(
  name: RateLimitPolicyName,
  tier: TrustTier,
  overrides: RateLimitOverrides = {},
  scale = 1,
): ScopedRule[] {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Rate-limit scale must be positive");
  // Public registration accepts requests carrying a session too. Always charge its anonymous network budget.
  if (name === "auth.register") tier = "anonymous";
  const base = tier === "restricted" ? "new" : tier === "staff" ? "established" : tier;
  const rules = RATE_LIMIT_POLICIES[name][base];
  const replacements = overrides[name]?.[base];
  if (replacements && replacements.length !== rules.length)
    throw new RangeError("Override must preserve the policy's rule count");
  const scalable = name.startsWith("write.") || name.startsWith("read.");
  const multiplier =
    (scalable ? scale : 1) * (tier === "restricted" ? 0.5 : tier === "staff" && scalable ? 4 : 1);
  return rules.map((entry, index) => {
    const original = replacements?.[index] ?? entry;
    gcraTiming(original, 1);
    const scaled = (n: number) => Math.max(1, Math.floor(n * multiplier));
    const resolved = {
      scope: entry.scope,
      limit: scaled(original.limit),
      periodSeconds: original.periodSeconds,
      ...(original.burst === undefined ? {} : { burst: scaled(original.burst) }),
    };
    gcraTiming(resolved, name === "read.heavy" ? deepGraphCost : 1);
    return resolved;
  });
}
