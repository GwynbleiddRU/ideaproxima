import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { Logger } from "pino";
import type { AppConfig } from "../../config";
import type { Ctx } from "../shared/context";
import { sqlState } from "../../db/errors";
import { duration } from "./metrics";
import { claimJobs, completeJob, failJob, reclaimExpired, releaseLease, type Claim } from "./queue";
import { jobRegistry, type JobRegistry } from "./registry";
import { initializeSchedules, runSchedule, schedules, type Schedule } from "./schedules";

export async function runJob(ctx: Ctx, job: Claim, registry = jobRegistry) {
  const stopTimer = duration.startTimer({ kind: job.kind });
  try {
    await registry.run(ctx, job);
  } catch (error) {
    const code = sqlState(error);
    return failJob(
      ctx,
      job,
      code ? `Database error ${code}` : error instanceof Error ? error.message : "Handler failed",
    );
  } finally {
    stopTimer();
  }
  return completeJob(ctx, job);
}

export async function drainJobs(ctx: Ctx, registry = jobRegistry, queues: readonly string[] = ["default"]) {
  const worker = randomUUID();
  let count = 0;
  for (;;) {
    const reclaimed = await reclaimExpired(ctx);
    const [job] = await claimJobs(ctx, worker, queues, 1);
    if (job) {
      await runJob(ctx, job, registry);
      count++;
    } else if (!reclaimed) return count;
  }
}

export async function startWorker(
  ctx: Ctx,
  config: AppConfig["jobs"],
  logger: Logger,
  registry: JobRegistry = jobRegistry,
  entries: readonly Schedule[] = schedules,
) {
  const worker = randomUUID();
  const stop = new AbortController();
  const active = new Map<Claim, Promise<void>>();
  await initializeSchedules(ctx, entries);

  // Rotate the first queue so a busy queue cannot monopolise spare capacity.
  let first = 0;
  async function tick() {
    let worked = await reclaimExpired(ctx);
    for (const entry of entries) {
      if (stop.signal.aborted) break;
      if (await runSchedule(ctx, entry)) worked++;
    }
    for (let i = 0; i < config.queues.length && !stop.signal.aborted; i++) {
      const { name, cap } = config.queues[(first + i) % config.queues.length]!;
      const available = config.concurrency - active.size;
      if (!available) break;
      const inQueue = [...active.keys()].filter((j) => j.queue === name).length;
      const claimed = await claimJobs(
        ctx,
        worker,
        [name],
        Math.min(available, (cap ?? config.concurrency) - inQueue),
      );
      for (const job of claimed) {
        if (stop.signal.aborted) {
          await releaseLease(ctx, job);
          continue;
        }
        const task = runJob(ctx, job, registry)
          .catch((error: unknown) => logger.error({ pgCode: sqlState(error) }, "job settlement failed"))
          .then(() => {
            active.delete(job);
          });
        active.set(job, task);
      }
      worked += claimed.length;
    }
    first = (first + 1) % config.queues.length;
    return worked;
  }

  async function poll() {
    let interval = 250;
    while (!stop.signal.aborted) {
      try {
        interval = (await tick()) ? 250 : Math.min(2000, interval * 2);
      } catch (error) {
        logger.error({ pgCode: sqlState(error) }, "job poll failed");
        interval = 2000;
      }
      if (!stop.signal.aborted) await sleep(interval, undefined, { signal: stop.signal }).catch(() => {});
    }
  }
  const loop = poll();
  return {
    async stop() {
      stop.abort();
      await loop;
      await Promise.all(active.values());
    },
    async release() {
      await Promise.all([...active.keys()].map((job) => releaseLease(ctx, job)));
    },
  };
}
