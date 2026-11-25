import { and, eq, inArray, sql } from "drizzle-orm";
import { Counter } from "prom-client";
import { ideas, jobs } from "../../db/schema";
import { registry } from "../../observability/metrics";
import { lockPendingKey } from "../jobs/queue";
import { afterCommit, inTransaction, type Ctx } from "../shared/context";
import { recomputeIdeaMetrics } from "./service";

const drift = new Counter({
  name: "metrics_reconcile_drift_total",
  help: "Sampled ideas whose stored metrics required repair.",
  registers: [registry],
});

export async function refreshMetricsJob(ctx: Ctx, { ideaId }: { ideaId: string }) {
  await recomputeIdeaMetrics(ctx, [ideaId]);
}

export async function reconcileMetrics(ctx: Ctx) {
  const sample = await ctx.db
    .select({ id: ideas.id })
    .from(ideas)
    .orderBy(sql`random()`)
    .limit(25);
  for (const { id } of sample) {
    await inTransaction(ctx, async (tx) => {
      // Normal asynchronous lag is already covered by a refresh. Hold its enqueue key until
      // the comparison commits so a concurrent signal write cannot look like drift.
      await lockPendingKey(tx, { kind: "metrics.refresh", dedupeKey: id });
      const [outstanding] = await tx.db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.kind, "metrics.refresh"),
            eq(jobs.dedupeKey, id),
            inArray(jobs.state, ["pending", "running"]),
          ),
        )
        .limit(1);
      if (!outstanding && (await recomputeIdeaMetrics(tx, [id]))) afterCommit(tx, () => drift.inc());
    });
  }
}
