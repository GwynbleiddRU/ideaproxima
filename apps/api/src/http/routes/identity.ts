import { Hono, type Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
  ChangePasswordRequest,
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

const setSessionCookie = (c: Context<AppEnv>, auth: AuthResponse) =>
  setCookie(c, SESSION_COOKIE, auth.token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: c.get("config").cookieSecure,
    path: "/",
    expires: new Date(auth.expiresAt),
  });

export const identityRoutes = new Hono<AppEnv>()
  .post("/auth/register", async (c) => {
    const auth = await identity.register(
      c.get("ctx"),
      await jsonBody(c, RegisterRequest),
      c.get("config").sessionTtlDays,
    );
    setSessionCookie(c, auth);
    return c.json(auth, 201);
  })
  .post("/auth/login", async (c) => {
    const auth = await identity.login(
      c.get("ctx"),
      await jsonBody(c, LoginRequest),
      c.get("config").sessionTtlDays,
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
  .get("/me", async (c) => c.json(await identity.getMe(c.get("ctx"))))
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
