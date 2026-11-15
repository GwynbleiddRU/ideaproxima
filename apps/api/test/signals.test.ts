import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asc, sql } from "drizzle-orm";
import type { EvaluationDto, IdeaDetail, IdeaListItem, InvolvementDto, Page } from "@ideaproxima/contracts";
import { uniformWeights } from "@ideaproxima/domain";
import { queryRows } from "../src/db/client";
import { ideaMetrics } from "../src/db/schema";
import { rebuildAllIdeaMetrics } from "../src/modules/metrics/service";
import { createHarness, type Harness } from "./harness";

let h: Harness;
let users: Awaited<ReturnType<Harness["user"]>>[];

beforeAll(async () => {
  h = await createHarness();
  users = [];
  for (const name of ["ann", "ben", "cat", "dan", "eve", "fay"]) users.push(await h.user(name));
});
afterAll(() => h.close());

const rate = (
  token: string,
  ideaId: string,
  ratings: { dimension: string; value: number }[],
  rationale?: string,
) =>
  h.call("POST", "/evaluations", {
    token,
    body: { target: { kind: "idea", id: ideaId }, ratings, rationale },
  });

describe("evaluations are append-only observations", () => {
  it("supersedes instead of overwriting, and keeps the history", async () => {
    const idea = await h.idea(users[0]!.token);
    const first = await rate(users[1]!.token, idea.id, [
      { dimension: "impact", value: 2 },
      { dimension: "novelty", value: 3 },
    ]);
    expect(first.status).toBe(200);
    expect(first.body.changed).toEqual(["impact", "novelty"]);
    const second = await rate(users[1]!.token, idea.id, [{ dimension: "impact", value: 5 }]);
    expect(second.body.changed).toEqual(["impact"]);
    expect(second.body.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: "impact", value: 5 }),
        expect.objectContaining({ dimension: "novelty", value: 3 }),
      ]),
    );

    const current = await h.call<Page<EvaluationDto>>(
      "GET",
      `/evaluations?targetKind=idea&targetId=${idea.id}`,
    );
    expect(current.body.items.map((e) => [e.dimension, e.value]).sort()).toEqual([
      ["impact", 5],
      ["novelty", 3],
    ]);
    const all = await h.call<Page<EvaluationDto>>(
      "GET",
      `/evaluations?targetKind=idea&targetId=${idea.id}&history=all`,
    );
    expect(all.body.items).toHaveLength(3);
    expect(all.body.items.find((e) => e.value === 2)?.supersededAt).toBeTruthy();

    const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(detail.body.signals.ratings.impact).toEqual({ value: 1, mean: 5, dispersion: 0, n: 1 });
  });

  it("treats identical resubmission as a no-op (safe retries, no history noise)", async () => {
    const idea = await h.idea(users[0]!.token);
    await rate(users[2]!.token, idea.id, [{ dimension: "feasibility", value: 2 }], "same");
    const again = await rate(users[2]!.token, idea.id, [{ dimension: "feasibility", value: 2 }], "same");
    expect(again.body.changed).toEqual([]);
    const all = await h.call<Page<EvaluationDto>>(
      "GET",
      `/evaluations?targetKind=idea&targetId=${idea.id}&history=all`,
    );
    expect(all.body.items).toHaveLength(1);
  });

  it("withdraws ratings without deleting them", async () => {
    const idea = await h.idea(users[0]!.token);
    await rate(users[3]!.token, idea.id, [{ dimension: "evidence", value: 4 }]);
    const res = await h.call("POST", "/evaluations/withdraw", {
      token: users[3]!.token,
      body: { target: { kind: "idea", id: idea.id }, dimensions: ["evidence"] },
    });
    expect(res.body.current).toEqual([]);
    expect(
      (await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`)).body.signals.ratings.evidence,
    ).toBeUndefined();
    const all = await h.call<Page<EvaluationDto>>(
      "GET",
      `/evaluations?targetKind=idea&targetId=${idea.id}&history=all`,
    );
    expect(all.body.items).toHaveLength(1);
  });

  it("rejects invalid dimensions and protects rows at the database level", async () => {
    const idea = await h.idea(users[0]!.token);
    expect((await rate(users[1]!.token, idea.id, [{ dimension: "popularity", value: 5 }])).status).toBe(400);
    expect((await rate(users[1]!.token, idea.id, [{ dimension: "support", value: 3 }])).status).toBe(400);
    expect((await rate(users[1]!.token, idea.id, [{ dimension: "impact", value: 9 }])).status).toBe(400);
    await rate(users[1]!.token, idea.id, [{ dimension: "impact", value: 3 }]);
    await expect(h.db.execute(sql`update evaluations set value = 5`)).rejects.toThrow();
    await expect(h.db.execute(sql`delete from evaluations`)).rejects.toThrow();
  });
});

describe("stances", () => {
  it("are idempotent, mutually exclusive where it matters, and retract without deleting", async () => {
    const idea = await h.idea(users[0]!.token);
    const t = users[1]!.token;
    expect((await h.call("PUT", `/ideas/${idea.id}/stances/important`, { token: t })).body.stances).toEqual([
      "important",
    ]);
    expect((await h.call("PUT", `/ideas/${idea.id}/stances/important`, { token: t })).body.stances).toEqual([
      "important",
    ]);
    await h.call("PUT", `/ideas/${idea.id}/stances/plausible`, { token: t });
    const doubt = await h.call("PUT", `/ideas/${idea.id}/stances/doubtful`, { token: t });
    expect(doubt.body.stances.sort()).toEqual(["doubtful", "important"]);
    expect(
      (await h.call("DELETE", `/ideas/${idea.id}/stances/important`, { token: t })).body.stances,
    ).toEqual(["doubtful"]);
    expect((await h.call("PUT", `/ideas/${idea.id}/stances/nonsense`, { token: t })).status).toBe(404);

    const [row] = await queryRows<{ n: number }>(
      h.db,
      sql`select count(*)::int as n from stances where idea_id = ${idea.id}`,
    );
    expect(row?.n).toBe(3); // important (retracted), plausible (displaced), doubtful (current)
    const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(detail.body.signals.perspectives.doubtful).toEqual({ count: 1, share: 1 });
    expect(detail.body.signals.attention).toBe(0);
  });
});

describe("popularity is not quality", () => {
  it("attention never moves quality metrics, and lenses rank them independently", async () => {
    const popular = await h.idea(users[0]!.token, { title: "A wildly popular speculation" });
    const evidenced = await h.idea(users[0]!.token, { title: "A quietly well evidenced proposal" });

    await rate(users[1]!.token, popular.id, [
      { dimension: "evidence", value: 1 },
      { dimension: "impact", value: 5 },
    ]);
    await rate(users[1]!.token, evidenced.id, [
      { dimension: "evidence", value: 5 },
      { dimension: "impact", value: 4 },
    ]);
    const before = (await h.call<IdeaDetail>("GET", `/ideas/${popular.id}`)).body.signals.ratings;

    for (const u of users) await h.call("PUT", `/ideas/${popular.id}/stances/important`, { token: u.token });

    const after = (await h.call<IdeaDetail>("GET", `/ideas/${popular.id}`)).body.signals;
    expect(after.attention).toBe(users.length);
    expect(after.ratings).toEqual(before);

    const titles = async (lens: string) =>
      (await h.call<Page<IdeaListItem>>("GET", `/ideas?lens=${lens}&limit=50`)).body.items.map(
        (i) => i.title,
      );
    expect((await titles("attention"))[0]).toBe("A wildly popular speculation");
    expect((await titles("evidence"))[0]).toBe("A quietly well evidenced proposal");
    expect(await titles("potential")).toContain("A wildly popular speculation");
    // High potential + low attention → neglected; the popular one is not.
    const neglected = await titles("neglected");
    expect(neglected).toContain("A quietly well evidenced proposal");
    expect(neglected).not.toContain("A wildly popular speculation");
    expect((await titles("emerging"))[0]).toBe("A wildly popular speculation");
    expect(await titles("needs_review")).toContain("A wildly popular speculation");
  });

  it("surfaces contested ideas", async () => {
    const idea = await h.idea(users[0]!.token, { title: "A deeply divisive idea" });
    for (const [i, value] of [1, 5, 1, 5].entries())
      await rate(users[i + 1]!.token, idea.id, [{ dimension: "feasibility", value }]);
    const contested = await h.call<Page<IdeaListItem>>("GET", "/ideas?lens=contested");
    expect(contested.body.items[0]!.title).toBe("A deeply divisive idea");
    expect(contested.body.items[0]!.signals.contestation).toBe(0.5);
  });
});

describe("involvement: connecting ideas with people who can advance them", () => {
  it("records capacity and status changes as history", async () => {
    const idea = await h.idea(users[0]!.token);
    const t = users[4]!.token;
    await h.call("PUT", `/ideas/${idea.id}/involvements/funding`, {
      token: t,
      body: { status: "offering", note: "Seed grant possible" },
    });
    const active = await h.call<InvolvementDto[]>("PUT", `/ideas/${idea.id}/involvements/funding`, {
      token: t,
      body: { status: "active" },
    });
    expect(active.body).toEqual([expect.objectContaining({ capacity: "funding", status: "active" })]);
    const listed = await h.call<InvolvementDto[]>("GET", `/ideas/${idea.id}/involvements`);
    expect(listed.body).toEqual([
      expect.objectContaining({
        capacity: "funding",
        status: "active",
        person: expect.objectContaining({ handle: "eve" }),
      }),
    ]);
    expect(
      (
        await h.call("PUT", `/ideas/${idea.id}/involvements/astrology`, {
          token: t,
          body: { status: "active" },
        })
      ).status,
    ).toBe(404);
    const profile = await h.call("GET", "/people/eve");
    expect(profile.body.involvements).toEqual([
      expect.objectContaining({ capacity: "funding", status: "active" }),
    ]);
    expect((await h.call("DELETE", `/ideas/${idea.id}/involvements/funding`, { token: t })).body).toEqual([]);
    const [row] = await queryRows<{ n: number }>(
      h.db,
      sql`select count(*)::int as n from involvements where idea_id = ${idea.id}`,
    );
    expect(row?.n).toBe(2); // offering (superseded) + active (withdrawn): both preserved
  });
});

describe("derived metrics are disposable", () => {
  it("a full rebuild from raw facts reproduces the incrementally maintained values", async () => {
    const snapshot = async () =>
      (await h.db.select().from(ideaMetrics).orderBy(asc(ideaMetrics.ideaId), asc(ideaMetrics.metric))).map(
        ({ computedAt: _c, ...rest }) => rest,
      );
    const before = await snapshot();
    await h.db.delete(ideaMetrics);
    await rebuildAllIdeaMetrics({ db: h.db, actor: null, weights: uniformWeights });
    expect(await snapshot()).toEqual(before);
  });

  it("a different weight policy changes derived values without touching facts", async () => {
    const idea = await h.idea(users[0]!.token, { title: "Weighting probe" });
    await rate(users[1]!.token, idea.id, [{ dimension: "impact", value: 5 }]);
    await rate(users[2]!.token, idea.id, [{ dimension: "impact", value: 1 }]);
    const heavy = users[1]!.id;
    await rebuildAllIdeaMetrics({
      db: h.db,
      actor: null,
      weights: ({ evaluatorId }) => (evaluatorId === heavy ? 3 : 1),
    });
    const weighted = (await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`)).body.signals.ratings.impact!;
    expect(weighted.mean).toBe(4);
    expect(weighted.n).toBe(2);
    const raw = await h.call<Page<EvaluationDto>>("GET", `/evaluations?targetKind=idea&targetId=${idea.id}`);
    expect(raw.body.items.map((e) => e.value).sort()).toEqual([1, 5]);
    await rebuildAllIdeaMetrics({ db: h.db, actor: null, weights: uniformWeights });
  });
});
