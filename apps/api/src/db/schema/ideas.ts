import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  IDEA_STAGES,
  REVISION_STATUSES,
  STEWARD_ROLES,
  type IdeaContent,
  type IdeaStage,
  type RevisionStatus,
  type StewardRole,
} from "@ideaproxima/domain";
import { createdAt, inList, nullOrInList, pk, tstz, tsvector } from "./_columns";
import { people, topics } from "./people";
import { initiatives } from "./practice";

/**
 * IDEAS — the stable identity of an idea, plus a *projection* of its current state.
 *
 *  - Identity & provenance (immutable): id, slug, proposed_by, created_at.
 *  - Content projection: title / summary / tags / updated_at mirror the current accepted revision. They exist
 *    for listing and full-text search; the authoritative content is `idea_revisions`.
 *  - Lifecycle projection: stage / stage_changed_at mirror the latest row in `stage_transitions`.
 *
 * Projections are only ever written by the service that appends the underlying fact, in the same transaction.
 * Ideas are never deleted; moderation hides them (`hidden_at`) and records why in the activity ledger.
 */
export const ideas = pgTable(
  "ideas",
  {
    id: pk(),
    slug: text("slug").notNull(),
    proposedBy: uuid("proposed_by")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),

    currentRevisionId: uuid("current_revision_id").references((): AnyPgColumn => ideaRevisions.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    updatedAt: tstz("updated_at").notNull().defaultNow(),

    stage: text("stage").$type<IdeaStage>().notNull().default("imagined"),
    stageChangedAt: tstz("stage_changed_at").notNull().defaultNow(),

    hiddenAt: tstz("hidden_at"),

    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '')), 'B')`,
    ),
  },
  (t) => [
    uniqueIndex("ideas_slug_key").on(t.slug),
    index("ideas_created_at_idx").on(t.createdAt),
    index("ideas_stage_idx").on(t.stage, t.stageChangedAt),
    index("ideas_proposed_by_idx").on(t.proposedBy),
    index("ideas_tags_idx").using("gin", t.tags),
    index("ideas_search_idx").using("gin", t.search),
    check("ideas_stage_check", inList("stage", IDEA_STAGES)),
  ],
);

/**
 * IDEA REVISIONS — the immutable history of an idea's content ("How did the idea change? Who contributed the
 * important development?").
 *
 * Every revision is a full snapshot (not a diff): snapshots are trivially correct, diffs can always be computed
 * on read, and storage is cheap compared to the value of an unambiguous record. Anyone may *propose* a revision;
 * stewards accept or reject it. Content columns are protected by a database trigger; only the decision fields
 * may change, and only once.
 */
export const ideaRevisions = pgTable(
  "idea_revisions",
  {
    id: pk(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    /** Sequential per idea, assigned at creation (proposals get numbers too). */
    number: integer("number").notNull(),
    /** The revision the author started from — enables optimistic concurrency and three-way diffs. */
    baseRevisionId: uuid("base_revision_id").references((): AnyPgColumn => ideaRevisions.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => people.id),
    changeNote: text("change_note").notNull().default(""),
    content: jsonb("content").$type<IdeaContent>().notNull(),
    status: text("status").$type<RevisionStatus>().notNull(),
    decidedBy: uuid("decided_by").references(() => people.id),
    decidedAt: tstz("decided_at"),
    decisionNote: text("decision_note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("idea_revisions_number_key").on(t.ideaId, t.number),
    index("idea_revisions_idea_status_idx").on(t.ideaId, t.status),
    index("idea_revisions_author_idx").on(t.authorId),
    check("idea_revisions_status_check", inList("status", REVISION_STATUSES)),
  ],
);

/** Current topics of an idea — projection of the current revision's `content.topics`. Ordered; first = primary. */
export const ideaTopics = pgTable(
  "idea_topics",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.topicId] }), index("idea_topics_topic_idx").on(t.topicId)],
);

/**
 * STEWARDS — who may publish an idea's narrative and decide on proposed revisions. Time-ranged rather than a
 * flag, so "was this evaluator a steward of the idea at the time?" stays answerable (self-assessment detection).
 */
export const ideaStewards = pgTable(
  "idea_stewards",
  {
    id: pk(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    role: text("role").$type<StewardRole>().notNull(),
    grantedBy: uuid("granted_by").references(() => people.id),
    grantedAt: createdAt("granted_at"),
    revokedAt: tstz("revoked_at"),
  },
  (t) => [
    uniqueIndex("idea_stewards_current_key")
      .on(t.ideaId, t.personId)
      .where(sql`revoked_at is null`),
    index("idea_stewards_person_idx").on(t.personId),
    check("idea_stewards_role_check", inList("role", STEWARD_ROLES)),
  ],
);

/**
 * STAGE TRANSITIONS — the lifecycle history ("When did the idea move from speculation to experimental support?").
 * Append-only. `ideas.stage` is a projection of the latest row.
 */
export const stageTransitions = pgTable(
  "stage_transitions",
  {
    id: pk(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    fromStage: text("from_stage").$type<IdeaStage>(),
    toStage: text("to_stage").$type<IdeaStage>().notNull(),
    rationale: text("rationale").notNull(),
    decidedBy: uuid("decided_by")
      .notNull()
      .references(() => people.id),
    initiativeId: uuid("initiative_id").references((): AnyPgColumn => initiatives.id),
    occurredAt: createdAt("occurred_at"),
  },
  (t) => [
    index("stage_transitions_idea_idx").on(t.ideaId, t.occurredAt),
    check("stage_transitions_to_check", inList("to_stage", IDEA_STAGES)),
    check("stage_transitions_from_check", nullOrInList("from_stage", IDEA_STAGES)),
  ],
);
