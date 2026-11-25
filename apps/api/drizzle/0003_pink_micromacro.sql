CREATE TABLE "topic_translations" (
	"topic_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "topic_translations_topic_id_locale_pk" PRIMARY KEY("topic_id","locale")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "topic_translations" ADD CONSTRAINT "topic_translations_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;