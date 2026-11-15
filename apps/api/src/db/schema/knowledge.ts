import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  ARGUMENT_STANCES,
  CLAIM_ROLES,
  EVIDENCE_STANCES,
  SOURCE_KINDS,
  type ArgumentStance,
  type ClaimRole,
  type EvidenceStance,
  type SourceKind,
} from "@ideaproxima/domain";
import { createdAt, inList, pk, tstz, tsvector } from "./_columns";
import { ideas } from "./ideas";
import { people } from "./people";
import { outcomes } from "./practice";

/**
 * CLAIMS — atomic, independently assessable statements.
 *
 * A claim does NOT belong to one idea. "Nanoscale devices can harvest energy from their medium" can underpin many
 * ideas; evidence attached to it once informs all of them. That cross-idea sharing is what turns the archive into
 * a knowledge graph a scientist can navigate. Claims are immutable — rewording changes meaning, and evidence was
 * attached to the original wording — so corrections are new claims.
 * A claim's epistemic status is never stored: it is derived from evaluations (see deriveClaimStatus).
 */
export const claims = pgTable(
  "claims",
  {
    id: pk(),
    statement: text("statement").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
    hiddenAt: tstz("hidden_at"),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('english', statement)`),
  },
  (t) => [index("claims_search_idx").using("gin", t.search), index("claims_created_by_idx").on(t.createdBy)],
);

/** How a claim functions within one idea (premise, mechanism, prerequisite, consequence, risk). Unlinking is recorded, not deleted. */
export const ideaClaims = pgTable(
  "idea_claims",
  {
    id: pk(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id),
    role: text("role").$type<ClaimRole>().notNull(),
    /** Consequence-tree depth (1 immediate … 4 civilizational); only for consequences and risks. */
    depth: smallint("depth"),
    position: integer("position").notNull().default(0),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => people.id),
    addedAt: createdAt("added_at"),
    removedAt: tstz("removed_at"),
    removedBy: uuid("removed_by").references(() => people.id),
  },
  (t) => [
    uniqueIndex("idea_claims_current_key")
      .on(t.ideaId, t.claimId, t.role)
      .where(sql`removed_at is null`),
    index("idea_claims_claim_idx").on(t.claimId),
    check("idea_claims_role_check", inList("role", CLAIM_ROLES)),
    check(
      "idea_claims_depth_check",
      sql`depth is null or (depth between 1 and 4 and role in ('consequence', 'risk'))`,
    ),
  ],
);

/**
 * SOURCES — bibliographic facts about the world (papers, datasets, patents, reports…), deduplicated by DOI so
 * one publication cited from ten claims is one row. A source says nothing about any claim by itself; the
 * `evidence` row is where a contributor asserts what the source shows.
 */
export const sources = pgTable(
  "sources",
  {
    id: pk(),
    kind: text("kind").$type<SourceKind>().notNull(),
    title: text("title").notNull(),
    authors: text("authors").notNull().default(""),
    venue: text("venue").notNull().default(""),
    publishedYear: integer("published_year"),
    doi: text("doi"),
    url: text("url"),
    registeredBy: uuid("registered_by")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sources_doi_key")
      .on(t.doi)
      .where(sql`doi is not null`),
    index("sources_url_idx").on(t.url),
    check("sources_kind_check", inList("kind", SOURCE_KINDS)),
  ],
);

/**
 * EVIDENCE — the assertion "this source (or this recorded outcome) bears on this claim, in this direction".
 *
 * Attached to claims, not ideas, so that evidence is specific: the design's evidence drawer asks both "what it
 * supports" and "what it does NOT establish" (`limitations`). Evidence is never edited or deleted; it is
 * withdrawn (with a reason) or superseded by new evidence, so "what evidence existed at time T" is answerable.
 * Its quality and relevance are evaluations by others, not fields here.
 */
export const evidence = pgTable(
  "evidence",
  {
    id: pk(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id),
    sourceId: uuid("source_id").references(() => sources.id),
    outcomeId: uuid("outcome_id").references((): AnyPgColumn => outcomes.id),
    stance: text("stance").$type<EvidenceStance>().notNull(),
    summary: text("summary").notNull(),
    limitations: text("limitations").notNull().default(""),
    locator: text("locator").notNull().default(""),
    contributedBy: uuid("contributed_by")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
    withdrawnAt: tstz("withdrawn_at"),
    withdrawnReason: text("withdrawn_reason").notNull().default(""),
    hiddenAt: tstz("hidden_at"),
  },
  (t) => [
    index("evidence_claim_idx").on(t.claimId),
    index("evidence_source_idx").on(t.sourceId),
    index("evidence_contributor_idx").on(t.contributedBy),
    uniqueIndex("evidence_claim_source_key")
      .on(t.claimId, t.sourceId)
      .where(sql`withdrawn_at is null and source_id is not null`),
    uniqueIndex("evidence_claim_outcome_key")
      .on(t.claimId, t.outcomeId)
      .where(sql`withdrawn_at is null and outcome_id is not null`),
    check("evidence_basis_check", sql`num_nonnulls(source_id, outcome_id) = 1`),
    check("evidence_stance_check", inList("stance", EVIDENCE_STANCES)),
  ],
);

/**
 * ARGUMENTS — structured reasoning for or against an idea, a claim, or another argument (rebuttal chains).
 * Distinct from comments: arguments are part of the epistemic record ("Challenges & counterarguments") and are
 * assessed for strength; comments are conversation.
 */
export const argumentsTable = pgTable(
  "arguments",
  {
    id: pk(),
    ideaId: uuid("idea_id").references(() => ideas.id),
    claimId: uuid("claim_id").references(() => claims.id),
    parentArgumentId: uuid("parent_argument_id").references((): AnyPgColumn => argumentsTable.id),
    stance: text("stance").$type<ArgumentStance>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
    withdrawnAt: tstz("withdrawn_at"),
    hiddenAt: tstz("hidden_at"),
  },
  (t) => [
    index("arguments_idea_idx").on(t.ideaId),
    index("arguments_claim_idx").on(t.claimId),
    index("arguments_parent_idx").on(t.parentArgumentId),
    index("arguments_author_idx").on(t.authorId),
    check("arguments_target_check", sql`num_nonnulls(idea_id, claim_id, parent_argument_id) = 1`),
    check("arguments_stance_check", inList("stance", ARGUMENT_STANCES)),
  ],
);
