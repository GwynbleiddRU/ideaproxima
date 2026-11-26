import type { Context, MiddlewareHandler } from "hono";
import { matchedRoutes } from "hono/route";
import type { Logger } from "pino";
import { ENDPOINTS, type EndpointSpec } from "@ideaproxima/contracts";
import {
  DomainError,
  graphTraversalCost,
  type RateLimitDecision,
  type RateLimitPolicyName,
  type RateLimitRule,
  type RateLimitScope,
} from "@ideaproxima/domain";
import type { AppConfig } from "../config";
import type { Database } from "../db/client";
import { MemoryRateLimitStore } from "../modules/rate-limits/memory";
import { PostgresRateLimitStore } from "../modules/rate-limits/postgres";
import { rateLimitKey, type RateLimitStore } from "../modules/rate-limits/store";
import { rateLimitDecisions } from "../observability/metrics";
import { clientAddress } from "./client-address";
import type { AppEnv } from "./env";

const endpoints = new Map<string, { name: string; spec: EndpointSpec }>(
  Object.entries(ENDPOINTS).map(([name, spec]) => [`${spec.method} ${spec.path}`, { name, spec }]),
);

interface Budget {
  policy: RateLimitPolicyName;
  index: number;
  id: string;
  rule: RateLimitRule & { scope: RateLimitScope };
  cost: number;
  decision?: RateLimitDecision;
}

// Draft 12 requires distinct identifiers for each window in the same field.
function setHeaders(c: Context<AppEnv>, budgets: Budget[]) {
  c.header(
    "RateLimit-Policy",
    budgets.map(({ id, rule }) => `"${id}";q=${rule.limit};w=${rule.periodSeconds}`).join(", "),
  );
  let closest: Budget | undefined;
  for (const budget of budgets) {
    const result = budget.decision;
    if (!result) continue;
    if (!result.allowed) {
      closest = budget;
      break;
    }
    if (!closest || result.remaining < closest.decision!.remaining) closest = budget;
  }
  if (closest?.decision) {
    const { remaining, resetSeconds } = closest.decision;
    c.header(
      "RateLimit",
      `"${closest.id}";a=${remaining};w=${resetSeconds}${closest.cost === 1 ? "" : `;c=${closest.cost}`}`,
    );
  }
}

export function rateLimitMiddleware(config: AppConfig["rateLimits"], db: Database, logger: Logger) {
  const network = new MemoryRateLimitStore();
  const shared = config.store === "postgres" ? new PostgresRateLimitStore(db) : new MemoryRateLimitStore();

  function reportStoreFailure(policy: RateLimitPolicyName, outcome: "fail_closed" | "fail_open") {
    rateLimitDecisions.inc({ policy, outcome });
    // Database errors can contain the SQL and its parameters.
    logger.warn({ policy, outcome }, "rate-limit store unavailable");
  }

  // Use the longer registration window, including its configured overrides and natural refill.
  const registrationRules = config.rules("auth.register", "anonymous");
  const dailyIndex = registrationRules.length - 1;
  const dailyRule = registrationRules[dailyIndex]!;
  const spentUnits = (remaining: number) => (dailyRule.burst ?? dailyRule.limit) - remaining;

  async function check(
    store: RateLimitStore,
    budget: Budget,
    subject: string,
    operation: "consume" | "peek" | "reset",
  ) {
    const { policy, index, rule, cost } = budget;
    const key = rateLimitKey(policy, index, rule.scope, subject, config.keySecret);
    try {
      if (operation === "reset") {
        await store.reset(key);
        budget.decision = undefined;
        return;
      }
      budget.decision =
        operation === "peek" ? await store.peek(key, rule) : await store.consume(key, rule, cost);
    } catch {
      const closed = policy.startsWith("auth.");
      reportStoreFailure(policy, closed ? "fail_closed" : "fail_open");
      if (closed) throw new DomainError("unavailable", "rate_limit_unavailable");
      return;
    }
    const decision = budget.decision;
    rateLimitDecisions.inc({ policy, outcome: decision.allowed ? "allowed" : "denied" });
    if (!decision.allowed)
      throw new DomainError("rate_limited", "too_many_requests", {
        policy,
        scope: rule.scope,
        limit: rule.limit,
        periodSeconds: rule.periodSeconds,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
  }

  const networkLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
    const [rule] = config.rules("net.requests", "anonymous");
    const budget: Budget = { policy: "net.requests", id: "net.requests", index: 0, rule: rule!, cost: 1 };
    try {
      await check(network, budget, clientAddress(c), "consume");
    } catch (error) {
      setHeaders(c, [budget]);
      throw error;
    }
    await next();
  };

  const endpointLimits: MiddlewareHandler<AppEnv> = async (c, next) => {
    const route = matchedRoutes(c).findLast((match) => match.method !== "ALL");
    const endpoint = route && endpoints.get(`${route.method} ${route.path}`);
    if (!endpoint?.spec.limits.length || (endpoint.name === "listIdeas" && !c.req.query("q")?.trim()))
      return next();
    const actor = c.get("ctx").actor;
    const cost = endpoint.name === "graph" ? graphTraversalCost(Number(c.req.query("depth"))) : 1;
    const budgets: Budget[] = endpoint.spec.limits.flatMap((policy) => {
      const rules = config.rules(policy, actor?.trust ?? "anonymous");
      return rules.map((rule, index) => ({
        policy,
        rule,
        index,
        cost,
        id: rules.length === 1 ? policy : `${policy}.${index + 1}`,
      }));
    });
    if (!budgets.length) return next();
    try {
      for (const budget of budgets) {
        if (budget.policy === "auth.recovery" && budget.rule.scope === "email") {
          c.set("recoveryBudget", (subject) => check(shared, budget, subject, "consume"));
        } else if (budget.policy === "auth.login.failures") {
          c.set("loginFailureBudget", (email, operation) => check(shared, budget, email, operation));
        } else {
          const subject = budget.rule.scope === "account" ? actor!.id : clientAddress(c);
          await check(shared, budget, subject, "consume");
          if (budget.policy === "auth.register" && budget.index === dailyIndex) {
            c.set("priorRegistrations", spentUnits(budget.decision!.remaining) - 1);
          }
        }
      }
      await next();
    } finally {
      setHeaders(c, budgets);
    }
  };
  return {
    networkLimit,
    endpointLimits,
    async registrationDebt(network: string) {
      const key = rateLimitKey("auth.register", dailyIndex, "network", network, config.keySecret);
      try {
        return spentUnits((await shared.peek(key, dailyRule)).remaining);
      } catch {
        reportStoreFailure("auth.register", "fail_closed");
        throw new DomainError("unavailable", "rate_limit_unavailable");
      }
    },
    close: async () => {
      await network.close();
      await shared.close();
    },
  };
}
