import { sql } from "drizzle-orm";
import type { Ctx } from "./context";

/**
 * Transaction-scoped advisory locks: serialise "check, then write" sequences per logical key without locking
 * whole tables. Released automatically at commit/rollback. Must be called inside a transaction.
 *
 * Used where uniqueness alone would turn a benign race into an error:
 *  - idempotent writes (a double-submitted stance, rating or involvement must succeed, not 409);
 *  - derived-data refreshes (two concurrent refreshes of one idea must not collide or lose a vote);
 *  - "find or create" (registering the same DOI twice at once returns one source).
 *
 * Keys are hashed to 64 bits (`hashtextextended`). A collision only adds a little extra serialisation.
 * When several keys are needed in one transaction they are acquired in sorted order to rule out deadlocks.
 * On PGlite (single connection) these are no-ops in effect; `npm run test:pg` exercises them for real.
 */
export async function lockKeys(ctx: Ctx, keys: readonly string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await ctx.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }
}

export const lockKey = (ctx: Ctx, ...parts: string[]): Promise<void> => lockKeys(ctx, [parts.join(":")]);
