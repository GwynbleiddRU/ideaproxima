import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { accountTokens, accounts, jobs } from "../src/db/schema";
import { drainJobs } from "../src/modules/jobs/runner";
import { createMailSender, type OutgoingMail } from "../src/modules/mail/sender";
import { renderAccountMail } from "../src/modules/mail/templates/account";
import { loadConfig } from "../src/config";
import { hashToken, hashPassword } from "../src/modules/identity/crypto";
import { createHash } from "node:crypto";
import { purgeAccountTokens } from "../src/modules/identity/tokens";
import { createHarness, type Harness } from "./harness";

describe.each(["immediate", "verified-first"])("%s registration and account mail", (mode) => {
  let h: Harness;
  const mail: OutgoingMail[] = [];
  const password = "correct horse battery";
  const input = {
    handle: "mail-user",
    confirmAge: true,
    acceptTerms: true,
    termsVersion: "mail-test",
    displayName: "Robin <Robin>",
    email: "robin@example.test",
    password,
    locale: "ar",
  };
  beforeAll(async () => {
    h = await createHarness({ REGISTRATION_MODE: mode, LEGAL_TERMS_VERSION: "mail-test" });
    const sender = createMailSender(loadConfig({}).mail);
    h.ctx.mail = {
      key: "fixture-worker-key",
      baseUrl: "https://archive.example",
      sender: {
        async send(message) {
          mail.push(message);
          await sender.send(message);
        },
      },
    };
  });
  afterAll(async () => h.close());
  async function deliver() {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await drainJobs(h.ctx, undefined, ["mail"]);
    } finally {
      log.mockRestore();
    }
    expect(
      await h.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.queue, "mail"), sql`jobs.state <> 'done'`)),
    ).toHaveLength(0);
  }
  const link = (path: string) => {
    const msg = mail.findLast((m) => m.text.includes("https://archive.example/" + path + "#"));
    expect(msg).toBeDefined();
    return new URL(msg!.text.trim().split("\n").at(-1)!).hash.slice(1);
  };
  it("follows links, refuses replay and wrong purpose, changes only a confirmed address, and ends every session after reset", async () => {
    for (const [override, reason] of [
      [{ confirmAge: undefined }, "confirm_minimum_age"],
      [{ acceptTerms: false }, "accept_current_terms"],
      [{ termsVersion: "outdated" }, "accept_current_terms"],
    ] as const) {
      expect(
        (await h.call("POST", "/auth/register", { body: { ...input, ...override } })).body.error.details
          .reason,
      ).toBe(reason);
    }
    expect(await h.db.select().from(accountTokens)).toHaveLength(0);
    const reg = await h.call("POST", "/auth/register", { body: input });
    expect(reg.status).toBe(mode === "immediate" ? 201 : 202);
    if (mode === "verified-first") {
      expect(reg.headers.get("set-cookie")).toBeNull();
      expect(await h.db.select().from(accounts)).toHaveLength(0);
      expect((await h.call("POST", "/auth/login", { body: input })).status).toBe(401);
    }
    await deliver();
    expect(mail.at(-1)?.html).toContain('lang="ar" dir="rtl"');
    let verification = link("verify-email");
    if (mode === "immediate") {
      expect(
        (await h.call("POST", "/auth/verify-email/resend", { token: reg.body.token, body: {} })).status,
      ).toBe(202);
      await deliver();
      expect(
        (await h.call("POST", "/auth/verify-email", { body: { token: verification } })).body.error.details
          .reason,
      ).toBe("token_used");
      verification = link("verify-email");
    }
    expect(JSON.stringify(await h.db.select().from(jobs))).not.toContain(verification);
    const verify = () => h.call("POST", "/auth/verify-email", { body: { token: verification } });
    expect((await Promise.all([verify(), verify()])).map((r) => r.status).sort()).toEqual([200, 400]);
    expect((await verify()).body.error.details.reason).toBe("token_used");
    const [accepted] = await h.db.select().from(accounts);
    expect(accepted).toMatchObject({
      termsVersion: "mail-test",
      termsAcceptedAt: expect.any(Date),
      confirmedMinimumAge: 16,
      ageConfirmedAt: expect.any(Date),
    });
    expect(accepted!.termsAcceptedAt).toEqual(accepted!.ageConfirmedAt);
    const login = async () => (await h.call("POST", "/auth/login", { body: input })).body.token as string;
    const session = await login();
    const second = await login();
    expect((await h.call("GET", "/me", { token: session })).body.emailVerified).toBe(true);
    const duplicate = await h.call("POST", "/auth/register", { body: input });
    if (mode === "verified-first") {
      expect([duplicate.status, duplicate.body]).toEqual([reg.status, reg.body]);
      await deliver();
      expect(mail.at(-1)?.subject).toContain("already");
    } else expect(duplicate.body.error.details.reason).toBe("email_taken");
    const newEmail = "new@example.test";
    expect(
      (
        await h.call("POST", "/me/email", {
          token: session,
          body: { newEmail, currentPassword: "incorrect" },
        })
      ).status,
    ).toBe(403);
    const unavailable = await h.call("POST", "/me/email", {
      token: session,
      body: { newEmail: input.email, currentPassword: password },
    });
    const change = await h.call("POST", "/me/email", {
      token: session,
      body: { newEmail, currentPassword: password },
    });
    expect([change.status, change.body]).toEqual([202, { ok: true }]);
    expect([unavailable.status, unavailable.body]).toEqual([change.status, change.body]);
    await deliver();
    expect(mail.some((m) => m.to === input.email && m.subject.includes("requested"))).toBe(true);
    expect((await h.call("GET", "/me", { token: session })).body.email).toBe(input.email);
    const changeToken = link("confirm-email-change");
    expect(
      (await h.call("POST", "/auth/verify-email", { body: { token: changeToken } })).body.error.details
        .reason,
    ).toBe("token_invalid");
    expect(
      (await h.call("POST", "/auth/email-change/confirm", { body: { token: changeToken } })).status,
    ).toBe(200);
    expect((await h.call("GET", "/me", { token: session })).body.email).toBe(newEmail);
    const request = async (email: string) => {
      const start = performance.now();
      const { status, body } = await h.call("POST", "/auth/password-reset/request", { body: { email } });
      return { status, body, ms: performance.now() - start };
    };
    const knownTimes: number[] = [],
      absentTimes: number[] = [];
    // Alternate order and compare medians so one worker scheduling pause cannot dominate the comparison.
    for (let sample = 0; sample < 5; sample++) {
      for (const email of sample % 2 ? [newEmail, input.email] : [input.email, newEmail]) {
        const result = await request(email);
        expect([result.status, result.body]).toEqual([202, { ok: true }]);
        (email === newEmail ? knownTimes : absentTimes).push(result.ms);
      }
    }
    const median = (times: number[]) => times.sort((a, b) => a - b)[2]!;
    const knownMs = median(knownTimes),
      absentMs = median(absentTimes);
    console.info("Recovery median (ms)", mode, { known: Math.round(knownMs), unknown: Math.round(absentMs) });
    expect(Math.abs(knownMs - absentMs)).toBeLessThan(100);
    await deliver();
    const expired = link("reset-password");
    await h.db
      .update(accountTokens)
      .set({ expiresAt: new Date(0) })
      .where(eq(accountTokens.tokenHash, hashToken(expired)));
    const reset = (token: string) =>
      h.call("POST", "/auth/password-reset/confirm", {
        body: { token, newPassword: "a different password" },
      });
    expect((await reset(expired)).body.error.details.reason).toBe("token_expired");
    await request(newEmail);
    await deliver();
    const fresh = link("reset-password");
    expect((await reset(fresh)).status).toBe(200);
    expect((await reset(fresh)).body.error.details.reason).toBe("token_used");
    for (const token of [session, second]) expect((await h.call("GET", "/me", { token })).status).toBe(401);
    expect(
      (await h.call("POST", "/auth/login", { body: { email: newEmail, password: "a different password" } }))
        .status,
    ).toBe(200);
    await deliver();
    expect(mail.at(-1)?.subject).toContain("password was reset");
    await purgeAccountTokens(h.ctx);
    expect(
      await h.db
        .select()
        .from(accountTokens)
        .where(eq(accountTokens.tokenHash, hashToken(expired))),
    ).toEqual([]);
  });
});

it("checks only the five-character prefix when enabled and permits a provider outage", async () => {
  const value = "a password for testing";
  const digest = createHash("sha1").update(value).digest("hex").toUpperCase();
  const lookup = vi.spyOn(globalThis, "fetch");
  try {
    lookup.mockResolvedValueOnce(new Response(digest.slice(5) + ":2\r\n"));
    await expect(hashPassword(value, "hibp")).rejects.toMatchObject({ reason: "password_breached" });
    expect(lookup.mock.calls[0]?.[0]).toBe("https://api.pwnedpasswords.com/range/" + digest.slice(0, 5));
    lookup.mockRejectedValueOnce(new Error("offline"));
    await expect(hashPassword(value, "hibp")).resolves.toMatch(/^scrypt/);
  } finally {
    lookup.mockRestore();
  }
});

it("enforces the recovery mailbox limit on unknown accounts", async () => {
  const h = await createHarness({ RATE_LIMITS: "on" });
  try {
    const request = () =>
      h.call("POST", "/auth/password-reset/request", { body: { email: "unknown@example.test" } });
    for (let i = 0; i < 3; i++) expect((await request()).status).toBe(202);
    expect((await request()).body.error.details.policy).toBe("auth.recovery");
  } finally {
    await h.close();
  }
});

it("escapes every mail template and renders locale direction and an English fallback", () => {
  for (const template of [
    "verify_email",
    "reset_password",
    "change_email",
    "email_change_notice",
    "existing_account",
    "password_changed",
  ] as const)
    for (const locale of ["en", "ar"] as const) {
      const mail = renderAccountMail(
        template,
        locale,
        '<img src=x onerror="bad">',
        "https://example.test/?a=1&b=2",
      );
      expect(mail.html).toContain(`lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"`);
      expect(mail.html).toContain("&lt;img");
      expect(mail.html).toContain("&amp;b");
      expect(mail.html).not.toContain("<img");
      expect(mail.subject).not.toContain("emails.");
    }
});
