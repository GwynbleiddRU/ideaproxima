import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { COMMENT_KINDS, type CommentKind } from "@ideaproxima/domain";
import { createdAt, inList, pk, tstz } from "./_columns";
import { ideas } from "./ideas";
import { argumentsTable, claims, evidence } from "./knowledge";
import { people } from "./people";

/**
 * COMMENTS — threaded conversation about an idea, optionally anchored to a specific claim, piece of evidence
 * or argument. Comments are deliberately low-ceremony; anything that should count as knowledge (a critique, a
 * source, a counterargument) has a first-class home elsewhere and the UI should nudge people there.
 * Comments are not editable (conversation history stays honest) and are hidden, not deleted, by moderation.
 */
export const comments = pgTable(
  "comments",
  {
    id: pk(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id),
    anchorClaimId: uuid("anchor_claim_id").references(() => claims.id),
    anchorEvidenceId: uuid("anchor_evidence_id").references(() => evidence.id),
    anchorArgumentId: uuid("anchor_argument_id").references(() => argumentsTable.id),
    kind: text("kind").$type<CommentKind>().notNull(),
    body: text("body").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => people.id),
    createdAt: createdAt(),
    hiddenAt: tstz("hidden_at"),
  },
  (t) => [
    index("comments_idea_idx").on(t.ideaId, t.createdAt),
    index("comments_parent_idx").on(t.parentId),
    index("comments_author_idx").on(t.authorId),
    check(
      "comments_single_anchor_check",
      sql`num_nonnulls(anchor_claim_id, anchor_evidence_id, anchor_argument_id) <= 1`,
    ),
    check("comments_kind_check", inList("kind", COMMENT_KINDS)),
  ],
);
