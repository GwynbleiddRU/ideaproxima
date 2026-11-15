import type { Actor, WeightPolicy } from "@ideaproxima/domain";
import type { Database } from "../../db/client";

/**
 * Everything a service needs, passed explicitly. No globals, no service locator: a test builds a Ctx with an
 * in-memory database and a chosen actor, and calls the same functions the HTTP layer calls.
 */
export interface Ctx {
  db: Database;
  actor: Actor | null;
  /** Evaluator weighting used by derived metrics. Baseline: uniform. The scoring system plugs in here. */
  weights: WeightPolicy;
}

/** Runs `fn` in a transaction. Nested calls become savepoints, so services can compose freely. */
export function inTransaction<T>(ctx: Ctx, fn: (tx: Ctx) => Promise<T>): Promise<T> {
  return ctx.db.transaction((tx) => fn({ ...ctx, db: tx as unknown as Database }));
}

export const isModerator = (ctx: Ctx): boolean =>
  ctx.actor?.role === "moderator" || ctx.actor?.role === "admin";
