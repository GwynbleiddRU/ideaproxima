import { check, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import {
  INITIATIVE_KINDS,
  INITIATIVE_STATUSES,
  OUTCOME_RESULTS,
  type InitiativeKind,
  type InitiativeStatus,
  type OutcomeResult,
} from "@ideaproxima/domain";
import { createdAt, inList, pk, tstz } from "./_columns";
import { ideas } from "./ideas";
import { sources } from "./knowledge";
import { people } from "./people";

/**
 * INITIATIVES — concrete action taken on an idea in the world: research, experiments, prototypes, pilots,
 * deployments, policy, funding. This is how the platform preserves "who acted on it, what was tried".
 * Status is mutable current state; every status change is also written to the activity ledger.
 */
export const initiatives = pgTable(
  "initiatives",
  {
    id: pk(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    kind: text("kind").$type<InitiativeKind>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** Free text for now; organisation accounts are future work (docs/agents/open-questions.md). */
    organization: text("organization").notNull().default(""),
    url: text("url"),
    status: text("status").$type<InitiativeStatus>().notNull(),
    startedOn: date("started_on"),
    endedOn: date("ended_on"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
    hiddenAt: tstz("hidden_at"),
  },
  (t) => [
    index("initiatives_idea_idx").on(t.ideaId),
    index("initiatives_created_by_idx").on(t.createdBy),
    check("initiatives_kind_check", inList("kind", INITIATIVE_KINDS)),
    check("initiatives_status_check", inList("status", INITIATIVE_STATUSES)),
  ],
);

/**
 * OUTCOMES — what an initiative produced: success, failure, or inconclusive, and what was learned.
 * Append-only. Failed outcomes are first-class knowledge (concept.txt: "what failed and what was learned").
 * An outcome can be cited as evidence for or against specific claims (evidence.outcome_id).
 */
export const outcomes = pgTable(
  "outcomes",
  {
    id: pk(),
    initiativeId: uuid("initiative_id")
      .notNull()
      .references(() => initiatives.id),
    result: text("result").$type<OutcomeResult>().notNull(),
    summary: text("summary").notNull(),
    lessons: text("lessons").notNull().default(""),
    sourceId: uuid("source_id").references(() => sources.id),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => people.id),
    recordedAt: createdAt("recorded_at"),
  },
  (t) => [
    index("outcomes_initiative_idx").on(t.initiativeId),
    check("outcomes_result_check", inList("result", OUTCOME_RESULTS)),
  ],
);
