import { sql } from "drizzle-orm";
import { queryRows } from "../../db/client";
import { jobs } from "../../db/schema";
import { afterCommit, inTransaction, type Ctx } from "../shared/context";
import { lockKey } from "../shared/locks";
import { enqueued, finished } from "./metrics";

export interface NewJob {
  kind: string;
  payload: unknown;
  queue?: string;
  dedupeKey?: string;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
}

type Key = { kind: string; dedupeKey: string | null };
export interface Claim extends Key {
  id: string;
  payload: unknown;
  queue: string;
  worker: string;
  attempts: number;
}

export const leaseSeconds = 60;

// All paths that enter the partial unique index serialize on this key. Claiming removes
// a row from the index atomically and does not need the advisory lock.
export const lockPendingKey = (ctx: Ctx, key: Key) =>
  key.dedupeKey === null ? undefined : lockKey(ctx, "jobs", key.kind, key.dedupeKey);

export async function enqueue(ctx: Ctx, job: NewJob): Promise<string | null> {
  if (job.maxAttempts !== undefined && (!Number.isInteger(job.maxAttempts) || job.maxAttempts < 1))
    throw new RangeError("maxAttempts must be a positive integer");
  const insert = async (tx: Ctx) => {
    const [row] = await tx.db.insert(jobs).values(job).onConflictDoNothing().returning({ id: jobs.id });
    if (row) afterCommit(tx, () => enqueued.inc({ kind: job.kind }));
    return row?.id ?? null;
  };
  const { kind, dedupeKey } = job;
  if (dedupeKey === undefined) return insert(ctx);
  return inTransaction(ctx, async (tx) => {
    await lockPendingKey(tx, { kind, dedupeKey });
    return insert(tx);
  });
}

const claimColumns = sql`jobs.id, jobs.kind, jobs.payload, jobs.queue, jobs.dedupe_key as "dedupeKey",
  jobs.locked_by as worker, jobs.attempts`;

export function claimJobs(ctx: Ctx, worker: string, queues: readonly string[], limit: number) {
  if (!queues.length || limit <= 0) return Promise.resolve<Claim[]>([]);
  const queueList = sql.join(
    queues.map((queue) => sql`${queue}`),
    sql`, `,
  );
  return queryRows<Claim>(
    ctx.db,
    sql`
    update jobs set state = 'running', attempts = jobs.attempts + 1, locked_by = ${worker},
      locked_until = now() + make_interval(secs => ${leaseSeconds})
    where jobs.id in (select j.id from jobs j where j.state = 'pending'
      and j.queue in (${queueList}) and j.run_at <= now()
      order by j.priority desc nulls last, j.run_at, j.id limit ${limit} for update skip locked)
    returning ${claimColumns}`,
  );
}

function ownership(job: Claim, expired = false) {
  return sql`jobs.id = ${job.id} and jobs.state = 'running' and jobs.locked_by = ${job.worker}
    and jobs.attempts = ${job.attempts} and jobs.locked_until ${expired ? sql`<=` : sql`>`} clock_timestamp()`;
}

export async function completeJob(ctx: Ctx, job: Claim): Promise<boolean> {
  const rows = await queryRows(
    ctx.db,
    sql`update jobs set state = 'done', finished_at = now(),
    locked_by = null, locked_until = null where ${ownership(job)} returning jobs.id`,
  );
  if (rows.length) afterCommit(ctx, () => finished.inc({ kind: job.kind, outcome: "done" }));
  return rows.length > 0;
}

export async function extendLease(ctx: Ctx, job: Claim): Promise<boolean> {
  const rows = await queryRows(
    ctx.db,
    sql`update jobs set locked_until = clock_timestamp() + make_interval(secs => ${leaseSeconds})
    where ${ownership(job)} returning jobs.id`,
  );
  return rows.length > 0;
}

/** Make an unfinished attempt immediately reclaimable when the shutdown deadline expires. */
export async function releaseLease(ctx: Ctx, job: Claim) {
  const rows = await queryRows(
    ctx.db,
    sql`update jobs set locked_until = clock_timestamp()
    where ${ownership(job)} returning jobs.id`,
  );
  return rows.length > 0;
}

export function retryDelaySeconds(attempts: number, random = Math.random()) {
  return Math.min(5 * 2 ** attempts, 3600) * (0.8 + random * 0.4);
}

// Pending work already covers this key, even if it was enqueued while the handler was running.
export function pendingFor(key: Key) {
  return sql`exists (select 1 from jobs p where p.state = 'pending' and p.kind = ${key.kind}
    and p.dedupe_key = ${key.dedupeKey})`;
}

async function finishUnsuccessful(ctx: Ctx, job: Claim, message: string, expired: boolean) {
  return inTransaction(ctx, async (tx) => {
    await lockPendingKey(tx, job);
    const delay = expired ? 0 : retryDelaySeconds(job.attempts);
    const [row] = await queryRows<{ state: "pending" | "failed" | "done" }>(
      tx.db,
      sql`
      update jobs set state = case when jobs.attempts >= jobs.max_attempts then 'failed'
        when ${pendingFor(job)} then 'done' else 'pending' end,
        finished_at = case when jobs.attempts >= jobs.max_attempts or ${pendingFor(job)} then now() end,
        run_at = now() + make_interval(secs => ${delay}), last_error = ${message.slice(0, 2000)},
        locked_until = null, locked_by = null where ${ownership(job, expired)} returning jobs.state`,
    );
    if (!row) return false;
    const outcome = { pending: expired ? "reclaimed" : "retry", failed: "failed", done: "superseded" }[
      row.state
    ];
    afterCommit(tx, () => finished.inc({ kind: job.kind, outcome }));
    return true;
  });
}

export function failJob(ctx: Ctx, job: Claim, message: string) {
  return finishUnsuccessful(ctx, job, message, false);
}

export async function reclaimExpired(ctx: Ctx, limit = 32): Promise<number> {
  const expired = await queryRows<Claim>(
    ctx.db,
    sql`select ${claimColumns} from jobs
    where jobs.state = 'running' and jobs.locked_until <= now() order by jobs.locked_until, jobs.id limit ${limit}`,
  );
  let reclaimed = 0;
  for (const job of expired) {
    if (await finishUnsuccessful(ctx, job, "Lease expired", true)) reclaimed++;
  }
  return reclaimed;
}
