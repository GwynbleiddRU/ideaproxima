import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { SessionPage, SecurityEventPage } from "@ideaproxima/contracts";
import { accounts, activities, securityEvents, sessions } from "../src/db/schema";
import { recomputeTrust } from "../src/modules/identity/trust";
import { purgeSecurityEvents } from "../src/modules/identity/security";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness({ CLIENT_IP_HEADER: "x-real-ip", TRUST_REQUIRE_VERIFIED_EMAIL: "true" });
});
afterAll(() => h.close());

it("lists only active owned sessions, revokes one or all others and keeps a private expiring history", async () => {
  const owner = await h.user("session-owner");
  const stranger = await h.user("other-owner", "admin");
  const auth = { token: owner.token };
  const body = { email: "session-owner@example.test", password: "correct horse battery" };
  const headers = { "user-agent": "Firefox/100 secret@example.test", "x-real-ip": "192.0.2.15" };
  const signIn = () => h.call("POST", "/auth/login", { body, headers });
  const other = await signIn();
  const third = await signIn();
  const path = "/me/sessions";
  const list = await h.call<SessionPage>("GET", path + "?limit=1", auth);
  expect(list.headers.get("cache-control")).toContain("no-store");
  expect(list.body.items[0]).toMatchObject({ current: false, userAgentFamily: "Firefox" });
  const second = await h.call<SessionPage>("GET", path + "?limit=1&before=" + list.body.nextCursor, auth);
  const id = second.body.items[0]!.id;
  expect((await h.call("DELETE", path + "/" + id, { token: stranger.token })).status).toBe(404);
  const results = await Promise.all([1, 2].map(() => h.call("DELETE", path + "/" + id, auth)));
  expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
  expect((await h.call("GET", "/me", { token: other.body.token })).status).toBe(401);
  expect((await h.call("GET", "/me", { token: third.body.token })).status).toBe(200);
  expect((await h.call("POST", path + "/revoke-others", { ...auth, body: {} })).status).toBe(200);
  expect((await h.call("GET", "/me", { token: third.body.token })).status).toBe(401);
  const current = (await h.call<SessionPage>("GET", path, auth)).body.items;
  expect(current).toHaveLength(1);
  expect(current[0]!.current).toBe(true);
  await h.db
    .update(sessions)
    .set({ lastUsedAt: sql`now() - interval '11 minutes'` })
    .where(eq(sessions.id, current[0]!.id));
  await Promise.all([1, 2].map(() => h.call("GET", "/me", auth)));
  const touched = (await h.call<SessionPage>("GET", path, auth)).body.items[0]!.lastUsedAt;
  expect(Date.now() - Date.parse(touched)).toBeLessThan(10_000);
  expect((await h.call<SessionPage>("GET", path, auth)).body.items[0]!.lastUsedAt).toBe(touched);
  await h.call("POST", "/auth/login", { body: { ...body, password: "wrong" }, headers });
  await h.call("POST", "/auth/login", { body: { ...body, email: "absent@example.test" }, headers });
  const events = (await h.call<SecurityEventPage>("GET", "/me/security-events", auth)).body.items;
  expect(events.map((e) => e.kind)).toEqual([
    "sign_in_failed",
    "other_sessions_revoked",
    "session_revoked",
    "signed_in",
    "signed_in",
    "signed_in",
  ]);
  const stored = await h.db.select().from(securityEvents).where(eq(securityEvents.personId, owner.id));
  expect(stored.find((e) => e.kind === "sign_in_failed")?.networkKeyHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(stored)).not.toMatch(/192\.0\.2\.15|example\.test/);
  const strangerEvents = (
    await h.call<SecurityEventPage>("GET", "/me/security-events", { token: stranger.token })
  ).body.items;
  expect(strangerEvents.some((e) => events.some((own) => e.id === own.id))).toBe(false);
  expect((await h.call("GET", "/me/security-events")).status).toBe(401);
  expect(
    (await h.db.select().from(activities).where(eq(activities.actorId, owner.id))).map((a) => a.action),
  ).toEqual(["person.registered"]);
  const expiredId = events[0]!.id;
  await h.db
    .update(securityEvents)
    .set({ createdAt: sql`now() - interval '91 days'` })
    .where(eq(securityEvents.id, expiredId));
  expect(
    (await h.call<SecurityEventPage>("GET", "/me/security-events", auth)).body.items.some(
      (e) => e.id === expiredId,
    ),
  ).toBe(false);
  await purgeSecurityEvents(h.ctx);
  expect(await h.db.select().from(securityEvents).where(eq(securityEvents.id, expiredId))).toHaveLength(0);
});

it("keeps the winning current session when two browsers revoke the others together", async () => {
  const user = await h.user("two-browsers");
  const login = await h.call("POST", "/auth/login", {
    body: { email: "two-browsers@example.test", password: "correct horse battery" },
  });
  const tokens = [user.token, login.body.token as string];
  const revoke = await Promise.all(
    tokens.map((token) => h.call("POST", "/me/sessions/revoke-others", { token, body: {} })),
  );
  expect(revoke.map((r) => r.status).sort()).toEqual([200, 401]);
  const remaining = await Promise.all(tokens.map((token) => h.call("GET", "/me", { token })));
  expect(remaining.map((r) => r.status)).toEqual(revoke.map((r) => r.status));
});

it("rebuilds establishment from age, knowledge contributions and current moderation dispositions", async () => {
  const user = await h.user("trust-author");
  const mod = await h.user("trust-mod", "moderator");
  const me = async () => (await h.call("GET", "/me", { token: user.token })).body;
  expect(await me()).toMatchObject({ trustTier: "new", trustNextStep: "verify_email" });
  const condition = eq(accounts.personId, user.id);
  await h.db.update(accounts).set({ emailVerifiedAt: new Date() }).where(condition);
  expect((await me()).trustNextStep).toBe("wait_72_hours");
  const idea = await h.idea(user.token);
  for (let n = 1; n < 9; n++) await h.idea(user.token);
  await recomputeTrust(h.ctx);
  expect((await me()).trustTier).toBe("new");
  await h.db
    .update(accounts)
    .set({ createdAt: sql`now() - interval '30 days'` })
    .where(condition);
  await recomputeTrust(h.ctx);
  expect((await me()).trustTier).toBe("member");
  await h.idea(user.token);
  await recomputeTrust(h.ctx);
  expect(await me()).toMatchObject({ trustTier: "established", trustNextStep: null });
  const marker = async () =>
    (await h.db.select({ at: accounts.establishedAt }).from(accounts).where(condition))[0]!.at;
  const first = await marker();
  await recomputeTrust(h.ctx);
  expect(await marker()).toEqual(first);
  const moderate = (action: string) =>
    h.call("POST", "/moderation", {
      token: mod.token,
      body: { target: { kind: "idea", id: idea.id }, action, reason: "Test moderation disposition" },
    });
  expect((await moderate("hide")).status).toBe(200);
  await recomputeTrust(h.ctx);
  expect(await me()).toMatchObject({ trustTier: "member", trustNextStep: "establish_history" });
  expect((await moderate("restore")).status).toBe(200);
  await recomputeTrust(h.ctx);
  expect((await me()).trustTier).toBe("established");
});

it("reports a new terms version and accepts exactly the version reviewed", async () => {
  const site = await createHarness({ LEGAL_TERMS_VERSION: "v2", MINIMUM_AGE: "0" });
  try {
    const policy = await site.call("GET", "/auth/registration-policy");
    expect(policy.body).toEqual({ minimumAge: 0, termsVersion: "v2" });
    const reg = await site.call("POST", "/auth/register", {
      body: {
        handle: "terms-reader",
        displayName: "Terms Reader",
        email: "terms@example.test",
        password: "correct horse battery",
        acceptTerms: true,
        termsVersion: "v2",
      },
    });
    expect(reg.status).toBe(201);
    const token = reg.body.token;
    const where = eq(accounts.personId, reg.body.person.id);
    await site.db.update(accounts).set({ termsVersion: "v1" }).where(where);
    expect((await site.call("GET", "/me", { token })).body.termsAcceptanceRequired).toBe(true);
    const accept = (version: string) =>
      site.call("POST", "/me/terms", { token, body: { acceptTerms: true, termsVersion: version } });
    expect((await accept("v1")).status).toBe(400);
    expect((await accept("v2")).status).toBe(200);
    expect((await site.call("GET", "/me", { token })).body.termsAcceptanceRequired).toBe(false);
    expect((await site.db.select().from(accounts).where(where))[0]).toMatchObject({
      termsVersion: "v2",
      termsAcceptedAt: expect.any(Date),
      confirmedMinimumAge: null,
      ageConfirmedAt: null,
    });
  } finally {
    await site.close();
  }
});
