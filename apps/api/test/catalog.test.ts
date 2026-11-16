import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IdeaClaimDto, SearchResults, TopicDetailDto, TopicDto } from "@ideaproxima/contracts";
import { createHarness, type Harness } from "./harness";

/**
 * Counts that are derived in SQL. Regression tests for a bug where every topic reported 0 ideas and every searched
 * claim "underpinned 0 ideas": Drizzle renders a single-table select's column as a bare "id", which inside a
 * correlated subquery bound to the inner table.
 */
let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

const topic = async (slug: string) =>
  (await h.call<TopicDto[]>("GET", "/topics")).body.find((t) => t.slug === slug)!;

describe("topic counts", () => {
  it("counts visible ideas in a topic and its direct children, once each, and lists the newest", async () => {
    const author = await h.user("tess");
    const admin = await h.user("root", "admin");
    const mod = await h.user("moderator", "moderator");
    expect((await topic("environment")).ideaCount).toBe(0);
    expect((await topic("environment")).latestIdeas).toEqual([]);

    const first = await h.idea(author.token, {
      title: "Ocean alkalinity enhancement",
      topics: ["environment"],
    });
    await h.idea(author.token, { title: "Kelp carbon farms", topics: ["environment", "biology"] });
    const third = await h.idea(author.token, {
      title: "Soil microbiome restoration",
      topics: ["environment"],
    });

    const env = await topic("environment");
    expect(env.ideaCount).toBe(3);
    expect(env.latestIdeas.map((i) => i.title)).toEqual(["Soil microbiome restoration", "Kelp carbon farms"]);
    expect(env.latestIdeas[0]).toMatchObject({ id: third.id, slug: third.slug, stage: "imagined" });
    expect((await topic("biology")).ideaCount).toBe(1);
    expect((await topic("medicine")).ideaCount).toBe(0);

    // An idea in a child topic counts for the parent; one in both parent and child counts once.
    await h.call("POST", "/topics", {
      token: admin.token,
      body: { name: "Restoration ecology", parentSlug: "environment" },
    });
    await h.idea(author.token, { title: "Rewilding corridors", topics: ["restoration-ecology"] });
    await h.idea(author.token, {
      title: "Wetland seed banks",
      topics: ["environment", "restoration-ecology"],
    });
    const detail = await h.call<TopicDetailDto>("GET", "/topics/environment");
    expect(detail.body.ideaCount).toBe(5);
    expect(detail.body.children.map((c) => [c.slug, c.ideaCount])).toEqual([["restoration-ecology", 2]]);

    // Hidden ideas are not counted.
    await h.call("POST", "/moderation", {
      token: mod.token,
      body: { target: { kind: "idea", id: first.id }, action: "hide", reason: "Test" },
    });
    expect((await topic("environment")).ideaCount).toBe(4);
  });
});

describe("claim search", () => {
  it("reports how many ideas a claim underpins and its derived status", async () => {
    const u = await h.user("sam");
    const a = await h.idea(u.token, { title: "Nanoscale water purifiers" });
    const b = await h.idea(u.token, { title: "Self-powered medical microbots" });
    const claim = await h.call<IdeaClaimDto>("POST", `/ideas/${a.id}/claims`, {
      token: u.token,
      body: { statement: "Nanoscale devices can harvest energy from their medium.", role: "prerequisite" },
    });
    await h.call("POST", `/ideas/${b.id}/claims`, {
      token: u.token,
      body: { claimId: claim.body.id, role: "prerequisite" },
    });

    const found = await h.call<SearchResults>("GET", "/search?q=harvest%20energy");
    expect(found.body.claims).toEqual([
      { id: claim.body.id, statement: claim.body.statement, ideaCount: 2, status: "unassessed" },
    ]);
  });
});
