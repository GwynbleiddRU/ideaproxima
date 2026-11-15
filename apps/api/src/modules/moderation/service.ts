import { eq, sql } from "drizzle-orm";
import type { ModerationRequest } from "@ideaproxima/contracts";
import { DomainError, authorize } from "@ideaproxima/domain";
import { argumentsTable, claims, comments, evidence, ideas, initiatives } from "../../db/schema";
import { refreshIdeaMetrics } from "../metrics/service";
import { recordActivity, type SubjectKind } from "../shared/activity";
import { inTransaction, type Ctx } from "../shared/context";
import { resolveTarget } from "../shared/targets";

const TABLES = {
  idea: ideas,
  claim: claims,
  evidence,
  argument: argumentsTable,
  comment: comments,
  initiative: initiatives,
} as const;

/**
 * Hides or restores content. Moderation never deletes: hidden content stays in the archive (visible to
 * moderators), and every action is recorded in the public activity ledger with its reason — the moderation log
 * is part of the platform's history, not a private back office.
 */
export async function moderate(ctx: Ctx, input: ModerationRequest): Promise<{ hidden: boolean }> {
  authorize(ctx.actor, "content.moderate");
  return inTransaction(ctx, async (tx) => {
    const target = await resolveTarget(tx, input.target.kind, input.target.id);
    const hide = input.action === "hide";
    if (target.hidden === hide) throw new DomainError("conflict", hide ? "Already hidden." : "Not hidden.");
    const table = TABLES[input.target.kind];
    await tx.db
      .update(table)
      .set({ hiddenAt: hide ? sql`now()` : null })
      .where(eq(table.id, target.id));
    await recordActivity(tx, {
      action: hide ? "moderation.hidden" : "moderation.restored",
      ideaIds: target.ideaIds,
      subject: { kind: input.target.kind as SubjectKind, id: target.id },
      payload: { reason: input.reason },
    });
    await refreshIdeaMetrics(tx, target.ideaIds);
    return { hidden: hide };
  });
}
