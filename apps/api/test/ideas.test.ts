import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { IdeaDetail, Page, IdeaListItem, RevisionDto, ActivityDto } from "@ideaproxima/contracts";
import { createHarness, type Harness } from "./harness";

let h: Harness;
let alice: { token: string; id: string; handle: string };
let bob: { token: string; id: string; handle: string };

beforeAll(async () => {
  h = await createHarness();
  alice = await h.user("alice");
  bob = await h.user("bob");
});
afterAll(() => h.close());

describe("proposing an idea", () => {
  it("records identity, first revision, originator stewardship, stage and ledger entry together", async () => {
    const idea = await h.idea(alice.token, {
      title: "Water-cleaning nanorobots",
      topics: ["environment", "technology"],
      tags: ["Water", "water", "nanotech"],
      sections: { overview: "Swarms of machines far smaller than a cell could remove contaminants." },
    });
    expect(idea.slug).toBe("water-cleaning-nanorobots");
    expect(idea.stage).toBe("imagined");
    expect(idea.revision.number).toBe(1);
    expect(idea.topics.map((t) => t.slug)).toEqual(["environment", "technology"]);
    expect(idea.tags).toEqual(["water", "nanotech"]);
    expect(idea.stewards).toEqual([
      expect.objectContaining({ role: "originator", person: expect.objectContaining({ id: alice.id }) }),
    ]);
    expect(idea.signals.algorithm).toBe("baseline-v0");
    expect(idea.viewer?.isSteward).toBe(true);
    expect((await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`)).body.viewer).toBeNull();

    const timeline = await h.call<Page<ActivityDto>>("GET", `/ideas/${idea.id}/timeline`);
    expect(timeline.body.items.map((a) => a.action)).toEqual(["idea.proposed"]);
    const stages = await h.call("GET", `/ideas/${idea.slug}/stages`);
    expect(stages.body).toEqual([expect.objectContaining({ from: null, to: "imagined" })]);
  });

  it("gives colliding titles distinct slugs and resolves ideas by id or slug", async () => {
    const a = await h.idea(alice.token, { title: "Orbital sunshades" });
    const b = await h.idea(bob.token, { title: "Orbital sunshades" });
    expect(b.slug).toBe("orbital-sunshades-2");
    expect((await h.call("GET", `/ideas/${a.id}`)).body.slug).toBe("orbital-sunshades");
    expect((await h.call("GET", `/ideas/orbital-sunshades-2`)).body.id).toBe(b.id);
  });

  it("validates input and requires authentication", async () => {
    expect(
      (
        await h.call("POST", "/ideas", {
          body: { title: "Anonymous idea", summary: "x".repeat(30), topics: ["science"] },
        })
      ).status,
    ).toBe(401);
    const unknownTopic = await h.call("POST", "/ideas", {
      token: alice.token,
      body: { title: "Some idea title", summary: "x".repeat(30), topics: ["astrology"] },
    });
    expect(unknownTopic.status).toBe(400);
    expect(unknownTopic.body.error.message).toMatch(/astrology/);
    const tooShort = await h.call("POST", "/ideas", {
      token: alice.token,
      body: { title: "x", summary: "y", topics: [] },
    });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe("validation_failed");
  });

  it("returns viewer state for signed-in readers", async () => {
    const idea = await h.idea(alice.token);
    const asAlice = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`, { token: alice.token });
    expect(asAlice.body.viewer).toMatchObject({ isSteward: true, stances: [], ratings: [] });
    const asBob = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`, { token: bob.token });
    expect(asBob.body.viewer?.isSteward).toBe(false);
  });
});

describe("revisions: the idea's narrative history", () => {
  const content = (idea: IdeaDetail, patch: Record<string, unknown> = {}) => ({
    title: idea.title,
    summary: idea.summary,
    topics: idea.topics.map((t) => t.slug),
    tags: idea.tags,
    sections: idea.sections,
    ...patch,
  });

  it("lets a steward publish directly and rejects no-op and stale edits", async () => {
    const idea = await h.idea(alice.token);
    const noop = await h.call("POST", `/ideas/${idea.id}/revisions`, {
      token: alice.token,
      body: { baseRevisionId: idea.revision.id, content: content(idea), changeNote: "Nothing" },
    });
    expect(noop.status).toBe(400);

    const published = await h.call<RevisionDto>("POST", `/ideas/${idea.id}/revisions`, {
      token: alice.token,
      body: {
        baseRevisionId: idea.revision.id,
        content: content(idea, { summary: "A revised and clearer summary of the idea." }),
        changeNote: "Clarify",
      },
    });
    expect(published.status).toBe(201);
    expect(published.body).toMatchObject({ number: 2, status: "accepted" });

    // Publishing on top of the old base would silently discard revision 2.
    const stale = await h.call("POST", `/ideas/${idea.id}/revisions`, {
      token: alice.token,
      body: {
        baseRevisionId: idea.revision.id,
        content: content(idea, { summary: "Another competing summary text." }),
        changeNote: "Stale",
      },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentRevisionId).toBe(published.body.id);

    const current = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(current.body.summary).toBe("A revised and clearer summary of the idea.");
    expect(current.body.revision.number).toBe(2);
  });

  it("turns non-steward edits into proposals that stewards decide", async () => {
    const idea = await h.idea(alice.token);
    const proposal = await h.call<RevisionDto>("POST", `/ideas/${idea.id}/revisions`, {
      token: bob.token,
      body: {
        baseRevisionId: idea.revision.id,
        content: content(idea, {
          sections: { mechanism: "Bob explains a plausible mechanism in some detail." },
        }),
        changeNote: "Add mechanism",
      },
    });
    expect(proposal.body.status).toBe("proposed");
    expect((await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`)).body.pendingRevisionProposals).toBe(1);

    // Bob cannot accept his own proposal; and cannot force-publish.
    expect(
      (
        await h.call("POST", `/ideas/${idea.id}/revisions/${proposal.body.id}/decision`, {
          token: bob.token,
          body: { decision: "accept" },
        })
      ).status,
    ).toBe(403);
    const forced = await h.call("POST", `/ideas/${idea.id}/revisions`, {
      token: bob.token,
      body: {
        baseRevisionId: idea.revision.id,
        content: content(idea, { summary: "Bob forcing a publish of his text." }),
        changeNote: "Force it",
        intent: "publish",
      },
    });
    expect(forced.status).toBe(403);

    const accepted = await h.call<RevisionDto>(
      "POST",
      `/ideas/${idea.id}/revisions/${proposal.body.id}/decision`,
      {
        token: alice.token,
        body: { decision: "accept", note: "Thanks!" },
      },
    );
    expect(accepted.body).toMatchObject({
      status: "accepted",
      decidedBy: expect.objectContaining({ id: alice.id }),
    });
    const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(detail.body.sections.mechanism).toMatch(/Bob explains/);
    expect(detail.body.revision.author.id).toBe(bob.id); // attribution of the development goes to Bob

    const again = await h.call("POST", `/ideas/${idea.id}/revisions/${proposal.body.id}/decision`, {
      token: alice.token,
      body: { decision: "reject" },
    });
    expect(again.status).toBe(422);
  });

  it("refuses to accept a proposal whose base is no longer current", async () => {
    const idea = await h.idea(alice.token);
    const proposal = await h.call<RevisionDto>("POST", `/ideas/${idea.id}/revisions`, {
      token: bob.token,
      body: {
        baseRevisionId: idea.revision.id,
        content: content(idea, { summary: "Bob's alternative summary text here." }),
        changeNote: "Bob",
      },
    });
    await h.call("POST", `/ideas/${idea.id}/revisions`, {
      token: alice.token,
      body: {
        baseRevisionId: idea.revision.id,
        content: content(idea, { summary: "Alice's own newer summary text here." }),
        changeNote: "Alice",
      },
    });
    const res = await h.call("POST", `/ideas/${idea.id}/revisions/${proposal.body.id}/decision`, {
      token: alice.token,
      body: { decision: "accept" },
    });
    expect(res.status).toBe(409);
  });

  it("keeps every revision and its content retrievable", async () => {
    const idea = await h.idea(alice.token);
    await h.call("POST", `/ideas/${idea.id}/revisions`, {
      token: alice.token,
      body: {
        baseRevisionId: idea.revision.id,
        content: content(idea, { title: "A renamed idea title" }),
        changeNote: "Rename",
      },
    });
    const list = await h.call<RevisionDto[]>("GET", `/ideas/${idea.id}/revisions`);
    expect(list.body.map((r) => r.number)).toEqual([2, 1]);
    const first = await h.call<RevisionDto>("GET", `/ideas/${idea.id}/revisions/${idea.revision.id}`);
    expect(first.body.content.title).toBe(idea.title);
  });

  it("makes revision content immutable at the database level", async () => {
    const idea = await h.idea(alice.token);
    await expect(
      h.db.execute(sql`update idea_revisions set content = '{}'::jsonb where id = ${idea.revision.id}`),
    ).rejects.toThrow();
    await expect(
      h.db.execute(sql`delete from idea_revisions where id = ${idea.revision.id}`),
    ).rejects.toThrow();
    await expect(h.db.execute(sql`delete from ideas where id = ${idea.id}`)).rejects.toThrow();
  });
});

describe("stewardship", () => {
  it("lets stewards appoint co-stewards who can then publish", async () => {
    const idea = await h.idea(alice.token);
    expect(
      (await h.call("POST", `/ideas/${idea.id}/stewards`, { token: bob.token, body: { handle: "bob" } }))
        .status,
    ).toBe(403);
    const res = await h.call("POST", `/ideas/${idea.id}/stewards`, {
      token: alice.token,
      body: { handle: "bob" },
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(
      (await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`, { token: bob.token })).body.viewer?.isSteward,
    ).toBe(true);
  });
});

describe("listing", () => {
  it("lists newest first with opaque cursor pagination and filters", async () => {
    const page1 = await h.call<Page<IdeaListItem>>("GET", "/ideas?limit=2");
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await h.call<Page<IdeaListItem>>("GET", `/ideas?limit=2&cursor=${page1.body.nextCursor}`);
    expect(page2.body.items[0]!.id).not.toBe(page1.body.items[0]!.id);
    expect((await h.call("GET", "/ideas?cursor=garbage")).status).toBe(400);

    const env = await h.call<Page<IdeaListItem>>("GET", "/ideas?topic=environment");
    expect(env.body.items.map((i) => i.title)).toEqual(["Water-cleaning nanorobots"]);
    const search = await h.call<Page<IdeaListItem>>("GET", "/ideas?q=nanorobot");
    expect(search.body.items.map((i) => i.title)).toEqual(["Water-cleaning nanorobots"]);
    const tag = await h.call<Page<IdeaListItem>>("GET", "/ideas?tag=Water");
    expect(tag.body.items).toHaveLength(1);
  });
});

describe("withdrawing a proposal", () => {
  it("lets only the author withdraw a pending proposal, and keeps it on record", async () => {
    const idea = await h.idea(alice.token);
    const proposal = await h.call<RevisionDto>("POST", `/ideas/${idea.id}/revisions`, {
      token: bob.token,
      body: {
        baseRevisionId: idea.revision.id,
        changeNote: "A proposal to withdraw",
        content: {
          title: idea.title,
          summary: "Bob's tentative alternative summary.",
          topics: ["technology"],
        },
      },
    });
    const path = `/ideas/${idea.id}/revisions/${proposal.body.id}/withdraw`;
    expect((await h.call("POST", path, { token: alice.token })).status).toBe(403);
    const withdrawn = await h.call<RevisionDto>("POST", path, { token: bob.token });
    expect(withdrawn.body.status).toBe("withdrawn");
    expect((await h.call("POST", path, { token: bob.token })).status).toBe(422);
    const listed = await h.call<RevisionDto[]>("GET", `/ideas/${idea.id}/revisions?status=withdrawn`);
    expect(listed.body.map((r) => r.id)).toEqual([proposal.body.id]);
  });
});
