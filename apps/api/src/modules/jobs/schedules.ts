import { sql } from "drizzle-orm";
import { queryRows } from "../../db/client";
import { jobSchedules } from "../../db/schema";
import { inTransaction, type Ctx } from "../shared/context";
import { enqueue } from "./queue";

export interface Schedule {
  name: string;
  every: number; // milliseconds
  kind: string;
  payload?: unknown;
}
const hour = 60 * 60 * 1000;
export const schedules: readonly Schedule[] = [
  { name: "sessions.purge", kind: "sessions.purge", every: hour },
  { name: "jobs.purge", kind: "jobs.purge", every: hour },
  { name: "metrics.reconcile", kind: "metrics.reconcile", every: 24 * hour },
];

export async function initializeSchedules(ctx: Ctx, entries: readonly Schedule[]) {
  for (const { name, every } of entries) {
    if (!Number.isSafeInteger(every) || every < 1)
      throw new RangeError("Schedule interval must be positive milliseconds");
    await ctx.db
      .insert(jobSchedules)
      .values({ name, nextRunAt: sql`now()` })
      .onConflictDoNothing();
  }
}

/** Keep the original cadence after downtime, enqueueing once for all missed slots. */
export function runSchedule(ctx: Ctx, entry: Schedule) {
  return inTransaction(ctx, async (tx) => {
    const rows = await queryRows(
      tx.db,
      sql`update job_schedules set last_run_at = now(),
      next_run_at = job_schedules.next_run_at + (floor(extract(epoch from (now() - job_schedules.next_run_at)) * 1000 / ${entry.every}) + 1)
        * (${entry.every} * interval '1 millisecond')
      where job_schedules.name = ${entry.name} and job_schedules.next_run_at <= now() returning job_schedules.name`,
    );
    if (!rows.length) return false;
    await enqueue(tx, { kind: entry.kind, payload: entry.payload ?? {} });
    return true;
  });
}
