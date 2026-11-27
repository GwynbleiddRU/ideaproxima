CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"kind" text NOT NULL,
	"network_key_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_events_kind_check" CHECK ("kind" in ('signed_in', 'sign_in_failed', 'session_revoked', 'other_sessions_revoked', 'password_changed', 'password_reset', 'email_changed'))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "established_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "confirmed_minimum_age" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "age_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_events_person_page_idx" ON "security_events" USING btree ("person_id","id");--> statement-breakpoint
CREATE INDEX "security_events_retention_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_person_page_idx" ON "sessions" USING btree ("person_id","id") WHERE revoked_at is null;