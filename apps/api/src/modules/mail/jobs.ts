import { createHmac } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { isLocale, type Locale } from "@ideaproxima/i18n";
import { accounts, accountTokens, people, tokenPurposes } from "../../db/schema";
import { hashToken } from "../identity/crypto";
import type { Ctx } from "../shared/context";
import { enqueue, type Claim } from "../jobs/queue";
import { renderAccountMail } from "./templates/account";

export const mailPayload = z.object({
  template: z.enum([...tokenPurposes, "email_change_notice", "password_changed", "existing_account"]),
  tokenId: z.uuid().optional(),
  personId: z.uuid().optional(),
  locale: z.string(),
});
export type MailPayload = z.infer<typeof mailPayload>;
export function queueMail(ctx: Ctx, payload: MailPayload) {
  return enqueue(ctx, { queue: "mail", kind: "mail.send", payload });
}

const paths = {
  verify_email: "/verify-email",
  reset_password: "/reset-password",
  change_email: "/confirm-email-change",
};

export async function deliverMail(ctx: Ctx, payload: MailPayload, job: Claim) {
  if (!ctx.mail) throw new Error("Mail worker is not configured");
  const token = payload.tokenId
    ? (await ctx.db.select().from(accountTokens).where(eq(accountTokens.id, payload.tokenId)))[0]
    : undefined;
  if (payload.tokenId && !token) return;
  const personId = payload.personId ?? token?.personId;
  const account = personId
    ? (
        await ctx.db
          .select({
            email: accounts.email,
            locale: accounts.locale,
            name: people.displayName,
            disabled: people.deactivatedAt,
          })
          .from(accounts)
          .innerJoin(people, eq(accounts.personId, people.id))
          .where(eq(accounts.personId, personId))
      )[0]
    : undefined;
  if (personId && (!account || account.disabled)) return;
  const to = token
    ? payload.template === "email_change_notice"
      ? token.previousEmail
      : token.email
    : account?.email;
  if (!to) return;
  const saved = account?.locale ?? token?.pendingRegistration?.locale ?? payload.locale;
  const locale: Locale = isLocale(saved) ? saved : "en";
  const name = account?.name ?? token?.pendingRegistration?.displayName;
  if (!name) return;
  let link: string | undefined;
  if (token && payload.template === token.purpose) {
    // A stable worker key makes SMTP retries reproduce the same link. The job stores only row IDs.
    const secret = createHmac("sha256", ctx.mail.key)
      .update("account-mail/v1/" + token.id)
      .digest("base64url");
    const live = await ctx.db
      .update(accountTokens)
      .set({ tokenHash: hashToken(secret) })
      .where(
        and(
          eq(accountTokens.id, token.id),
          isNull(accountTokens.usedAt),
          gt(accountTokens.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: accountTokens.id });
    if (!live.length) return;
    const url = new URL(paths[token.purpose], ctx.mail.baseUrl);
    url.hash = secret;
    link = url.href;
  }
  await ctx.mail.sender.send({ to, id: job.id, ...renderAccountMail(payload.template, locale, name, link) });
}
