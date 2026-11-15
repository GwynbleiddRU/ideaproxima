import { and, desc, eq, like, lt, or, sql, type SQL } from "drizzle-orm";
import type { ActivityDto, Page } from "@ideaproxima/contracts";
import { activities } from "../../db/schema";
import { findIdea } from "../ideas/queries";
import { personIdByHandle } from "../identity/service";
import { isModerator, type Ctx } from "../shared/context";
import { encodeCursor, keysetFrom, splitPage } from "../shared/pagination";
import { ideaRefs, iso, personRefs } from "../shared/refs";

/**
 * Read access to the activity ledger: idea timelines ("how did this idea evolve?"), personal contribution
 * histories, and the global feed (which includes the public moderation log: `action=moderation.`).
 * Newest first, keyset-paginated.
 */
async function page(
  ctx: Ctx,
  filter: SQL | undefined,
  limit: number,
  cursor?: string,
): Promise<Page<ActivityDto>> {
  const after = keysetFrom(cursor);
  // Activities about hidden ideas would leak their content through payloads. Moderation entries stay visible:
  // the moderation log is public by design.
  const visibility = isModerator(ctx)
    ? undefined
    : sql`(${activities.action} like 'moderation.%' or not exists (
        select 1 from ideas h where h.id = any(${activities.ideaIds}) and h.hidden_at is not null))`;
  const rows = await ctx.db
    .select()
    .from(activities)
    .where(
      and(
        filter,
        visibility,
        after
          ? or(
              lt(activities.occurredAt, after.t),
              and(eq(activities.occurredAt, after.t), lt(activities.id, after.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(activities.occurredAt), desc(activities.id))
    .limit(limit + 1);
  const { items, hasMore } = splitPage(rows, limit);
  const [refs, ideasById] = await Promise.all([
    personRefs(
      ctx.db,
      items.map((r) => r.actorId),
    ),
    ideaRefs(
      ctx.db,
      items.map((r) => r.ideaIds[0]),
      isModerator(ctx),
    ),
  ]);
  const last = items.at(-1);
  return {
    items: items.map((r) => ({
      id: r.id,
      occurredAt: iso(r.occurredAt),
      actor: r.actorId ? (refs.get(r.actorId) ?? null) : null,
      action: r.action,
      ideaId: r.ideaIds[0] ?? null,
      idea: (r.ideaIds[0] && ideasById.get(r.ideaIds[0])) || null,
      subject: { kind: r.subjectKind, id: r.subjectId },
      payload: r.payload,
    })),
    nextCursor: hasMore && last ? encodeCursor({ t: iso(last.occurredAt), id: last.id }) : null,
  };
}

export async function ideaTimeline(ctx: Ctx, ideaRef: string, limit: number, cursor?: string) {
  const idea = await findIdea(ctx, ideaRef);
  return page(ctx, sql`${idea.id}::uuid = any(${activities.ideaIds})`, limit, cursor);
}

export async function personActivity(ctx: Ctx, handle: string, limit: number, cursor?: string) {
  const personId = await personIdByHandle(ctx.db, handle);
  return page(ctx, eq(activities.actorId, personId), limit, cursor);
}

/** Global feed. `actionPrefix` filters by verb family, e.g. "moderation." for the public moderation log. */
export async function globalActivity(ctx: Ctx, limit: number, cursor?: string, actionPrefix?: string) {
  const escaped = actionPrefix?.replace(/[%_\\]/g, (m) => `\\${m}`);
  return page(ctx, escaped ? like(activities.action, `${escaped}%`) : undefined, limit, cursor);
}
