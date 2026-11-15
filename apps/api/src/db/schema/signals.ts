import { sql } from "drizzle-orm";
import { check, doublePrecision, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  CAPACITIES,
  CONFIDENCE_LEVELS,
  INVOLVEMENT_STATUSES,
  STANCE_KINDS,
  type Capacity,
  type ConfidenceLevel,
  type EvaluationTargetKind,
  type InvolvementStatus,
  type StanceKind,
} from "@ideaproxima/domain";
import { createdAt, inList, nullOrInList, pk, tstz } from "./_columns";
import { comments } from "./discussion";
import { ideaRelations } from "./graph";
import { ideas } from "./ideas";
import { argumentsTable, claims, evidence } from "./knowledge";
import { people } from "./people";

/**
 * EVALUATIONS — the raw observations every quality signal is derived from.
 *
 * One row = one person's rating of one target on one dimension at one moment. Design choices:
 *  - Long/narrow (one row per dimension) so dimensions can be added or retired without migrations, partial
 *    evaluations are natural ("I don't know" = no row), and each rating carries its own confidence.
 *  - Append-only: re-rating supersedes (sets `superseded_at` on) the previous row instead of overwriting it,
 *    so "when did the community's opinion change?" is answerable and calibration can be scored later.
 *  - Exactly one typed foreign key is set (real referential integrity); `target_kind`/`target_id` are generated
 *    columns that give scoring code a uniform view across target types.
 *  - Nothing here is weighted. Weights are a property of the *derivation*, not of the fact.
 */
export const evaluations = pgTable(
  "evaluations",
  {
    id: pk(),
    /** Groups ratings submitted together, so a multi-dimension assessment can be reconstructed with its rationale. */
    submissionId: uuid("submission_id").notNull(),
    evaluatorId: uuid("evaluator_id")
      .notNull()
      .references(() => people.id),

    ideaId: uuid("idea_id").references(() => ideas.id),
    claimId: uuid("claim_id").references(() => claims.id),
    evidenceId: uuid("evidence_id").references(() => evidence.id),
    argumentId: uuid("argument_id").references(() => argumentsTable.id),
    relationId: uuid("relation_id").references(() => ideaRelations.id),
    commentId: uuid("comment_id").references(() => comments.id),

    targetKind: text("target_kind")
      .$type<EvaluationTargetKind>()
      .generatedAlwaysAs(
        sql`case when idea_id is not null then 'idea' when claim_id is not null then 'claim' when evidence_id is not null then 'evidence' when argument_id is not null then 'argument' when relation_id is not null then 'relation' when comment_id is not null then 'comment' end`,
      ),
    targetId: uuid("target_id").generatedAlwaysAs(
      sql`coalesce(idea_id, claim_id, evidence_id, argument_id, relation_id, comment_id)`,
    ),

    /** Dimension key from the domain vocabulary. Intentionally no CHECK: the dimension set is expected to evolve. */
    dimension: text("dimension").notNull(),
    value: doublePrecision("value").notNull(),
    confidence: text("confidence").$type<ConfidenceLevel>(),
    rationale: text("rationale").notNull().default(""),
    createdAt: createdAt(),
    supersededAt: tstz("superseded_at"),
  },
  (t) => [
    check(
      "evaluations_single_target_check",
      sql`num_nonnulls(idea_id, claim_id, evidence_id, argument_id, relation_id, comment_id) = 1`,
    ),
    check("evaluations_confidence_check", nullOrInList("confidence", CONFIDENCE_LEVELS)),
    uniqueIndex("evaluations_current_key")
      .on(t.evaluatorId, t.targetId, t.dimension)
      .where(sql`superseded_at is null`),
    index("evaluations_target_current_idx")
      .on(t.targetId, t.dimension)
      .where(sql`superseded_at is null`),
    index("evaluations_target_history_idx").on(t.targetId, t.createdAt),
    index("evaluations_evaluator_idx").on(t.evaluatorId, t.createdAt),
    index("evaluations_submission_idx").on(t.submissionId),
  ],
);

/**
 * STANCES — lightweight community perspectives ("important", "worth researching", "plausible"…).
 *
 * This is the "community voting" signal of concept.txt. It lives apart from evaluations so that popularity can
 * never leak into quality metrics by accident: different table, different derivations, different lenses.
 * Retracting sets `retracted_at`; the row stays, preserving the timeline of opinion.
 */
export const stances = pgTable(
  "stances",
  {
    id: pk(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    kind: text("kind").$type<StanceKind>().notNull(),
    createdAt: createdAt(),
    retractedAt: tstz("retracted_at"),
  },
  (t) => [
    uniqueIndex("stances_current_key")
      .on(t.personId, t.ideaId, t.kind)
      .where(sql`retracted_at is null`),
    index("stances_idea_current_idx")
      .on(t.ideaId, t.kind)
      .where(sql`retracted_at is null`),
    index("stances_idea_created_idx").on(t.ideaId, t.createdAt),
    index("stances_person_idx").on(t.personId),
    check("stances_kind_check", inList("kind", STANCE_KINDS)),
  ],
);

/**
 * INVOLVEMENTS — "I can research / build / fund this", "I am working on this".
 *
 * The bridge between ideas and the people capable of advancing them (concept.txt: connect ideas with
 * scientists, engineers, funders, organisations). Status changes supersede the previous row, so the record of
 * who was involved, in what capacity and when, survives.
 */
export const involvements = pgTable(
  "involvements",
  {
    id: pk(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    capacity: text("capacity").$type<Capacity>().notNull(),
    status: text("status").$type<InvolvementStatus>().notNull(),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
    supersededAt: tstz("superseded_at"),
  },
  (t) => [
    uniqueIndex("involvements_current_key")
      .on(t.personId, t.ideaId, t.capacity)
      .where(sql`superseded_at is null`),
    index("involvements_idea_current_idx")
      .on(t.ideaId, t.capacity)
      .where(sql`superseded_at is null`),
    index("involvements_person_idx").on(t.personId),
    check("involvements_capacity_check", inList("capacity", CAPACITIES)),
    check("involvements_status_check", inList("status", INVOLVEMENT_STATUSES)),
  ],
);
