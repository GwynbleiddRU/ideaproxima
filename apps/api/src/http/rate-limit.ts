import type { Context, MiddlewareHandler } from "hono";
import type { ErrorResponse } from "@ideaproxima/contracts";
import type { AppEnv } from "./env";

/**
 * Fixed-window, in-memory rate limiting. Deliberately simple: it protects a single API process against
 * credential stuffing and write floods. With several API instances behind a load balancer, either keep sticky
 * routing or replace the store with a shared one (Redis/Postgres) — the middleware interface stays the same.
 */
export function rateLimit(options: {
  name: string;
  perMinute: number;
  key: (c: Context<AppEnv>) => string | null;
}): MiddlewareHandler<AppEnv> {
  const windowMs = 60_000;
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();

  return async (c, next) => {
    if (options.perMinute <= 0) return next();
    const subject = options.key(c);
    if (!subject) return next();
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      lastSweep = now;
    }
    let entry = hits.get(subject);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(subject, entry);
    }
    entry.count++;
    if (entry.count > options.perMinute) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      const body: ErrorResponse = {
        error: {
          code: "rate_limited",
          message: `Too many requests (${options.name}). Try again in ${retryAfter}s.`,
          details: { retryAfterSeconds: retryAfter },
        },
      };
      return c.json(body, 429);
    }
    await next();
  };
}
