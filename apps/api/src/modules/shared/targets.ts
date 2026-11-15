import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "@ideaproxima/domain";
import type { Database } from "../../db/client";
import {
  argumentsTable,
  claims,
  comments,
  evidence,
  ideaClaims,
  ideaRelations,
  ideas,
  initiatives,
} from "../../db/schema";
import { isModerator, type Ctx } from "./context";

/**
 * Resolution of polymorphic targets (things that can be evaluated or moderated): does it exist, who created it,
 * and which ideas' timelines and metrics does an action on it touch.
 */
export type TargetKind = "idea" | "claim" | "evidence" | "argument" | "relation" | "comment" | "initiative";

export interface ResolvedTarget {
  kind: TargetKind;
  id: string;
  creatorId: string;
  hidden: boolean;
  ideaIds: string[];
}

/** Ideas that currently rely on a claim. */
export async function ideasUsingClaim(db: Database, claimId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ ideaId: ideaClaims.ideaId })
    .from(ideaClaims)
    .where(and(eq(ideaClaims.claimId, claimId), isNull(ideaClaims.removedAt)));
  return rows.map((r) => r.ideaId);
}

/** Ideas an argument ultimately concerns, walking up rebuttal chains. */
export async function ideasForArgument(db: Database, argumentId: string, depth = 0): Promise<string[]> {
  const [a] = await db.select().from(argumentsTable).where(eq(argumentsTable.id, argumentId));
  if (!a || depth > 50) return [];
  if (a.ideaId) return [a.ideaId];
  if (a.claimId) return ideasUsingClaim(db, a.claimId);
  return a.parentArgumentId ? ideasForArgument(db, a.parentArgumentId, depth + 1) : [];
}

/** Loads a target; hidden targets are not found for non-moderators. */
export async function resolveTarget(ctx: Ctx, kind: TargetKind, id: string): Promise<ResolvedTarget> {
  const db = ctx.db;
  let found: Omit<ResolvedTarget, "kind" | "id"> | null = null;
  switch (kind) {
    case "idea": {
      const [r] = await db.select().from(ideas).where(eq(ideas.id, id));
      if (r) found = { creatorId: r.proposedBy, hidden: !!r.hiddenAt, ideaIds: [r.id] };
      break;
    }
    case "claim": {
      const [r] = await db.select().from(claims).where(eq(claims.id, id));
      if (r)
        found = { creatorId: r.createdBy, hidden: !!r.hiddenAt, ideaIds: await ideasUsingClaim(db, r.id) };
      break;
    }
    case "evidence": {
      const [r] = await db.select().from(evidence).where(eq(evidence.id, id));
      if (r)
        found = {
          creatorId: r.contributedBy,
          hidden: !!r.hiddenAt,
          ideaIds: await ideasUsingClaim(db, r.claimId),
        };
      break;
    }
    case "argument": {
      const [r] = await db.select().from(argumentsTable).where(eq(argumentsTable.id, id));
      if (r)
        found = { creatorId: r.authorId, hidden: !!r.hiddenAt, ideaIds: await ideasForArgument(db, r.id) };
      break;
    }
    case "relation": {
      const [r] = await db.select().from(ideaRelations).where(eq(ideaRelations.id, id));
      if (r)
        found = { creatorId: r.proposedBy, hidden: !!r.retractedAt, ideaIds: [r.fromIdeaId, r.toIdeaId] };
      break;
    }
    case "comment": {
      const [r] = await db.select().from(comments).where(eq(comments.id, id));
      if (r) found = { creatorId: r.authorId, hidden: !!r.hiddenAt, ideaIds: [r.ideaId] };
      break;
    }
    case "initiative": {
      const [r] = await db.select().from(initiatives).where(eq(initiatives.id, id));
      if (r) found = { creatorId: r.createdBy, hidden: !!r.hiddenAt, ideaIds: [r.ideaId] };
      break;
    }
  }
  if (!found || (found.hidden && !isModerator(ctx))) throw notFound(kind[0]!.toUpperCase() + kind.slice(1));
  return { kind, id, ...found };
}
