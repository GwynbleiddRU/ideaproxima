import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, pk } from "./_columns";
import { people } from "./people";

/**
 * ACTIVITY LEDGER — an append-only record of every domain action: who did what, to which subject, when.
 *
 * Facts still live in their own tables (an evaluation row *is* the evaluation). The ledger is the cross-cutting
 * index over them, written in the same transaction as the fact. It powers:
 *  - idea timelines ("how did this idea evolve?"),
 *  - contribution histories per person (the raw material for contribution-based reputation),
 *  - the public moderation log (hide/restore are activities with reasons),
 *  - future notifications and data exports.
 * This is deliberately NOT event sourcing: state is not rebuilt from the ledger, so it can stay simple.
 */
export const activities = pgTable(
  "activities",
  {
    id: pk(),
    occurredAt: createdAt("occurred_at"),
    /** Null only for system actions (migrations, maintenance jobs). */
    actorId: uuid("actor_id").references(() => people.id),
    /** Dotted verb, e.g. "idea.proposed", "evidence.attached", "moderation.hidden". */
    action: text("action").notNull(),
    /**
     * Every idea whose timeline this activity belongs to. An array (not a single FK) because knowledge is shared:
     * evidence attached to a claim belongs to the history of every idea that relies on that claim.
     * Element FKs cannot be declared in Postgres; the service layer only ever writes ids of existing ideas.
     */
    ideaIds: uuid("idea_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    subjectKind: text("subject_kind").notNull(),
    subjectId: uuid("subject_id").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    index("activities_ideas_idx").using("gin", t.ideaIds),
    index("activities_actor_idx").on(t.actorId, t.occurredAt),
    index("activities_subject_idx").on(t.subjectId),
    index("activities_occurred_idx").on(t.occurredAt),
    index("activities_action_idx").on(t.action, t.occurredAt),
  ],
);
