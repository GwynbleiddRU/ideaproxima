import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { ActivityDto, CommentDto, IdeaListItem, Page, ProfileDto } from "@ideaproxima/contracts";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

describe("authentication", () => {
  it("registers, logs in, resolves sessions and revokes them on logout", async () => {
    const reg = await h.user("dana");
    expect((await h.call("GET", "/me", { token: reg.token })).body).toMatchObject({
      email: "dana@example.test",
      person: { handle: "dana" },
    });
    expect((await h.call("GET", "/me")).status).toBe(401);
    expect((await h.call("GET", "/me", { token: "forged" })).status).toBe(401);

    const dupEmail = await h.call("POST", "/auth/register", {
      body: {
        handle: "dana2",
        displayName: "Dana",
        email: "DANA@example.test",
        password: "another long password",
      },
    });
    expect(dupEmail.status).toBe(409);
    const dupHandle = await h.call("POST", "/auth/register", {
      body: {
        handle: "dana",
        displayName: "Dana",
        email: "x@example.test",
        password: "another long password",
      },
    });
    expect(dupHandle.status).toBe(409);

    expect(
      (
        await h.call("POST", "/auth/login", {
          body: { email: "dana@example.test", password: "wrong password!" },
        })
      ).status,
    ).toBe(401);
    const login = await h.call("POST", "/auth/login", {
      body: { email: "Dana@Example.test", password: "correct horse battery" },
    });
    expect(login.status).toBe(200);
    await h.call("POST", "/auth/logout", { token: login.body.token });
    expect((await h.call("GET", "/me", { token: login.body.token })).status).toBe(401);
    expect((await h.call("GET", "/me", { token: reg.token })).status).toBe(200); // other sessions unaffected
  });

  it("updates profiles and declares expertise as dated facts", async () => {
    const u = await h.user("erin");
    const patched = await h.call("PATCH", "/me", {
      token: u.token,
      body: { bio: "Synthetic biologist.", capacities: ["research", "funding"] },
    });
    expect(patched.body.capacities).toEqual(["research", "funding"]);
    expect(
      (await h.call("PATCH", "/me", { token: u.token, body: { capacities: ["astrology"] } })).status,
    ).toBe(400);
    await h.call("POST", "/me/expertise", { token: u.token, body: { topic: "biology", note: "PhD" } });
    const profile = await h.call<ProfileDto>("GET", "/people/erin");
    expect(profile.body.expertise).toEqual([
      expect.objectContaining({
        basis: "self_declared",
        topic: expect.objectContaining({ slug: "biology" }),
      }),
    ]);
    expect((await h.call("DELETE", "/me/expertise/biology", { token: u.token })).body).toEqual([]);
  });

  it("requires JSON bodies (CSRF defence)", async () => {
    const res = await h.call("POST", "/auth/login", {});
    expect(res.status).toBe(400);
  });
});

describe("moderation hides, never deletes, and is publicly logged", () => {
  it("restricts moderation to moderators and keeps the record", async () => {
    const author = await h.user("frank");
    const mod = await h.user("mod", "moderator");
    const idea = await h.idea(author.token, { title: "An idea that will be hidden" });

    const hideReq = { target: { kind: "idea", id: idea.id }, action: "hide", reason: "Spam" };
    expect((await h.call("POST", "/moderation", { token: author.token, body: hideReq })).status).toBe(403);
    expect((await h.call("POST", "/moderation", { token: mod.token, body: hideReq })).status).toBe(200);
    expect((await h.call("POST", "/moderation", { token: mod.token, body: hideReq })).status).toBe(409);

    expect((await h.call("GET", `/ideas/${idea.id}`)).status).toBe(404);
    expect((await h.call("GET", `/ideas/${idea.id}`, { token: mod.token })).body.hidden).toBe(true);
    const list = await h.call<Page<IdeaListItem>>("GET", "/ideas?limit=100");
    expect(list.body.items.map((i) => i.id)).not.toContain(idea.id);

    const log = await h.call<Page<ActivityDto>>("GET", "/activity?action=moderation.");
    expect(log.body.items[0]).toMatchObject({
      action: "moderation.hidden",
      payload: { reason: "Spam" },
      actor: { handle: "mod" },
    });
    const feed = await h.call<Page<ActivityDto>>("GET", "/activity?limit=100");
    expect(
      feed.body.items.find((a) => a.action === "idea.proposed" && a.subject.id === idea.id),
    ).toBeUndefined();

    expect(
      (
        await h.call("POST", "/moderation", {
          token: mod.token,
          body: { ...hideReq, action: "restore", reason: "Appeal upheld" },
        })
      ).status,
    ).toBe(200);
    expect((await h.call("GET", `/ideas/${idea.id}`)).status).toBe(200);
  });

  it("redacts hidden comments but keeps their place in the thread", async () => {
    const author = await h.user("gina");
    const mod = await h.user("mod2", "moderator");
    const idea = await h.idea(author.token);
    const c1 = await h.call<CommentDto>("POST", `/ideas/${idea.id}/comments`, {
      token: author.token,
      body: { body: "Original question?", kind: "question" },
    });
    await h.call("POST", `/ideas/${idea.id}/comments`, {
      token: mod.token,
      body: { body: "A reply.", parentId: c1.body.id },
    });
    await h.call("POST", "/moderation", {
      token: mod.token,
      body: { target: { kind: "comment", id: c1.body.id }, action: "hide", reason: "Off-topic" },
    });
    const thread = await h.call<Page<CommentDto>>("GET", `/ideas/${idea.id}/comments`);
    expect(thread.body.items.map((c) => [c.hidden, c.body])).toEqual([
      [true, ""],
      [false, "A reply."],
    ]);
    const other = await h.idea(author.token);
    expect(
      (
        await h.call("POST", `/ideas/${other.id}/comments`, {
          token: author.token,
          body: { body: "Wrong thread", parentId: c1.body.id },
        })
      ).status,
    ).toBe(400);
  });
});

describe("the activity ledger", () => {
  it("is append-only at the database level", async () => {
    // Drizzle wraps driver errors; the trigger's message is on the cause.
    const appendOnly = (e: { message?: string; cause?: { message?: string } }) =>
      /append-only/.test(e.cause?.message ?? e.message ?? "");
    await expect(h.db.execute(sql`update activities set action = 'rewritten'`)).rejects.toSatisfy(appendOnly);
    await expect(h.db.execute(sql`delete from activities`)).rejects.toSatisfy(appendOnly);
  });

  it("records contributions per person", async () => {
    const u = await h.user("hank");
    await h.idea(u.token);
    const act = await h.call<Page<ActivityDto>>("GET", "/people/hank/activity");
    expect(act.body.items.map((a) => a.action)).toEqual(["idea.proposed", "person.registered"]);
    const profile = await h.call<ProfileDto>("GET", "/people/hank");
    expect(profile.body.contributions.ideasProposed).toBe(1);
    expect(profile.body.ideas).toHaveLength(1);
  });
});

describe("catalog", () => {
  it("serves topics, vocabulary and cross-entity search", async () => {
    const topics = await h.call("GET", "/topics");
    expect(topics.body.map((t: { slug: string }) => t.slug)).toContain("governance");
    const vocab = await h.call("GET", "/vocabulary");
    expect(vocab.body.lenses.map((l: { key: string }) => l.key)).toContain("neglected");
    expect(vocab.body.dimensions.find((d: { key: string }) => d.key === "impact").scale.anchors["5"]).toBe(
      "Civilization-scale",
    );
    const u = await h.user("ivan");
    await h.idea(u.token, { title: "Lottery-selected citizens assemblies" });
    const found = await h.call("GET", "/search?q=citizens");
    expect(found.body.ideas.map((i: { title: string }) => i.title)).toEqual([
      "Lottery-selected citizens assemblies",
    ]);
    expect((await h.call("GET", "/search")).status).toBe(400);
    expect((await h.call("GET", "/no-such-endpoint")).status).toBe(404);
  });

  it("lets only admins create topics", async () => {
    const member = await h.user("judy");
    const admin = await h.user("root", "admin");
    expect(
      (
        await h.call("POST", "/topics", {
          token: member.token,
          body: { name: "Synthetic biology", parentSlug: "biology" },
        })
      ).status,
    ).toBe(403);
    const created = await h.call("POST", "/topics", {
      token: admin.token,
      body: { name: "Synthetic biology", parentSlug: "biology" },
    });
    expect(created.status).toBe(201);
    expect(
      (await h.call("GET", "/topics/biology")).body.children.map((c: { slug: string }) => c.slug),
    ).toEqual(["synthetic-biology"]);
  });
});
