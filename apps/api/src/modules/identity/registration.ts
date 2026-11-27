import { and, eq, sql } from "drizzle-orm";
import type { RegisterRequest, RegistrationPolicy } from "@ideaproxima/contracts";
import { authorize, DomainError } from "@ideaproxima/domain";
import { accounts, people } from "../../db/schema";
import { recordActivity } from "../shared/activity";
import type { Ctx } from "../shared/context";

export function registrationAcceptance(input: RegisterRequest, policy: RegistrationPolicy) {
  if (
    policy.minimumAge > 0 &&
    (!input.confirmAge || (input.minimumAge !== undefined && input.minimumAge !== policy.minimumAge))
  )
    throw new DomainError("validation_failed", "confirm_minimum_age", { age: policy.minimumAge });
  if (
    policy.termsVersion &&
    (!input.acceptTerms || (input.termsVersion !== undefined && input.termsVersion !== policy.termsVersion))
  )
    throw new DomainError("validation_failed", "accept_current_terms");
  return { ...policy, confirmedAt: new Date().toISOString() };
}

export async function acceptTerms(ctx: Ctx, submittedVersion: string, currentVersion: string | null) {
  authorize(ctx.actor, "account.manage");
  if (currentVersion !== submittedVersion) throw new DomainError("validation_failed", "accept_current_terms");
  await ctx.db
    .update(accounts)
    .set({ termsVersion: submittedVersion, termsAcceptedAt: new Date() })
    .where(
      and(
        eq(accounts.personId, ctx.actor.id),
        sql`${accounts.termsVersion} is distinct from ${submittedVersion}`,
      ),
    );
}

export async function createAccount(
  tx: Ctx,
  input: { handle: string; displayName: string; email: string },
  passwordHash: string,
  locale: string | null,
  verified: boolean,
  acceptance?: ReturnType<typeof registrationAcceptance>,
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
    termsVersion: acceptance?.termsVersion,
    termsAcceptedAt: acceptance?.termsVersion ? new Date(acceptance.confirmedAt) : null,
    confirmedMinimumAge: acceptance?.minimumAge || null,
    ageConfirmedAt: acceptance?.minimumAge ? new Date(acceptance.confirmedAt) : null,
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
