import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { sessions } from "../../db/schema";

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
