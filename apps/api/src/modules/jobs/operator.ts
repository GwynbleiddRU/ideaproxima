import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { queryRows } from "../../db/client";
import { jobs, type jobStates } from "../../db/schema";
import { inTransaction, type Ctx } from "../shared/context";
import { lockPendingKey, pendingFor } from "./queue";

export function listJobs(ctx: Ctx, state: (typeof jobStates)[number]) {
  return ctx.db
    .select({
      id: jobs.id,
      kind: jobs.kind,
      queue: jobs.queue,
      state: jobs.state,
      attempts: jobs.attempts,
      runAt: jobs.runAt,
      finishedAt: jobs.finishedAt,
      lastError: jobs.lastError,
    })
    .from(jobs)
    .where(eq(jobs.state, state))
    .orderBy(desc(jobs.id))
    .limit(100);
}

export async function retryFailed(ctx: Ctx, filter: { id: string } | { kind: string }) {
  let cursor: string | undefined;
  let retried = 0;
  let coalesced = 0;
  for (;;) {
    const batch = await ctx.db
      .select({ id: jobs.id, kind: jobs.kind, dedupeKey: jobs.dedupeKey, attempts: jobs.attempts })
      .from(jobs)
      .where(
        and(
          eq(jobs.state, "failed"),
          "id" in filter ? eq(jobs.id, filter.id) : eq(jobs.kind, filter.kind),
          cursor ? gt(jobs.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(jobs.id))
      .limit(100);
    for (const job of batch) {
      const row = await inTransaction(ctx, async (tx) => {
        await lockPendingKey(tx, job);
        // Grant one more attempt. The attempt number must never repeat on the same row.
        return (
          await queryRows<{ state: string }>(
            tx.db,
            sql`update jobs set
          state = case when ${pendingFor(job)} then 'done' else 'pending' end,
          finished_at = case when ${pendingFor(job)} then now() end,
          run_at = now(), max_attempts = jobs.attempts + 1
          where jobs.id = ${job.id} and jobs.state = 'failed' and jobs.attempts = ${job.attempts} returning jobs.state`,
          )
        )[0];
      });
      if (row?.state === "pending") retried++;
      if (row?.state === "done") coalesced++;
    }
    if (batch.length < 100) return { retried, coalesced };
    cursor = batch[batch.length - 1]!.id;
  }
}

export async function purgeJobs(ctx: Ctx) {
  let total = 0;
  for (;;) {
    const rows = await queryRows(
      ctx.db,
      sql`delete from jobs where jobs.id in (
      select j.id from jobs j where (j.state = 'done' and j.finished_at < now() - interval '7 days')
        or (j.state = 'failed' and j.finished_at < now() - interval '30 days')
      order by j.finished_at, j.id limit 500 for update skip locked) returning jobs.id`,
    );
    total += rows.length;
    if (rows.length < 500) return total;
  }
}
