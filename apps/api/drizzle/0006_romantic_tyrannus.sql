CREATE TABLE "used_registration_challenges" (
	"salt" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "used_registration_challenges_expiry_idx" ON "used_registration_challenges" USING btree ("expires_at");