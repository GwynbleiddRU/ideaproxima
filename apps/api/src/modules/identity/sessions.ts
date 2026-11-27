import { and, desc, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { authorize, DomainError, notFound } from "@ideaproxima/domain";
import { inTransaction, type Ctx } from "../shared/context";
import { lockKey } from "../shared/locks";
import { iso } from "../shared/refs";
import { recordSecurityEvent } from "./security";
import { queryRows, type Database } from "../../db/client";
import { sessions } from "../../db/schema";

function activeSessions(personId: string) {
  return and(eq(sessions.personId, personId), isNull(sessions.revokedAt), gt(sessions.expiresAt, sql`now()`));
}

export async function listSessions(ctx: Ctx, currentId: string | null, limit: number, before?: string) {
  authorize(ctx.actor, "account.manage");
  const rows = await ctx.db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      userAgentFamily: sessions.userAgent,
    })
    .from(sessions)
    .where(and(activeSessions(ctx.actor.id), before ? lt(sessions.id, before) : undefined))
    .orderBy(desc(sessions.id))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map((row) => ({
    ...row,
    current: row.id === currentId,
    createdAt: iso(row.createdAt),
    lastUsedAt: iso(row.lastUsedAt ?? row.createdAt),
  }));
  return { items, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

export async function endSessions(ctx: Ctx, target: { one: string; logout?: boolean } | { except: string }) {
  authorize(ctx.actor, "account.manage");
  const id = ctx.actor.id;
  await inTransaction(ctx, async (tx) => {
    await lockKey(tx, "account", id);
    const one = "one" in target;
    if (!one) {
      // Two browsers can each ask to keep themselves. Only the still-active caller may proceed.
      const [current] = await tx.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(activeSessions(id), eq(sessions.id, target.except)));
      if (!current) throw new DomainError("unauthenticated", "sign_in_required");
    }
    const filter = one ? eq(sessions.id, target.one) : ne(sessions.id, target.except);
    const [result] = await queryRows<{ changed: boolean }>(
      tx.db,
      sql`
      with ended as (update sessions set revoked_at = now() where ${and(activeSessions(id), filter)} returning sessions.id)
      select exists (select 1 from ended) as changed`,
    );
    if (!result!.changed) {
      if (one && !target.logout) throw notFound("resource_not_found");
      return;
    }
    await recordSecurityEvent(tx, id, one ? "session_revoked" : "other_sessions_revoked");
  });
}

/** Revokes every session of a person, optionally keeping one (the caller's own). */
export async function revokeAllSessions(
  db: Database,
  personId: string,
  keepSessionId?: string | null,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(sessions.personId, personId),
        isNull(sessions.revokedAt),
        keepSessionId ? sql`${sessions.id} <> ${keepSessionId}` : undefined,
      ),
    );
}
