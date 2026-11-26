import { eq } from "drizzle-orm";
import { DomainError } from "@ideaproxima/domain";
import { accounts, people } from "../../db/schema";
import { recordActivity } from "../shared/activity";
import type { Ctx } from "../shared/context";

export async function createAccount(
  tx: Ctx,
  input: { handle: string; displayName: string; email: string },
  passwordHash: string,
  locale: string | null,
  verified: boolean,
) {
  const [emailTaken] = await tx.db
    .select({ id: accounts.personId })
    .from(accounts)
    .where(eq(accounts.email, input.email));
  if (emailTaken) throw new DomainError("conflict", "email_taken");
  const [handleTaken] = await tx.db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.handle, input.handle));
  if (handleTaken) throw new DomainError("conflict", "handle_taken");

  const [person] = await tx.db
    .insert(people)
    .values({ handle: input.handle, displayName: input.displayName })
    .returning();
  await tx.db.insert(accounts).values({
    personId: person!.id,
    email: input.email,
    passwordHash,
    locale,
    emailVerifiedAt: verified ? new Date() : null,
  });
  const actorCtx: Ctx = {
    ...tx,
    actor: { id: person!.id, role: person!.role, active: true, trust: "new" },
  };
  await recordActivity(actorCtx, {
    action: "person.registered",
    subject: { kind: "person", id: person!.id },
  });
  return person!;
}
