import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
  ChangePasswordRequest,
  ResendVerificationRequest,
  ResetRequest,
  ResetConfirmRequest,
  AccountTokenRequest,
  EmailChangeRequest,
  DeclareExpertiseRequest,
  LoginRequest,
  PageQuery,
  PersonModerationRequest,
  RegisterRequest,
  SetRoleRequest,
  UpdateProfileRequest,
  type AuthResponse,
} from "@ideaproxima/contracts";
import * as history from "../../modules/history/service";
import * as identity from "../../modules/identity/service";
import { SESSION_COOKIE, type AppEnv } from "../env";
import { jsonBody, queryOf } from "../input";
import { clientAddress } from "../client-address";
import { requestLocale } from "../locale";
import { setTimeout as delay } from "node:timers/promises";
import {
  consumeToken,
  registerAfterVerification,
  requestReset,
  resendVerification,
  requestEmailChange,
} from "../../modules/identity/tokens";

const limitRecovery = (c: Context<AppEnv>) => async (subject: string) => {
  await c.get("recoveryBudget")?.(subject);
};

// Keep mailbox lookup and queue insertion below the same response-time floor for either result.
async function acceptPrivately(work: () => Promise<void>) {
  await Promise.all([work(), delay(120)]);
}

const setSessionCookie = (c: Context<AppEnv>, auth: AuthResponse) =>
  setCookie(c, SESSION_COOKIE, auth.token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: c.get("config").http.cookieSecure,
    path: "/",
    expires: new Date(auth.expiresAt),
  });

export const identityRoutes = new Hono<AppEnv>()
  .get("/auth/challenge", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json((await c.get("challengeProvider")?.issue(clientAddress(c))) ?? null);
  })
  .post("/auth/register", async (c) => {
    const input = await jsonBody(c, RegisterRequest);
    await c
      .get("challengeProvider")
      ?.verify(clientAddress(c), input.challenge, c.get("priorRegistrations") ?? 0);
    if (c.get("config").registrationMode === "verified-first") {
      await registerAfterVerification(c.get("ctx"), input, requestLocale(c));
      return c.json({ ok: true }, 202);
    }
    const auth = await identity.register(
      c.get("ctx"),
      input,
      c.get("config").http.sessionTtlDays,
      requestLocale(c),
    );
    setSessionCookie(c, auth);
    return c.json(auth, 201);
  })
  .post("/auth/verify-email", async (c) => {
    const { token } = await jsonBody(c, AccountTokenRequest);
    await consumeToken(c.get("ctx"), token, "verify_email", requestLocale(c), limitRecovery(c));
    return c.json({ ok: true });
  })
  .post("/auth/verify-email/resend", async (c) => {
    await jsonBody(c, ResendVerificationRequest);
    await acceptPrivately(() => resendVerification(c.get("ctx"), requestLocale(c), limitRecovery(c)));
    return c.json({ ok: true }, 202);
  })
  .post("/auth/password-reset/request", async (c) => {
    const { email } = await jsonBody(c, ResetRequest);
    await limitRecovery(c)(email);
    await acceptPrivately(() => requestReset(c.get("ctx"), email, requestLocale(c)));
    return c.json({ ok: true }, 202);
  })
  .post("/auth/password-reset/confirm", async (c) => {
    const { token, newPassword } = await jsonBody(c, ResetConfirmRequest);
    await consumeToken(
      c.get("ctx"),
      token,
      "reset_password",
      requestLocale(c),
      limitRecovery(c),
      newPassword,
    );
    return c.json({ ok: true });
  })
  .post("/me/email", async (c) => {
    const { newEmail, currentPassword } = await jsonBody(c, EmailChangeRequest);
    await limitRecovery(c)(newEmail);
    await acceptPrivately(() =>
      requestEmailChange(c.get("ctx"), newEmail, currentPassword, requestLocale(c)),
    );
    return c.json({ ok: true }, 202);
  })
  .post("/auth/email-change/confirm", async (c) => {
    const { token } = await jsonBody(c, AccountTokenRequest);
    await consumeToken(c.get("ctx"), token, "change_email", requestLocale(c), limitRecovery(c));
    return c.json({ ok: true });
  })
  .post("/auth/login", async (c) => {
    const auth = await identity.login(
      c.get("ctx"),
      await jsonBody(c, LoginRequest),
      c.get("config").http.sessionTtlDays,
      c.get("loginFailureBudget"),
    );
    setSessionCookie(c, auth);
    return c.json(auth);
  })
  .post("/auth/logout", async (c) => {
    const sessionId = c.get("sessionId");
    if (sessionId) await identity.revokeSession(c.get("ctx").db, sessionId);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  })
  .get("/me", async (c) => {
    c.header("Cache-Control", "private, no-store");
    return c.json(await identity.getMe(c.get("ctx")));
  })
  .patch("/me", async (c) =>
    c.json(await identity.updateProfile(c.get("ctx"), await jsonBody(c, UpdateProfileRequest))),
  )
  .post("/me/expertise", async (c) =>
    c.json(await identity.declareExpertise(c.get("ctx"), await jsonBody(c, DeclareExpertiseRequest)), 201),
  )
  .delete("/me/expertise/:topic", async (c) =>
    c.json(await identity.revokeExpertise(c.get("ctx"), c.req.param("topic"))),
  )
  .post("/me/password", async (c) => {
    await identity.changePassword(c.get("ctx"), c.get("sessionId"), await jsonBody(c, ChangePasswordRequest));
    return c.json({ ok: true });
  })
  .get("/people/:handle", async (c) => c.json(await identity.getProfile(c.get("ctx"), c.req.param("handle"))))
  .get("/people/:handle/activity", async (c) => {
    const q = queryOf(c, PageQuery);
    return c.json(await history.personActivity(c.get("ctx"), c.req.param("handle"), q.limit, q.cursor));
  })
  .post("/people/:handle/deactivate", async (c) =>
    c.json(
      await identity.setPersonActive(
        c.get("ctx"),
        c.req.param("handle"),
        false,
        (await jsonBody(c, PersonModerationRequest)).reason,
      ),
    ),
  )
  .post("/people/:handle/reactivate", async (c) =>
    c.json(
      await identity.setPersonActive(
        c.get("ctx"),
        c.req.param("handle"),
        true,
        (await jsonBody(c, PersonModerationRequest)).reason,
      ),
    ),
  )
  .put("/people/:handle/role", async (c) =>
    c.json(
      await identity.assignRole(
        c.get("ctx"),
        c.req.param("handle"),
        (await jsonBody(c, SetRoleRequest)).role,
      ),
    ),
  );
