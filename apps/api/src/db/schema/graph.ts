import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { RELATION_TYPES, type RelationType } from "@ideaproxima/domain";
import { createdAt, inList, pk, tstz } from "./_columns";
import { ideas } from "./ideas";
import { people } from "./people";

/**
 * IDEA RELATIONS — the typed graph between ideas (see the vocabulary in @ideaproxima/domain for semantics).
 *
 * Stored as a plain adjacency table in Postgres rather than a graph database: traversals of the depth the product
 * needs (≤ 4 hops, "what does realising this unlock?") are cheap with recursive CTEs over the partial indexes
 * below, and keeping one database keeps transactions, backups and integrity simple. Revisit only if traversal
 * depth or graph analytics outgrow this (recorded in docs/agents/open-questions.md).
 *
 * A relation is itself a claim ("A requires B") — so it is attributed, can be evaluated for `validity`, and is
 * retracted rather than deleted.
 */
export const ideaRelations = pgTable(
  "idea_relations",
  {
    id: pk(),
    fromIdeaId: uuid("from_idea_id")
      .notNull()
      .references(() => ideas.id),
    toIdeaId: uuid("to_idea_id")
      .notNull()
      .references(() => ideas.id),
    type: text("type").$type<RelationType>().notNull(),
    rationale: text("rationale").notNull().default(""),
    proposedBy: uuid("proposed_by")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
    retractedAt: tstz("retracted_at"),
    retractedBy: uuid("retracted_by").references(() => people.id),
  },
  (t) => [
    check("idea_relations_not_self_check", sql`from_idea_id <> to_idea_id`),
    check("idea_relations_type_check", inList("type", RELATION_TYPES)),
    uniqueIndex("idea_relations_current_key")
      .on(t.fromIdeaId, t.toIdeaId, t.type)
      .where(sql`retracted_at is null`),
    index("idea_relations_from_idx")
      .on(t.fromIdeaId, t.type)
      .where(sql`retracted_at is null`),
    index("idea_relations_to_idx")
      .on(t.toIdeaId, t.type)
      .where(sql`retracted_at is null`),
  ],
);
