import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GraphDto, IdeaDetail, IdeaRelationView, RelationDto } from "@ideaproxima/contracts";
import { createHarness, type Harness } from "./harness";

let h: Harness;
let u: Awaited<ReturnType<Harness["user"]>>;
let other: Awaited<ReturnType<Harness["user"]>>;
const ideas: Record<string, IdeaDetail> = {};

const relate = (fromIdeaId: string, toIdeaId: string, type: string, token = u.token) =>
  h.call<RelationDto>("POST", "/relations", { token, body: { fromIdeaId, toIdeaId, type } });

beforeAll(async () => {
  h = await createHarness();
  u = await h.user("grapher");
  other = await h.user("bystander");
  for (const name of [
    "Molecular manufacturing",
    "Water-cleaning nanorobots",
    "Medical microbots",
    "Smart materials",
    "Membrane filtration",
    "Atmospheric water",
  ]) {
    ideas[name] = await h.idea(u.token, { title: name });
  }
  const id = (n: string) => ideas[n]!.id;
  // nanorobots and microbots build on molecular manufacturing; smart materials apply nanorobots.
  await relate(id("Water-cleaning nanorobots"), id("Molecular manufacturing"), "requires");
  await relate(id("Medical microbots"), id("Molecular manufacturing"), "requires");
  await relate(id("Smart materials"), id("Water-cleaning nanorobots"), "applies");
  await relate(id("Membrane filtration"), id("Water-cleaning nanorobots"), "alternative_to");
  await relate(id("Atmospheric water"), id("Membrane filtration"), "complements");
});
afterAll(() => h.close());

describe("idea graph", () => {
  it("answers 'what would realising this unlock?' (downstream traversal)", async () => {
    const res = await h.call<GraphDto>(
      "GET",
      `/ideas/${ideas["Molecular manufacturing"]!.id}/graph?direction=downstream&depth=3`,
    );
    const byTitle = Object.fromEntries(res.body.nodes.map((n) => [n.title, n.distance]));
    expect(byTitle).toEqual({
      "Molecular manufacturing": 0,
      "Water-cleaning nanorobots": 1,
      "Medical microbots": 1,
      "Smart materials": 2,
    });
    expect(res.body.edges).toHaveLength(3);
  });

  it("answers 'what must exist first?' (upstream) and respects depth", async () => {
    const up = await h.call<GraphDto>(
      "GET",
      `/ideas/${ideas["Smart materials"]!.id}/graph?direction=upstream&depth=1`,
    );
    expect(up.body.nodes.map((n) => n.title).sort()).toEqual([
      "Smart materials",
      "Water-cleaning nanorobots",
    ]);
    const deeper = await h.call<GraphDto>(
      "GET",
      `/ideas/${ideas["Smart materials"]!.id}/graph?direction=upstream&depth=4`,
    );
    expect(deeper.body.nodes).toHaveLength(3);
    expect((await h.call("GET", `/ideas/${ideas["Smart materials"]!.id}/graph?depth=9`)).status).toBe(400);
  });

  it("explores the whole neighbourhood, including symmetric relations", async () => {
    const both = await h.call<GraphDto>(
      "GET",
      `/ideas/${ideas["Water-cleaning nanorobots"]!.id}/graph?direction=both&depth=2`,
    );
    expect(both.body.nodes.map((n) => n.title)).toContain("Atmospheric water");
  });

  it("phrases relations from the focal idea", async () => {
    const rels = await h.call<IdeaRelationView[]>(
      "GET",
      `/ideas/${ideas["Molecular manufacturing"]!.id}/relations`,
    );
    expect(rels.body.map((r) => `${r.phrase} ${r.other.title}`).sort()).toEqual([
      "is required by Medical microbots",
      "is required by Water-cleaning nanorobots",
    ]);
  });

  it("names the other endpoint of symmetric relations from both sides (stored in canonical order)", async () => {
    for (const [focal, other] of [
      ["Membrane filtration", "Atmospheric water"],
      ["Atmospheric water", "Membrane filtration"],
    ] as const) {
      const rels = await h.call<IdeaRelationView[]>("GET", `/ideas/${ideas[focal]!.id}/relations`);
      const complement = rels.body.find((r) => r.type === "complements")!;
      expect(complement).toMatchObject({
        direction: "symmetric",
        phrase: "complements",
        other: { title: other },
      });
    }
  });

  it("prevents self-relations and duplicate symmetric relations in either direction", async () => {
    const a = ideas["Membrane filtration"]!.id;
    const b = ideas["Water-cleaning nanorobots"]!.id;
    expect((await relate(a, a, "requires")).status).toBe(422);
    expect((await relate(b, a, "alternative_to")).status).toBe(409);
  });

  it("lets proposers or stewards retract relations, and keeps them out of traversal", async () => {
    const rel = await relate(
      ideas["Atmospheric water"]!.id,
      ideas["Medical microbots"]!.id,
      "conflicts_with",
      other.token,
    );
    const stranger = await h.user("stranger");
    expect(
      (await h.call("POST", `/relations/${rel.body.id}/retract`, { token: stranger.token })).status,
    ).toBe(403);
    expect((await h.call("POST", `/relations/${rel.body.id}/retract`, { token: u.token })).status).toBe(200); // steward of both ideas
    const rels = await h.call<IdeaRelationView[]>(
      "GET",
      `/ideas/${ideas["Medical microbots"]!.id}/relations`,
    );
    expect(rels.body.map((r) => r.type)).toEqual(["requires"]);
    expect(
      (
        await h.call("POST", "/evaluations", {
          token: other.token,
          body: {
            target: { kind: "relation", id: rel.body.id },
            ratings: [{ dimension: "validity", value: 4 }],
          },
        })
      ).status,
    ).toBe(404);
  });
});
