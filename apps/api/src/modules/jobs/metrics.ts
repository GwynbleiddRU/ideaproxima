import { Counter, Gauge, Histogram } from "prom-client";
import { sql } from "drizzle-orm";
import { queryRows, type Database } from "../../db/client";
import { registry } from "../../observability/metrics";

export const enqueued = new Counter({
  name: "jobs_enqueued_total",
  help: "New jobs committed.",
  labelNames: ["kind"],
  registers: [registry],
});
export const finished = new Counter({
  name: "jobs_finished_total",
  help: "Job attempts by outcome.",
  labelNames: ["kind", "outcome"],
  registers: [registry],
});
export const duration = new Histogram({
  name: "job_duration_seconds",
  help: "Time spent executing handlers.",
  labelNames: ["kind"],
  registers: [registry],
});

const queueGauge = (name: string, help: string) =>
  new Gauge({ name, help, labelNames: ["queue"], registers: [registry] });
const pending = queueGauge("jobs_pending", "Pending jobs.");
const oldest = queueGauge("jobs_oldest_pending_seconds", "Seconds since the oldest pending job was due.");
const failed = queueGauge("jobs_failed", "Dead-letter jobs.");

/** Read the database on the private scrape path, including when the API only enqueues. */
export async function collectQueueDepth(db: Database) {
  const rows = await queryRows<{ queue: string; pending: number; oldest: number; failed: number }>(
    db,
    sql`
    select jobs.queue, count(*) filter (where jobs.state = 'pending')::int as pending,
      greatest(0, extract(epoch from now() - min(jobs.run_at) filter (where jobs.state = 'pending')))::float8 as oldest,
      count(*) filter (where jobs.state = 'failed')::int as failed
    from jobs where jobs.state in ('pending', 'failed') group by jobs.queue`,
  );
  pending.reset();
  oldest.reset();
  failed.reset();
  for (const row of rows) {
    pending.set({ queue: row.queue }, row.pending);
    oldest.set({ queue: row.queue }, row.oldest);
    failed.set({ queue: row.queue }, row.failed);
  }
}
