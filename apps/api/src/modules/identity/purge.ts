import { sql } from "drizzle-orm";
import { queryRows } from "../../db/client";
import type { Ctx } from "../shared/context";

export async function purgeSessions(ctx: Ctx) {
  for (;;) {
    const removed = await queryRows(
      ctx.db,
      sql`
      delete from sessions where sessions.id in (
        select s.id from sessions s
        where least(s.expires_at, s.revoked_at) < now() - interval '30 days'
        order by s.id limit 500 for update skip locked
      ) returning sessions.id
    `,
    );
    if (removed.length < 500) return;
  }
}
