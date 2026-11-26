CREATE TABLE "account_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"purpose" text NOT NULL,
	"email" text NOT NULL,
	"previous_email" text,
	"pending_registration" jsonb,
	"token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "account_tokens_purpose_check" CHECK ("purpose" in ('verify_email', 'reset_password', 'change_email'))
);
--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_tokens_hash_key" ON "account_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "account_tokens_person_purpose" ON "account_tokens" USING btree ("person_id","purpose");--> statement-breakpoint
CREATE INDEX "account_tokens_email_purpose" ON "account_tokens" USING btree ("email","purpose");--> statement-breakpoint
CREATE INDEX "account_tokens_expiry" ON "account_tokens" USING btree ("expires_at");