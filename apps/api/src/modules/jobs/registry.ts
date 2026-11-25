import { z } from "zod";
import { purgeSessions } from "../identity/purge";
import { reconcileMetrics, refreshMetricsJob } from "../metrics/jobs";
import { purgeJobs } from "./operator";
import type { Ctx } from "../shared/context";
import type { Claim } from "./queue";

type Handler = (ctx: Ctx, job: Claim) => Promise<void>;

export class JobRegistry {
  private readonly handlers = new Map<string, Handler>();

  register<T>(
    kind: string,
    schema: z.ZodType<T>,
    handler: (ctx: Ctx, payload: T, job: Claim) => Promise<void>,
  ) {
    if (this.handlers.has(kind)) throw new Error(`Duplicate job kind: ${kind}`);
    this.handlers.set(kind, (ctx, job) => handler(ctx, schema.parse(job.payload), job));
  }

  run(ctx: Ctx, job: Claim) {
    const handler = this.handlers.get(job.kind);
    if (!handler) throw new Error(`Unknown job kind: ${job.kind}`);
    return handler(ctx, job);
  }
}

export const jobRegistry = new JobRegistry();
const emptyPayload = z.strictObject({});
jobRegistry.register("sessions.purge", emptyPayload, purgeSessions);
jobRegistry.register("jobs.purge", emptyPayload, async (ctx) => {
  await purgeJobs(ctx);
});
jobRegistry.register("metrics.reconcile", emptyPayload, reconcileMetrics);
jobRegistry.register("metrics.refresh", z.strictObject({ ideaId: z.uuid() }), refreshMetricsJob);
