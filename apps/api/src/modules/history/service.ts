import { and, desc, eq, inArray, isNotNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import type { ActivityDto, Page } from "@ideaproxima/contracts";
import {
  activities,
  argumentsTable,
  claims,
  comments,
  evidence,
  ideaClaims,
  initiatives,
} from "../../db/schema";
import { findIdea } from "../ideas/queries";
import { personIdByHandle } from "../identity/service";
import { isModerator, type Ctx } from "../shared/context";
import { encodeCursor, keysetFrom, splitPage } from "../shared/pagination";
import { ideaRefs, iso, personRefs } from "../shared/refs";

const subjectTables = {
  claim: claims,
  evidence,
  argument: argumentsTable,
  comment: comments,
  initiative: initiatives,
};

async function hiddenSubjects(ctx: Ctx, items: (typeof activities.$inferSelect)[]) {
  const hidden = new Map<string, Set<string>>();
  if (isModerator(ctx)) return hidden;
  const idsFor = (kind: string) =>
    items
      .filter((item) => item.subjectKind === kind && !item.action.startsWith("moderation."))
      .map((item) => item.subjectId);

  await Promise.all(
    Object.entries(subjectTables).map(async ([kind, table]) => {
      const ids = idsFor(kind);
      if (!ids.length) return;
      const rows = await ctx.db
        .select({ id: table.id })
        .from(table)
        .where(and(inArray(table.id, ids), isNotNull(table.hiddenAt)));
      hidden.set(kind, new Set(rows.map((row) => row.id)));
    }),
  );
  const links = idsFor("idea_claim");
  if (links.length) {
    const rows = await ctx.db
      .select({ id: ideaClaims.id })
      .from(ideaClaims)
      .innerJoin(claims, eq(ideaClaims.claimId, claims.id))
      .where(and(inArray(ideaClaims.id, links), isNotNull(claims.hiddenAt)));
    hidden.set("idea_claim", new Set(rows.map((row) => row.id)));
  }
  return hidden;
}

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
  const [hidden, refs, ideasById] = await Promise.all([
    hiddenSubjects(ctx, items),
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
    items: items.map((r) => {
      const redact =
        !r.action.startsWith("moderation.") && (hidden.get(r.subjectKind)?.has(r.subjectId) ?? false);
      return {
        id: r.id,
        occurredAt: iso(r.occurredAt),
        actor: r.actorId ? (refs.get(r.actorId) ?? null) : null,
        action: r.action,
        ideaId: r.ideaIds[0] ?? null,
        idea: (r.ideaIds[0] && ideasById.get(r.ideaIds[0])) || null,
        subject: { kind: r.subjectKind, id: r.subjectId, hidden: redact },
        payload: redact ? {} : r.payload,
      };
    }),
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
