import { and, asc, eq, gt, or } from "drizzle-orm";
import type { CommentDto, Page, PostCommentRequest } from "@ideaproxima/contracts";
import { DomainError, authorize } from "@ideaproxima/domain";
import { argumentsTable, claims, comments, evidence } from "../../db/schema";
import { findIdea } from "../ideas/queries";
import { refreshIdeaMetrics, usefulCounts } from "../metrics/service";
import { recordActivity } from "../shared/activity";
import { inTransaction, isModerator, type Ctx } from "../shared/context";
import { encodeCursor, keysetFrom, splitPage } from "../shared/pagination";
import { iso, personRefs, refOrUnknown } from "../shared/refs";

type CommentRow = typeof comments.$inferSelect;

async function commentDtos(ctx: Ctx, rows: CommentRow[]): Promise<CommentDto[]> {
  const [refs, useful] = await Promise.all([
    personRefs(
      ctx.db,
      rows.map((r) => r.authorId),
    ),
    usefulCounts(
      ctx.db,
      rows.map((r) => r.id),
    ),
  ]);
  return rows.map((r) => {
    // Hidden comments keep their place in the thread (so replies still make sense) but lose their content.
    const redacted = !!r.hiddenAt && !isModerator(ctx);
    return {
      id: r.id,
      ideaId: r.ideaId,
      kind: r.kind,
      body: redacted ? "" : r.body,
      author: refOrUnknown(refs, r.authorId),
      parentId: r.parentId,
      anchor: r.anchorClaimId
        ? { kind: "claim", id: r.anchorClaimId }
        : r.anchorEvidenceId
          ? { kind: "evidence", id: r.anchorEvidenceId }
          : r.anchorArgumentId
            ? { kind: "argument", id: r.anchorArgumentId }
            : null,
      createdAt: iso(r.createdAt),
      hidden: !!r.hiddenAt,
      derived: { usefulCount: useful.get(r.id) ?? 0 },
    };
  });
}

export async function postComment(ctx: Ctx, ideaRef: string, input: PostCommentRequest): Promise<CommentDto> {
  authorize(ctx.actor, "knowledge.contribute");
  const row = await inTransaction(ctx, async (tx) => {
    const idea = await findIdea(tx, ideaRef);
    if (input.parentId) {
      const [parent] = await tx.db
        .select({ ideaId: comments.ideaId })
        .from(comments)
        .where(eq(comments.id, input.parentId));
      if (!parent || parent.ideaId !== idea.id)
        throw new DomainError("validation_failed", "parentId is not a comment on this idea.");
    }
    const anchor = input.anchor;
    if (anchor) {
      const table = anchor.kind === "claim" ? claims : anchor.kind === "evidence" ? evidence : argumentsTable;
      const [found] = await tx.db.select({ id: table.id }).from(table).where(eq(table.id, anchor.id));
      if (!found) throw new DomainError("validation_failed", `Unknown ${anchor.kind} anchor.`);
    }
    const [created] = await tx.db
      .insert(comments)
      .values({
        ideaId: idea.id,
        parentId: input.parentId ?? null,
        anchorClaimId: anchor?.kind === "claim" ? anchor.id : null,
        anchorEvidenceId: anchor?.kind === "evidence" ? anchor.id : null,
        anchorArgumentId: anchor?.kind === "argument" ? anchor.id : null,
        kind: input.kind,
        body: input.body,
        authorId: ctx.actor!.id,
      })
      .returning();
    await recordActivity(tx, {
      action: "comment.posted",
      ideaIds: [idea.id],
      subject: { kind: "comment", id: created!.id },
      payload: { kind: input.kind, parentId: input.parentId ?? null },
    });
    await refreshIdeaMetrics(tx, [idea.id]);
    return created!;
  });
  return (await commentDtos(ctx, [row]))[0]!;
}

/** Chronological (oldest first), keyset-paginated so new comments never shift pages. */
export async function listComments(
  ctx: Ctx,
  ideaRef: string,
  limit: number,
  cursor?: string,
): Promise<Page<CommentDto>> {
  const idea = await findIdea(ctx, ideaRef);
  const after = keysetFrom(cursor);
  const rows = await ctx.db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.ideaId, idea.id),
        after
          ? or(
              gt(comments.createdAt, after.t),
              and(eq(comments.createdAt, after.t), gt(comments.id, after.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(limit + 1);
  const { items, hasMore } = splitPage(rows, limit);
  const last = items.at(-1);
  return {
    items: await commentDtos(ctx, items),
    nextCursor: hasMore && last ? encodeCursor({ t: iso(last.createdAt), id: last.id }) : null,
  };
}
