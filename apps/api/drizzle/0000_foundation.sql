CREATE TABLE "accounts" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"affiliation" text DEFAULT '' NOT NULL,
	"capacities" text[] DEFAULT '{}'::text[] NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	CONSTRAINT "people_role_check" CHECK ("role" in ('member', 'moderator', 'admin')),
	CONSTRAINT "people_capacities_check" CHECK ("capacities" <@ array['research','engineering','funding','entrepreneurship','policy','organizing','communication']::text[])
);
--> statement-breakpoint
CREATE TABLE "person_expertise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"basis" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "person_expertise_basis_check" CHECK ("basis" in ('self_declared', 'verified'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"base_revision_id" uuid,
	"author_id" uuid NOT NULL,
	"change_note" text DEFAULT '' NOT NULL,
	"content" jsonb NOT NULL,
	"status" text NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idea_revisions_status_check" CHECK ("status" in ('proposed', 'accepted', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "idea_stewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "idea_stewards_role_check" CHECK ("role" in ('originator', 'steward'))
);
--> statement-breakpoint
CREATE TABLE "idea_topics" (
	"idea_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "idea_topics_idea_id_topic_id_pk" PRIMARY KEY("idea_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"proposed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_revision_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage" text DEFAULT 'imagined' NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '')), 'B')) STORED,
	CONSTRAINT "ideas_stage_check" CHECK ("stage" in ('imagined', 'developed', 'examined', 'tested', 'implemented', 'learned_from'))
);
--> statement-breakpoint
CREATE TABLE "stage_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"rationale" text NOT NULL,
	"decided_by" uuid NOT NULL,
	"initiative_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stage_transitions_to_check" CHECK ("to_stage" in ('imagined', 'developed', 'examined', 'tested', 'implemented', 'learned_from')),
	CONSTRAINT "stage_transitions_from_check" CHECK ("from_stage" is null or "from_stage" in ('imagined', 'developed', 'examined', 'tested', 'implemented', 'learned_from'))
);
--> statement-breakpoint
CREATE TABLE "arguments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid,
	"claim_id" uuid,
	"parent_argument_id" uuid,
	"stance" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "arguments_target_check" CHECK (num_nonnulls(idea_id, claim_id, parent_argument_id) = 1),
	CONSTRAINT "arguments_stance_check" CHECK ("stance" in ('supports', 'opposes', 'qualifies'))
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', statement)) STORED
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"source_id" uuid,
	"outcome_id" uuid,
	"stance" text NOT NULL,
	"summary" text NOT NULL,
	"limitations" text DEFAULT '' NOT NULL,
	"locator" text DEFAULT '' NOT NULL,
	"contributed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_reason" text DEFAULT '' NOT NULL,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "evidence_basis_check" CHECK (num_nonnulls(source_id, outcome_id) = 1),
	CONSTRAINT "evidence_stance_check" CHECK ("stance" in ('supports', 'challenges', 'mixed'))
);
--> statement-breakpoint
CREATE TABLE "idea_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"role" text NOT NULL,
	"depth" smallint,
	"position" integer DEFAULT 0 NOT NULL,
	"added_by" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	CONSTRAINT "idea_claims_role_check" CHECK ("role" in ('premise', 'mechanism', 'prerequisite', 'consequence', 'risk')),
	CONSTRAINT "idea_claims_depth_check" CHECK (depth is null or (depth between 1 and 4 and role in ('consequence', 'risk')))
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"authors" text DEFAULT '' NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"published_year" integer,
	"doi" text,
	"url" text,
	"registered_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_kind_check" CHECK ("kind" in ('peer_reviewed_article', 'preprint', 'book', 'report', 'dataset', 'patent', 'standard', 'thesis', 'web_page', 'news', 'expert_statement', 'other'))
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"evaluator_id" uuid NOT NULL,
	"idea_id" uuid,
	"claim_id" uuid,
	"evidence_id" uuid,
	"argument_id" uuid,
	"relation_id" uuid,
	"comment_id" uuid,
	"target_kind" text GENERATED ALWAYS AS (case when idea_id is not null then 'idea' when claim_id is not null then 'claim' when evidence_id is not null then 'evidence' when argument_id is not null then 'argument' when relation_id is not null then 'relation' when comment_id is not null then 'comment' end) STORED,
	"target_id" uuid GENERATED ALWAYS AS (coalesce(idea_id, claim_id, evidence_id, argument_id, relation_id, comment_id)) STORED,
	"dimension" text NOT NULL,
	"value" double precision NOT NULL,
	"confidence" text,
	"rationale" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "evaluations_single_target_check" CHECK (num_nonnulls(idea_id, claim_id, evidence_id, argument_id, relation_id, comment_id) = 1),
	CONSTRAINT "evaluations_confidence_check" CHECK ("confidence" is null or "confidence" in ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE TABLE "involvements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"idea_id" uuid NOT NULL,
	"capacity" text NOT NULL,
	"status" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "involvements_capacity_check" CHECK ("capacity" in ('research', 'engineering', 'funding', 'entrepreneurship', 'policy', 'organizing', 'communication')),
	CONSTRAINT "involvements_status_check" CHECK ("status" in ('offering', 'active', 'concluded'))
);
--> statement-breakpoint
CREATE TABLE "stances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"idea_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone,
	CONSTRAINT "stances_kind_check" CHECK ("kind" in ('important', 'worth_researching', 'plausible', 'doubtful', 'ready_now'))
);
--> statement-breakpoint
CREATE TABLE "idea_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_idea_id" uuid NOT NULL,
	"to_idea_id" uuid NOT NULL,
	"type" text NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"proposed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone,
	"retracted_by" uuid,
	CONSTRAINT "idea_relations_not_self_check" CHECK (from_idea_id <> to_idea_id),
	CONSTRAINT "idea_relations_type_check" CHECK ("type" in ('requires', 'applies', 'extends', 'derived_from', 'alternative_to', 'complements', 'conflicts_with'))
);
--> statement-breakpoint
CREATE TABLE "initiatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"organization" text DEFAULT '' NOT NULL,
	"url" text,
	"status" text NOT NULL,
	"started_on" date,
	"ended_on" date,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "initiatives_kind_check" CHECK ("kind" in ('research', 'experiment', 'prototype', 'pilot', 'deployment', 'policy', 'funding', 'other')),
	CONSTRAINT "initiatives_status_check" CHECK ("status" in ('planned', 'active', 'completed', 'discontinued'))
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initiative_id" uuid NOT NULL,
	"result" text NOT NULL,
	"summary" text NOT NULL,
	"lessons" text DEFAULT '' NOT NULL,
	"source_id" uuid,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outcomes_result_check" CHECK ("result" in ('succeeded', 'partially_succeeded', 'failed', 'inconclusive'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"parent_id" uuid,
	"anchor_claim_id" uuid,
	"anchor_evidence_id" uuid,
	"anchor_argument_id" uuid,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "comments_single_anchor_check" CHECK (num_nonnulls(anchor_claim_id, anchor_evidence_id, anchor_argument_id) <= 1),
	CONSTRAINT "comments_kind_check" CHECK ("kind" in ('comment', 'question', 'suggestion'))
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"idea_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_metrics" (
	"idea_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"dispersion" double precision,
	"algorithm" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"details" jsonb,
	CONSTRAINT "idea_metrics_idea_id_metric_pk" PRIMARY KEY("idea_id","metric")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_expertise" ADD CONSTRAINT "person_expertise_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_expertise" ADD CONSTRAINT "person_expertise_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_expertise" ADD CONSTRAINT "person_expertise_verified_by_people_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_revisions" ADD CONSTRAINT "idea_revisions_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_revisions" ADD CONSTRAINT "idea_revisions_base_revision_id_idea_revisions_id_fk" FOREIGN KEY ("base_revision_id") REFERENCES "public"."idea_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_revisions" ADD CONSTRAINT "idea_revisions_author_id_people_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_revisions" ADD CONSTRAINT "idea_revisions_decided_by_people_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_stewards" ADD CONSTRAINT "idea_stewards_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_stewards" ADD CONSTRAINT "idea_stewards_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_stewards" ADD CONSTRAINT "idea_stewards_granted_by_people_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_topics" ADD CONSTRAINT "idea_topics_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_topics" ADD CONSTRAINT "idea_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_proposed_by_people_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_current_revision_id_idea_revisions_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "public"."idea_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_decided_by_people_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_initiative_id_initiatives_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arguments" ADD CONSTRAINT "arguments_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arguments" ADD CONSTRAINT "arguments_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arguments" ADD CONSTRAINT "arguments_parent_argument_id_arguments_id_fk" FOREIGN KEY ("parent_argument_id") REFERENCES "public"."arguments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arguments" ADD CONSTRAINT "arguments_author_id_people_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_outcome_id_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_contributed_by_people_id_fk" FOREIGN KEY ("contributed_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_claims" ADD CONSTRAINT "idea_claims_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_claims" ADD CONSTRAINT "idea_claims_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_claims" ADD CONSTRAINT "idea_claims_added_by_people_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_claims" ADD CONSTRAINT "idea_claims_removed_by_people_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_registered_by_people_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_id_people_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_argument_id_arguments_id_fk" FOREIGN KEY ("argument_id") REFERENCES "public"."arguments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_relation_id_idea_relations_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."idea_relations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "involvements" ADD CONSTRAINT "involvements_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "involvements" ADD CONSTRAINT "involvements_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stances" ADD CONSTRAINT "stances_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stances" ADD CONSTRAINT "stances_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_relations" ADD CONSTRAINT "idea_relations_from_idea_id_ideas_id_fk" FOREIGN KEY ("from_idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_relations" ADD CONSTRAINT "idea_relations_to_idea_id_ideas_id_fk" FOREIGN KEY ("to_idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_relations" ADD CONSTRAINT "idea_relations_proposed_by_people_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_relations" ADD CONSTRAINT "idea_relations_retracted_by_people_id_fk" FOREIGN KEY ("retracted_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_created_by_people_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_initiative_id_initiatives_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_recorded_by_people_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_anchor_claim_id_claims_id_fk" FOREIGN KEY ("anchor_claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_anchor_evidence_id_evidence_id_fk" FOREIGN KEY ("anchor_evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_anchor_argument_id_arguments_id_fk" FOREIGN KEY ("anchor_argument_id") REFERENCES "public"."arguments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_people_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_people_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_metrics" ADD CONSTRAINT "idea_metrics_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "people_handle_key" ON "people" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "person_expertise_current_key" ON "person_expertise" USING btree ("person_id","topic_id","basis") WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX "person_expertise_topic_idx" ON "person_expertise" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_person_idx" ON "sessions" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_slug_key" ON "topics" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "topics_parent_idx" ON "topics" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idea_revisions_number_key" ON "idea_revisions" USING btree ("idea_id","number");--> statement-breakpoint
CREATE INDEX "idea_revisions_idea_status_idx" ON "idea_revisions" USING btree ("idea_id","status");--> statement-breakpoint
CREATE INDEX "idea_revisions_author_idx" ON "idea_revisions" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idea_stewards_current_key" ON "idea_stewards" USING btree ("idea_id","person_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX "idea_stewards_person_idx" ON "idea_stewards" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idea_topics_topic_idx" ON "idea_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ideas_slug_key" ON "ideas" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ideas_created_at_idx" ON "ideas" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ideas_stage_idx" ON "ideas" USING btree ("stage","stage_changed_at");--> statement-breakpoint
CREATE INDEX "ideas_proposed_by_idx" ON "ideas" USING btree ("proposed_by");--> statement-breakpoint
CREATE INDEX "ideas_tags_idx" ON "ideas" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "ideas_search_idx" ON "ideas" USING gin ("search");--> statement-breakpoint
CREATE INDEX "stage_transitions_idea_idx" ON "stage_transitions" USING btree ("idea_id","occurred_at");--> statement-breakpoint
CREATE INDEX "arguments_idea_idx" ON "arguments" USING btree ("idea_id");--> statement-breakpoint
CREATE INDEX "arguments_claim_idx" ON "arguments" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "arguments_parent_idx" ON "arguments" USING btree ("parent_argument_id");--> statement-breakpoint
CREATE INDEX "arguments_author_idx" ON "arguments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "claims_search_idx" ON "claims" USING gin ("search");--> statement-breakpoint
CREATE INDEX "claims_created_by_idx" ON "claims" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "evidence_claim_idx" ON "evidence" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "evidence_source_idx" ON "evidence" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "evidence_contributor_idx" ON "evidence" USING btree ("contributed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_claim_source_key" ON "evidence" USING btree ("claim_id","source_id") WHERE withdrawn_at is null and source_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_claim_outcome_key" ON "evidence" USING btree ("claim_id","outcome_id") WHERE withdrawn_at is null and outcome_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idea_claims_current_key" ON "idea_claims" USING btree ("idea_id","claim_id","role") WHERE removed_at is null;--> statement-breakpoint
CREATE INDEX "idea_claims_claim_idx" ON "idea_claims" USING btree ("claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_doi_key" ON "sources" USING btree ("doi") WHERE doi is not null;--> statement-breakpoint
CREATE INDEX "sources_url_idx" ON "sources" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_current_key" ON "evaluations" USING btree ("evaluator_id","target_id","dimension") WHERE superseded_at is null;--> statement-breakpoint
CREATE INDEX "evaluations_target_current_idx" ON "evaluations" USING btree ("target_id","dimension") WHERE superseded_at is null;--> statement-breakpoint
CREATE INDEX "evaluations_target_history_idx" ON "evaluations" USING btree ("target_id","created_at");--> statement-breakpoint
CREATE INDEX "evaluations_evaluator_idx" ON "evaluations" USING btree ("evaluator_id","created_at");--> statement-breakpoint
CREATE INDEX "evaluations_submission_idx" ON "evaluations" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "involvements_current_key" ON "involvements" USING btree ("person_id","idea_id","capacity") WHERE superseded_at is null;--> statement-breakpoint
CREATE INDEX "involvements_idea_current_idx" ON "involvements" USING btree ("idea_id","capacity") WHERE superseded_at is null;--> statement-breakpoint
CREATE INDEX "involvements_person_idx" ON "involvements" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stances_current_key" ON "stances" USING btree ("person_id","idea_id","kind") WHERE retracted_at is null;--> statement-breakpoint
CREATE INDEX "stances_idea_current_idx" ON "stances" USING btree ("idea_id","kind") WHERE retracted_at is null;--> statement-breakpoint
CREATE INDEX "stances_idea_created_idx" ON "stances" USING btree ("idea_id","created_at");--> statement-breakpoint
CREATE INDEX "stances_person_idx" ON "stances" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idea_relations_current_key" ON "idea_relations" USING btree ("from_idea_id","to_idea_id","type") WHERE retracted_at is null;--> statement-breakpoint
CREATE INDEX "idea_relations_from_idx" ON "idea_relations" USING btree ("from_idea_id","type") WHERE retracted_at is null;--> statement-breakpoint
CREATE INDEX "idea_relations_to_idx" ON "idea_relations" USING btree ("to_idea_id","type") WHERE retracted_at is null;--> statement-breakpoint
CREATE INDEX "initiatives_idea_idx" ON "initiatives" USING btree ("idea_id");--> statement-breakpoint
CREATE INDEX "initiatives_created_by_idx" ON "initiatives" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "outcomes_initiative_idx" ON "outcomes" USING btree ("initiative_id");--> statement-breakpoint
CREATE INDEX "comments_idea_idx" ON "comments" USING btree ("idea_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "activities_ideas_idx" ON "activities" USING gin ("idea_ids");--> statement-breakpoint
CREATE INDEX "activities_actor_idx" ON "activities" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activities_subject_idx" ON "activities" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "activities_occurred_idx" ON "activities" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "activities_action_idx" ON "activities" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX "idea_metrics_metric_value_idx" ON "idea_metrics" USING btree ("metric","value");