import { randomInt } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Actor, WeightPolicy } from "@ideaproxima/domain";
import type { Database } from "../../db/client";
import { isRetryableTransactionError, sqlState } from "../../db/errors";

const inTransactionScope = Symbol("inTransactionScope");

/**
 * Everything a service needs, passed explicitly. No globals, no service locator: a test builds a Ctx with an
 * in-memory database and a chosen actor, and calls the same functions the HTTP layer calls.
 */
export interface Ctx {
  db: Database;
  actor: Actor | null;
  /** Evaluator weighting used by derived metrics. Baseline: uniform. The scoring system plugs in here. */
  weights: WeightPolicy;
  [inTransactionScope]?: (() => void)[];
}

/** Publish process-local observations only after the outer transaction commits. */
export function afterCommit(ctx: Ctx, observe: () => void) {
  if (ctx[inTransactionScope]) ctx[inTransactionScope].push(observe);
  else observe();
}

/** Replays the whole transaction once on a retryable SQLSTATE. Nested calls use savepoints. */
export async function inTransaction<T>(ctx: Ctx, fn: (tx: Ctx) => Promise<T>): Promise<T> {
  const observations: (() => void)[] = [];
  const attempt = () =>
    ctx.db.transaction((tx) =>
      fn({ ...ctx, db: tx as unknown as Database, [inTransactionScope]: observations }),
    );
  let result: T;
  try {
    result = await attempt();
  } catch (error) {
    if (ctx[inTransactionScope] || !isRetryableTransactionError(sqlState(error))) throw error;
    observations.length = 0;
    await delay(randomInt(20, 51));
    result = await attempt();
  }
  for (const observe of observations) afterCommit(ctx, observe);
  return result;
}

export const isModerator = (ctx: Ctx): boolean =>
  ctx.actor?.role === "moderator" || ctx.actor?.role === "admin";
