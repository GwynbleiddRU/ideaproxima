import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "../../lib/ids";
import { createdAt, inList, tstz } from "./_columns";

export const jobStates = ["pending", "running", "done", "failed"] as const;

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().$defaultFn(uuidv7),
    queue: text("queue").notNull().default("default"),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().default({}),
    dedupeKey: text("dedupe_key"),
    priority: smallint("priority").notNull().default(0),
    runAt: createdAt("run_at"),
    state: text("state", { enum: jobStates }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    lockedBy: text("locked_by"),
    lockedUntil: tstz("locked_until"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    finishedAt: tstz("finished_at"),
  },
  (t) => [
    check("jobs_state_check", inList("state", jobStates)),
    index("jobs_claim_idx")
      .on(t.queue, t.priority.desc(), t.runAt, t.id)
      .where(sql`${t.state} = 'pending'`),
    uniqueIndex("jobs_dedupe_key")
      .on(t.kind, t.dedupeKey)
      .where(sql`${t.state} = 'pending' and ${t.dedupeKey} is not null`),
    index("jobs_lease_idx")
      .on(t.lockedUntil)
      .where(sql`${t.state} = 'running'`),
    index("jobs_finished_idx")
      .on(t.finishedAt)
      .where(sql`${t.state} in ('done', 'failed')`),
  ],
);

export const jobSchedules = pgTable("job_schedules", {
  name: text("name").primaryKey(),
  nextRunAt: tstz("next_run_at").notNull(),
  lastRunAt: tstz("last_run_at"),
});
