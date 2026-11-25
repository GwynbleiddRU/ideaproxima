CREATE TABLE "job_schedules" (
	"name" text PRIMARY KEY NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"queue" text DEFAULT 'default' NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"priority" smallint DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_state_check" CHECK ("state" in ('pending', 'running', 'done', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("queue","priority" DESC NULLS LAST,"run_at","id") WHERE "jobs"."state" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_key" ON "jobs" USING btree ("kind","dedupe_key") WHERE "jobs"."state" = 'pending' and "jobs"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "jobs_lease_idx" ON "jobs" USING btree ("locked_until") WHERE "jobs"."state" = 'running';--> statement-breakpoint
CREATE INDEX "jobs_finished_idx" ON "jobs" USING btree ("finished_at") WHERE "jobs"."state" in ('done', 'failed');