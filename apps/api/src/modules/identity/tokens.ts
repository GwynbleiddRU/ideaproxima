import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { DomainError, isValidHandle } from "@ideaproxima/domain";
import type { Locale } from "@ideaproxima/i18n";
import type { RegisterRequest, RegistrationPolicy } from "@ideaproxima/contracts";
import { accounts, accountTokens, people, type TokenPurpose } from "../../db/schema";
import { revokeAllSessions } from "./sessions";
import { queryRows } from "../../db/client";
import { queueMail } from "../mail/jobs";
import { inTransaction, type Ctx } from "../shared/context";
import { lockKey, lockKeys } from "../shared/locks";
import { requireLocale } from "../shared/locales";
import { hashPassword, hashToken, verifyPassword } from "./crypto";
import { createAccount, registrationAcceptance } from "./registration";
import { recordSecurityEvent } from "./security";

type TokenRow = typeof accountTokens.$inferSelect;
type Issue = Pick<TokenRow, "email" | "purpose" | "personId"> &
  Partial<Pick<TokenRow, "previousEmail" | "pendingRegistration">>;
const lifetimeHours = { verify_email: 48, reset_password: 1, change_email: 24 };

export async function invalidateAccountTokens(tx: Ctx, id: string, purposes: TokenPurpose[]) {
  await tx.db
    .update(accountTokens)
    .set({ usedAt: sql`now()` })
    .where(
      and(
        eq(accountTokens.personId, id),
        inArray(accountTokens.purpose, purposes),
        isNull(accountTokens.usedAt),
      ),
    );
}

// Caller holds the account lock (email lock for a pending registration), or has just created the account.
export async function issueToken(tx: Ctx, input: Issue, locale: Locale) {
  if (input.personId) await invalidateAccountTokens(tx, input.personId, [input.purpose]);
  else
    await tx.db
      .update(accountTokens)
      .set({ usedAt: sql`now()`, pendingRegistration: null })
      .where(
        and(
          isNull(accountTokens.personId),
          eq(accountTokens.email, input.email),
          eq(accountTokens.purpose, input.purpose),
          isNull(accountTokens.usedAt),
        ),
      );
  const [token] = await tx.db
    .insert(accountTokens)
    .values({ ...input, expiresAt: new Date(Date.now() + lifetimeHours[input.purpose] * 3_600_000) })
    .returning({ id: accountTokens.id });
  await queueMail(tx, { template: input.purpose, tokenId: token!.id, locale });
  return token!.id;
}

export async function registerAfterVerification(
  ctx: Ctx,
  input: RegisterRequest,
  locale: Locale,
  policy: RegistrationPolicy,
) {
  const acceptance = registrationAcceptance(input, policy);
  if (!isValidHandle(input.handle)) throw new DomainError("validation_failed", "invalid_handle");
  const preference = input.locale ? requireLocale(input.locale) : null;
  const passwordHash = await hashPassword(input.password, ctx.passwordBreachCheck);
  await inTransaction(ctx, async (tx) => {
    await lockKey(tx, "email", input.email);
    const [existing] = await tx.db
      .select({ id: accounts.personId })
      .from(accounts)
      .where(eq(accounts.email, input.email));
    if (existing) await queueMail(tx, { template: "existing_account", personId: existing.id, locale });
    else
      await issueToken(
        tx,
        {
          email: input.email,
          personId: null,
          purpose: "verify_email",
          pendingRegistration: {
            displayName: input.displayName,
            handle: input.handle,
            passwordHash,
            locale: preference,
            acceptance,
          },
        },
        locale,
      );
  });
}

function activeAccount(ctx: Ctx, filter: ReturnType<typeof eq>) {
  return ctx.db
    .select({
      id: accounts.personId,
      email: accounts.email,
      passwordHash: accounts.passwordHash,
      verified: accounts.emailVerifiedAt,
    })
    .from(accounts)
    .innerJoin(people, eq(people.id, accounts.personId))
    .where(and(filter, isNull(people.deactivatedAt)))
    .limit(1);
}

export async function requestReset(ctx: Ctx, email: string, locale: Locale) {
  const [candidate] = await activeAccount(ctx, eq(accounts.email, email));
  if (!candidate) return;
  await inTransaction(ctx, async (tx) => {
    await lockKey(tx, "account", candidate.id);
    const [current] = await activeAccount(tx, eq(accounts.personId, candidate.id));
    if (current?.email === email)
      await issueToken(tx, { personId: current.id, email, purpose: "reset_password" }, locale);
  });
}

export async function resendVerification(ctx: Ctx, locale: Locale, limit: (email: string) => Promise<void>) {
  if (!ctx.actor) throw new DomainError("unauthenticated", "sign_in_required");
  const id = ctx.actor.id;
  const [candidate] = await activeAccount(ctx, eq(accounts.personId, id));
  if (!candidate) throw new DomainError("unauthenticated", "sign_in_required");
  await limit(candidate.email);
  await inTransaction(ctx, async (tx) => {
    await lockKey(tx, "account", id);
    const [current] = await activeAccount(tx, eq(accounts.personId, id));
    if (current && current.email === candidate.email && !current.verified)
      await issueToken(tx, { personId: id, email: current.email, purpose: "verify_email" }, locale);
  });
}

export async function requestEmailChange(
  ctx: Ctx,
  newEmail: string,
  currentPassword: string,
  locale: Locale,
) {
  if (!ctx.actor) throw new DomainError("unauthenticated", "sign_in_required");
  const id = ctx.actor.id;
  const [candidate] = await activeAccount(ctx, eq(accounts.personId, id));
  if (!candidate || !(await verifyPassword(currentPassword, candidate.passwordHash)))
    throw new DomainError("forbidden", "incorrect_current_password");
  await inTransaction(ctx, async (tx) => {
    await lockKeys(tx, ["account:" + id, "email:" + newEmail]);
    const [current] = await activeAccount(tx, eq(accounts.personId, id));
    if (!current || current.passwordHash !== candidate.passwordHash || current.email !== candidate.email)
      throw new DomainError("forbidden", "incorrect_current_password");
    // Always replace any older request and notify the old mailbox, even for an unavailable destination.
    const [taken] = await tx.db
      .select({ id: accounts.personId })
      .from(accounts)
      .where(eq(accounts.email, newEmail));
    if (!taken) {
      const tokenId = await issueToken(
        tx,
        { personId: id, purpose: "change_email", email: newEmail, previousEmail: current.email },
        locale,
      );
      await queueMail(tx, { template: "email_change_notice", tokenId, locale });
    } else {
      await invalidateAccountTokens(tx, id, ["change_email"]);
      await queueMail(tx, { template: "email_change_notice", personId: id, locale });
    }
  });
}

export async function consumeToken(
  ctx: Ctx,
  raw: string,
  purpose: TokenPurpose,
  locale: Locale,
  limit: (subject: string) => Promise<void>,
  newPassword?: string,
) {
  const digest = hashToken(raw);
  const [candidate] = await ctx.db.select().from(accountTokens).where(eq(accountTokens.tokenHash, digest));
  await limit(candidate?.email ?? digest);
  if (!candidate || candidate.purpose !== purpose)
    throw new DomainError("validation_failed", "token_invalid");
  if (candidate.usedAt) throw new DomainError("validation_failed", "token_used");
  if (candidate.expiresAt.getTime() <= Date.now())
    throw new DomainError("validation_failed", "token_expired");
  const passwordHash =
    newPassword === undefined ? undefined : await hashPassword(newPassword, ctx.passwordBreachCheck);
  await inTransaction(ctx, async (tx) => {
    const keys = ["email:" + candidate.email];
    if (candidate.personId) keys.push("account:" + candidate.personId);
    if (candidate.pendingRegistration) keys.push("handle:" + candidate.pendingRegistration.handle);
    await lockKeys(tx, keys);
    const [live] = await tx.db
      .update(accountTokens)
      .set({ usedAt: sql`clock_timestamp()`, pendingRegistration: null })
      .where(
        and(
          eq(accountTokens.id, candidate.id),
          eq(accountTokens.tokenHash, digest),
          isNull(accountTokens.usedAt),
          gt(accountTokens.expiresAt, sql`clock_timestamp()`),
        ),
      )
      .returning({ id: accountTokens.id });
    if (!live)
      throw new DomainError(
        "validation_failed",
        candidate.expiresAt.getTime() <= Date.now() ? "token_expired" : "token_used",
      );
    const pending = candidate.pendingRegistration;
    if (pending && purpose === "verify_email") {
      await createAccount(
        tx,
        { ...pending, email: candidate.email },
        pending.passwordHash,
        pending.locale,
        true,
        pending.acceptance,
      );
      return;
    }
    const id = candidate.personId;
    if (!id) throw new DomainError("validation_failed", "token_invalid");
    const [current] = await activeAccount(tx, eq(accounts.personId, id));
    if (!current || current.email !== (candidate.previousEmail ?? candidate.email))
      throw new DomainError("validation_failed", "token_invalid");
    if (purpose === "reset_password" && passwordHash) {
      await tx.db.update(accounts).set({ passwordHash }).where(eq(accounts.personId, id));
      await revokeAllSessions(tx.db, id);
      await recordSecurityEvent(tx, id, "password_reset");
      await invalidateAccountTokens(tx, id, ["change_email"]);
      await queueMail(tx, { template: "password_changed", tokenId: candidate.id, locale });
    } else if (purpose === "change_email") {
      const [taken] = await tx.db
        .select({ id: accounts.personId })
        .from(accounts)
        .where(eq(accounts.email, candidate.email));
      if (taken) throw new DomainError("validation_failed", "token_invalid");
      await tx.db
        .update(accounts)
        .set({ email: candidate.email, emailVerifiedAt: sql`now()` })
        .where(eq(accounts.personId, id));
      await invalidateAccountTokens(tx, id, ["reset_password", "verify_email"]);
      await recordSecurityEvent(tx, id, "email_changed");
    } else if (purpose === "verify_email") {
      await tx.db
        .update(accounts)
        .set({ emailVerifiedAt: sql`now()` })
        .where(eq(accounts.personId, id));
    } else throw new DomainError("validation_failed", "token_invalid");
  });
}

export async function purgeAccountTokens(ctx: Ctx) {
  for (;;) {
    const removed = await queryRows(
      ctx.db,
      sql`delete from account_tokens where account_tokens.id in
    (select t.id from account_tokens t where t.expires_at < now() - interval '30 days' order by t.expires_at limit 500 for update skip locked) returning account_tokens.id`,
    );
    if (removed.length < 500) return;
  }
}
