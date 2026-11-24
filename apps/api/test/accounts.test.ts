import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActivityDto, MeResponse, Page, PersonDto } from "@ideaproxima/contracts";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

const login = (email: string, password = "correct horse battery") =>
  h.call("POST", "/auth/login", { body: { email, password } });

describe("password change", () => {
  it("requires the current password and signs out every other session", async () => {
    const u = await h.user("paula");
    const other = await login("paula@example.test");
    expect(
      (
        await h.call("POST", "/me/password", {
          token: u.token,
          body: { currentPassword: "wrong one", newPassword: "a brand new passphrase" },
        })
      ).status,
    ).toBe(403);
    const ok = await h.call("POST", "/me/password", {
      token: u.token,
      body: { currentPassword: "correct horse battery", newPassword: "a brand new passphrase" },
    });
    expect(ok.status).toBe(200);
    expect((await h.call("GET", "/me", { token: u.token })).status).toBe(200); // the session that changed it survives
    expect((await h.call("GET", "/me", { token: other.body.token })).status).toBe(401); // every other session ends
    expect((await login("paula@example.test")).status).toBe(401);
    expect((await login("paula@example.test", "a brand new passphrase")).status).toBe(200);
  });
});

describe("account moderation", () => {
  it("lets moderators deactivate members, with a public reason, without erasing contributions", async () => {
    const member = await h.user("quentin");
    const mod = await h.user("quinn-mod", "moderator");
    const idea = await h.idea(member.token, { title: "An idea by someone later deactivated" });

    const reason = { reason: "Repeated spam after warnings" };
    expect(
      (await h.call("POST", "/people/quentin/deactivate", { token: member.token, body: reason })).status,
    ).toBe(403);
    const res = await h.call<PersonDto>("POST", "/people/quentin/deactivate", {
      token: mod.token,
      body: reason,
    });
    expect(res.body).toMatchObject({ handle: "quentin", active: false });
    expect(
      (await h.call("POST", "/people/quentin/deactivate", { token: mod.token, body: reason })).status,
    ).toBe(409);

    expect((await h.call("GET", "/me", { token: member.token })).status).toBe(401); // sessions ended
    expect((await login("quentin@example.test")).status).toBe(401); // cannot sign in
    expect((await h.call("GET", `/ideas/${idea.id}`)).body.proposedBy.handle).toBe("quentin"); // still attributed

    const log = await h.call<Page<ActivityDto>>("GET", "/activity?action=moderation.");
    expect(log.body.items[0]).toMatchObject({ action: "moderation.person_deactivated", payload: reason });

    const back = await h.call<PersonDto>("POST", "/people/quentin/reactivate", {
      token: mod.token,
      body: { reason: "Appeal upheld" },
    });
    expect(back.body.active).toBe(true);
    expect((await login("quentin@example.test")).status).toBe(200);
  });

  it("protects moderators and admins from moderators, and everyone from self-moderation", async () => {
    const mod = await h.user("rhea-mod", "moderator");
    const otherMod = await h.user("rory-mod", "moderator");
    const admin = await h.user("root-admin", "admin");
    const body = { reason: "Testing protections" };
    expect((await h.call("POST", "/people/rory-mod/deactivate", { token: mod.token, body })).status).toBe(
      403,
    );
    expect((await h.call("POST", "/people/root-admin/deactivate", { token: mod.token, body })).status).toBe(
      403,
    );
    expect((await h.call("POST", "/people/root-admin/deactivate", { token: admin.token, body })).status).toBe(
      422,
    );
    expect((await h.call("POST", "/people/rory-mod/deactivate", { token: admin.token, body })).status).toBe(
      200,
    );
    expect((await h.call("GET", "/me", { token: otherMod.token })).status).toBe(401);
  });
});

describe("roles", () => {
  it("lets admins (only) change roles, never their own, and logs it publicly", async () => {
    const member = await h.user("sami");
    const admin = await h.user("sage-admin", "admin");
    expect(
      (await h.call("PUT", "/people/sami/role", { token: member.token, body: { role: "admin" } })).status,
    ).toBe(403);
    expect(
      (await h.call("PUT", "/people/sage-admin/role", { token: admin.token, body: { role: "member" } }))
        .status,
    ).toBe(422);
    const promoted = await h.call<PersonDto>("PUT", "/people/sami/role", {
      token: admin.token,
      body: { role: "moderator" },
    });
    expect(promoted.body.role).toBe("moderator");
    expect((await h.call<MeResponse>("GET", "/me", { token: member.token })).body.person.role).toBe(
      "moderator",
    );
    const feed = await h.call<Page<ActivityDto>>("GET", "/activity?action=person.role_changed");
    expect(feed.body.items[0]).toMatchObject({ payload: { from: "member", to: "moderator" } });
  });
});

describe("abuse protection", () => {
  it("rate-limits authentication attempts per client address", async () => {
    const limited = await createHarness({
      rateLimits: { requestsPerMinute: 0, authPerMinute: 3, writesPerMinute: 0 },
    });
    try {
      const attempts = [];
      for (let i = 0; i < 4; i++)
        attempts.push(
          await limited.call("POST", "/auth/login", {
            body: { email: "nobody@example.test", password: "x" },
          }),
        );
      expect(attempts.map((a) => a.status)).toEqual([401, 401, 401, 429]);
      expect(attempts[3]!.body.error).toMatchObject({
        code: "rate_limited",
        details: { retryAfterSeconds: expect.any(Number) },
      });
    } finally {
      await limited.close();
    }
  });

  it("rate-limits writes per account and rejects oversized bodies", async () => {
    const limited = await createHarness({
      rateLimits: { requestsPerMinute: 0, authPerMinute: 0, writesPerMinute: 2 },
      maxBodyBytes: 2_000,
    });
    try {
      const u = await limited.user("tessa"); // registration is the first write from this address
      const idea = await limited.idea(u.token); // first write for the account
      expect(
        (await limited.call("PUT", `/ideas/${idea.id}/stances/important`, { token: u.token })).status,
      ).toBe(200);
      const third = await limited.call("PUT", `/ideas/${idea.id}/stances/plausible`, { token: u.token });
      expect(third.status).toBe(429);
      expect((await limited.call("GET", `/ideas/${idea.id}`, { token: u.token })).status).toBe(200); // reads are not limited

      const big = await limited.call("POST", "/auth/login", {
        body: { email: "x@example.test", password: "y".repeat(5_000) },
      });
      expect(big.status).toBe(413);
      expect(big.body.error.code).toBe("payload_too_large");
    } finally {
      await limited.close();
    }
  });
});
