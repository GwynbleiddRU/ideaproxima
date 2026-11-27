import { createHmac } from "node:crypto";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { authorize, type SecurityEventKind } from "@ideaproxima/domain";
import { securityEvents } from "../../db/schema";
import { queryRows } from "../../db/client";
import type { Ctx } from "../shared/context";
import { iso } from "../shared/refs";

const families: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\//, "Opera"],
  [/(?:Firefox|FxiOS)\//, "Firefox"],
  [/(?:Chrome|CriOS)\//, "Chrome"],
  [/Safari\//, "Safari"],
  [/curl\//, "curl"],
];

/** Store only a browser family. A user-agent can itself contain personal data. */
export function securityMetadata(header: string | undefined, network: string, secret: string) {
  const agent = header?.slice(0, 200) ?? "";
  return {
    userAgent: families.find(([pattern]) => pattern.test(agent))?.[1] ?? null,
    networkKeyHash:
      network === "unknown"
        ? null
        : createHmac("sha256", secret)
            .update("security-event:" + network)
            .digest("hex"),
  };
}

export async function recordSecurityEvent(ctx: Ctx, personId: string | null, kind: SecurityEventKind) {
  await ctx.db.insert(securityEvents).values({ personId, kind, ...ctx.securityMetadata?.() });
}

export async function listSecurityEvents(ctx: Ctx, limit: number, before?: string) {
  authorize(ctx.actor, "account.manage");
  const rows = await ctx.db
    .select({
      id: securityEvents.id,
      kind: securityEvents.kind,
      createdAt: securityEvents.createdAt,
      userAgentFamily: securityEvents.userAgent,
    })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.personId, ctx.actor.id),
        gt(securityEvents.createdAt, sql`now() - interval '90 days'`),
        before ? lt(securityEvents.id, before) : undefined,
      ),
    )
    .orderBy(desc(securityEvents.id))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map((row) => ({ ...row, createdAt: iso(row.createdAt) }));
  return { items, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

export async function purgeSecurityEvents(ctx: Ctx) {
  for (;;) {
    const removed = await queryRows(
      ctx.db,
      sql`delete from security_events where security_events.id in
      (select e.id from security_events e where e.created_at <= now() - interval '90 days' order by e.created_at limit 500 for update skip locked)
      returning security_events.id`,
    );
    if (removed.length < 500) return;
  }
}
