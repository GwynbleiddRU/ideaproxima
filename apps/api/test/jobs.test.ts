import { uniformWeights } from "@ideaproxima/domain";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "../src/config";
import { jobs, jobSchedules } from "../src/db/schema";
import { createLogger } from "../src/observability/logger";
import { registry as metrics } from "../src/observability/metrics";
import { collectQueueDepth } from "../src/modules/jobs/metrics";
import { listJobs, purgeJobs, retryFailed } from "../src/modules/jobs/operator";
import {
  claimJobs,
  completeJob,
  enqueue,
  extendLease,
  failJob,
  reclaimExpired,
  releaseLease,
  retryDelaySeconds,
  type Claim,
} from "../src/modules/jobs/queue";
import { JobRegistry } from "../src/modules/jobs/registry";
import { drainJobs, startWorker } from "../src/modules/jobs/runner";
import { initializeSchedules, runSchedule } from "../src/modules/jobs/schedules";
import { inTransaction, type Ctx } from "../src/modules/shared/context";
import { openTestDatabase, type TestDatabase } from "./database";

let database: TestDatabase;
let ctx: Ctx;
beforeAll(async () => {
  database = await openTestDatabase();
  ctx = { db: database.handle.db, weights: uniformWeights, actor: null };
});
beforeEach(async () => {
  await ctx.db.delete(jobs);
  await ctx.db.delete(jobSchedules);
});
afterAll(() => database.dispose());

const input = { kind: "fixture", payload: {} };
const keyed = { ...input, dedupeKey: "one" };
async function claim(worker = "worker") {
  const [job] = await claimJobs(ctx, worker, ["default"], 1);
  expect(job).toBeDefined();
  return job!;
}

it("rolls back the job and its counter with a failed originating transaction", async () => {
  await expect(
    inTransaction(ctx, async (tx) => {
      await enqueue(tx, { ...keyed, kind: "rollback" });
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect(await ctx.db.select().from(jobs)).toEqual([]);
  expect(await metrics.metrics()).not.toContain('jobs_enqueued_total{kind="rollback"}');
});

it("coalesces concurrent pending inserts and permits a successor while running", async () => {
  const ids = await Promise.all(Array.from({ length: 4 }, () => enqueue(ctx, keyed)));
  expect(ids.filter(Boolean)).toHaveLength(1);
  const old = await claim();
  const next = await enqueue(ctx, keyed);
  expect(next).toBeTruthy();
  await failJob(ctx, old, "transient");
  expect((await claim()).id).toBe(next);
  expect(await listJobs(ctx, "done")).toMatchObject([{ id: old.id }]);
});

it("drains due work by priority then run time and id", async () => {
  const seen: number[] = [];
  const registry = new JobRegistry();
  registry.register(input.kind, z.number(), async (_, payload) => {
    seen.push(payload);
  });
  const runAt = new Date(0);
  for (const [payload, priority] of [
    [1, 0],
    [2, 1],
    [3, 1],
  ] as const)
    await enqueue(ctx, { ...input, payload, priority, runAt });
  await enqueue(ctx, { ...input, payload: 4, runAt: new Date(Date.now() + 60_000) });
  expect(await drainJobs(ctx, registry)).toBe(3);
  expect(seen).toEqual([2, 3, 1]);
});

it("validates payloads, backs off, and dead-letters a repeated handler failure", async () => {
  expect(retryDelaySeconds(1, 0)).toBeCloseTo(8);
  expect(retryDelaySeconds(1, 1)).toBeCloseTo(12);
  expect(retryDelaySeconds(20, 0.5)).toBe(3600);
  const registry = new JobRegistry();
  let calls = 0;
  registry.register("fixture", z.object({ valid: z.boolean() }), async () => {
    calls++;
    throw new Error("x".repeat(3000));
  });
  await enqueue(ctx, { ...input, maxAttempts: 1 });
  const id = await enqueue(ctx, { ...input, payload: { valid: true }, maxAttempts: 2 });
  expect(await drainJobs(ctx, registry)).toBe(2);
  expect(calls).toBe(1);
  const pending = await listJobs(ctx, "pending");
  expect(pending).toMatchObject([{ id, attempts: 1 }]);
  expect(pending[0]!.lastError).toHaveLength(2000);
  expect(pending[0]!.runAt.getTime()).toBeGreaterThan(Date.now());
  await ctx.db
    .update(jobs)
    .set({ runAt: new Date(0) })
    .where(eq(jobs.id, id!));
  expect(await drainJobs(ctx, registry)).toBe(1);
  expect(calls).toBe(2);
  expect(await listJobs(ctx, "failed")).toHaveLength(2);
  await collectQueueDepth(ctx.db);
  expect(await metrics.metrics()).toContain('jobs_failed{queue="default"} 2');
});

it("fences stale operations before and after another attempt with the same worker identity", async () => {
  await enqueue(ctx, { ...keyed, maxAttempts: 2 });
  const old = await claim();
  expect(await extendLease(ctx, old)).toBe(true);
  await ctx.db
    .update(jobs)
    .set({ lockedUntil: new Date(0) })
    .where(eq(jobs.id, old.id));
  async function rejectStale(job: Claim) {
    expect(await completeJob(ctx, job)).toBe(false);
    expect(await extendLease(ctx, job)).toBe(false);
    expect(await failJob(ctx, job, "late")).toBe(false);
    expect(await releaseLease(ctx, job)).toBe(false);
  }
  await rejectStale(old);
  expect((await Promise.all([reclaimExpired(ctx), reclaimExpired(ctx)])).sort()).toEqual([0, 1]);
  const next = await claim();
  expect(next).toMatchObject({ id: old.id, attempts: 2 });
  await rejectStale(old);
  await releaseLease(ctx, next);
  await reclaimExpired(ctx);
  expect(await listJobs(ctx, "failed")).toMatchObject([{ id: next.id, attempts: 2 }]);
  expect(await retryFailed(ctx, { id: next.id })).toEqual({ retried: 1, coalesced: 0 });
  const manual = await claim();
  expect(manual.attempts).toBe(3);
  await rejectStale(next);
  expect(await completeJob(ctx, manual)).toBe(true);
});

it("keeps the pending successor when two workers race to reclaim an expired refresh", async () => {
  await enqueue(ctx, keyed);
  const old = await claim("first");
  await releaseLease(ctx, old);
  const next = await enqueue(ctx, keyed);
  expect((await Promise.all([reclaimExpired(ctx), reclaimExpired(ctx)])).sort()).toEqual([0, 1]);
  expect(await listJobs(ctx, "done")).toMatchObject([{ id: old.id }]);
  const successor = await claim("second");
  expect(successor.id).toBe(next);
  expect(await completeJob(ctx, old)).toBe(false);
  expect(await completeJob(ctx, successor)).toBe(true);
});

it("advances one schedule slot atomically and preserves the cadence after missed slots", async () => {
  const schedule = { name: "hourly", every: 3_600_000, kind: "fixture" };
  await Promise.all([initializeSchedules(ctx, [schedule]), initializeSchedules(ctx, [schedule])]);
  const origin = new Date(Date.now() - 2.5 * schedule.every);
  await ctx.db.update(jobSchedules).set({ nextRunAt: origin });
  await expect(
    inTransaction(ctx, async (tx) => {
      expect(await runSchedule(tx, schedule)).toBe(true);
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect(await listJobs(ctx, "pending")).toHaveLength(0);
  expect((await Promise.all([runSchedule(ctx, schedule), runSchedule(ctx, schedule)])).sort()).toEqual([
    false,
    true,
  ]);
  expect(await listJobs(ctx, "pending")).toHaveLength(1);
  const [row] = await ctx.db.select().from(jobSchedules);
  expect(row!.nextRunAt.getTime()).toBe(origin.getTime() + 3 * schedule.every);
});

it("coalesces operator retries and purges only terminal rows beyond retention", async () => {
  const first = await enqueue(ctx, { ...keyed, maxAttempts: 1 });
  await failJob(ctx, await claim(), "failed");
  await enqueue(ctx, keyed);
  expect(await retryFailed(ctx, { kind: "fixture" })).toEqual({ retried: 0, coalesced: 1 });
  const second = await enqueue(ctx, { ...input, maxAttempts: 1, priority: 10 });
  await failJob(ctx, await claim(), "failed");
  await ctx.db.update(jobs).set({ finishedAt: sql`now() - interval '8 days'` });
  expect(await purgeJobs(ctx)).toBe(1);
  expect(await listJobs(ctx, "done")).toEqual([]);
  expect(first).not.toBe(second);
  expect(await listJobs(ctx, "failed")).toMatchObject([{ id: second }]);
  await ctx.db.update(jobs).set({ finishedAt: new Date(0) });
  expect(await purgeJobs(ctx)).toBe(1);
  expect(await listJobs(ctx, "pending")).toHaveLength(1);
});

it("stops polling, drains active handlers and releases fenced leases at the deadline", async () => {
  const config = loadConfig({ JOBS_QUEUES: "default=1", JOBS_CONCURRENCY: "2", LOG_LEVEL: "silent" });
  const registry = new JobRegistry();
  let started!: (job: Claim) => void;
  let finish!: () => void;
  const running = new Promise<Claim>((resolve) => {
    started = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  registry.register("fixture", z.object({}), async (_, __, job) => {
    started(job);
    await finished;
  });
  await enqueue(ctx, input);
  await enqueue(ctx, input);
  const worker = await startWorker(ctx, config.jobs, createLogger(config.log), registry);
  const old = await running;
  const stopped = worker.stop();
  try {
    expect(await listJobs(ctx, "pending")).toHaveLength(1);
    await worker.release();
    expect(await reclaimExpired(ctx)).toBe(1);
  } finally {
    finish();
    await stopped;
  }
  expect(await completeJob(ctx, old)).toBe(false);
  expect(await listJobs(ctx, "pending")).toHaveLength(2);
});

it.skipIf(!process.env.TEST_DATABASE_URL)("skips a row held by a competing transaction", async () => {
  await enqueue(ctx, input);
  await enqueue(ctx, input);
  await inTransaction(ctx, async (tx) => {
    const [held] = await claimJobs(tx, "first", ["default"], 1);
    const other = await claim("second");
    expect(held!.id).not.toBe(other.id);
  });
});

it.skipIf(!process.env.TEST_DATABASE_URL)(
  "executes 500 distinct jobs once across four concurrent workers",
  async () => {
    await ctx.db.insert(jobs).values(Array.from({ length: 500 }, () => input));
    const registry = new JobRegistry();
    const seen: string[] = [];
    registry.register("fixture", z.object({}), async (_, __, job) => {
      seen.push(job.id);
    });
    const counts = await Promise.all(Array.from({ length: 4 }, () => drainJobs(ctx, registry)));
    expect(counts.every((n) => n > 0)).toBe(true);
    expect(seen).toHaveLength(500);
    expect(new Set(seen).size).toBe(500);
    expect(
      await ctx.db
        .select({ attempts: jobs.attempts, state: jobs.state })
        .from(jobs)
        .groupBy(jobs.attempts, jobs.state),
    ).toEqual([{ attempts: 1, state: "done" }]);
  },
);
