import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type {
  EvidenceDto,
  IdeaClaimDto,
  IdeaDetail,
  InitiativeDto,
  StageTransitionDto,
} from "@ideaproxima/contracts";
import { createHarness, type Harness } from "./harness";

let h: Harness;
let steward: Awaited<ReturnType<Harness["user"]>>;
let reviewer: Awaited<ReturnType<Harness["user"]>>;
let moderator: Awaited<ReturnType<Harness["user"]>>;

beforeAll(async () => {
  h = await createHarness();
  steward = await h.user("steward");
  reviewer = await h.user("reviewer");
  moderator = await h.user("moderator", "moderator");
});
afterAll(() => h.close());

// Untyped on purpose: these calls are asserted on both success bodies and error bodies.
const transition = (token: string, ideaId: string, to: string, extra: Record<string, unknown> = {}) =>
  h.call("POST", `/ideas/${ideaId}/stages`, {
    token,
    body: { to, rationale: "Recorded with a clear rationale.", ...extra },
  });

describe("lifecycle: imagined → developed → examined → tested → implemented → learned from", () => {
  it("demands proof from the record for later stages, and records every transition", async () => {
    const idea = await h.idea(steward.token);

    expect((await transition(reviewer.token, idea.id, "developed")).status).toBe(403);
    expect(
      (
        await h.call("POST", `/ideas/${idea.id}/stages`, {
          token: steward.token,
          body: { to: "developed", rationale: "too short" },
        })
      ).status,
    ).toBe(422);
    expect((await transition(steward.token, idea.id, "developed")).status).toBe(201);

    // examined needs someone other than the stewards to have looked at it.
    await h.call("POST", "/evaluations", {
      token: steward.token,
      body: { target: { kind: "idea", id: idea.id }, ratings: [{ dimension: "impact", value: 5 }] },
    });
    const notYet = await transition(steward.token, idea.id, "examined");
    expect(notYet.status).toBe(422);
    expect(notYet.body.error.details.requirement).toMatch(/not a steward/);
    await h.call("POST", "/evaluations", {
      token: reviewer.token,
      body: { target: { kind: "idea", id: idea.id }, ratings: [{ dimension: "impact", value: 3 }] },
    });
    expect((await transition(steward.token, idea.id, "examined")).status).toBe(201);

    // tested needs a testing initiative with a recorded outcome.
    expect((await transition(steward.token, idea.id, "tested")).status).toBe(422);
    const pilot = await h.call<InitiativeDto>("POST", `/ideas/${idea.id}/initiatives`, {
      token: reviewer.token,
      body: {
        kind: "pilot",
        title: "Closed-loop reservoir pilot",
        description: "A contained pilot in a single, isolated reservoir.",
        organization: "Illustrative lab",
      },
    });
    expect(pilot.body.status).toBe("planned");
    expect(
      (
        await h.call("POST", `/initiatives/${pilot.body.id}/outcomes`, {
          token: reviewer.token,
          body: { result: "failed", summary: "Nothing to report yet, but trying anyway." },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await h.call("POST", `/initiatives/${pilot.body.id}/status`, {
          token: moderator.token === "" ? "" : "invalid",
          body: { status: "active" },
        })
      ).status,
    ).toBe(401);
    const active = await h.call<InitiativeDto>("POST", `/initiatives/${pilot.body.id}/status`, {
      token: reviewer.token,
      body: { status: "active", on: "2026-01-10" },
    });
    expect(active.body).toMatchObject({ status: "active", startedOn: "2026-01-10" });
    const withOutcome = await h.call<InitiativeDto>("POST", `/initiatives/${pilot.body.id}/outcomes`, {
      token: reviewer.token,
      body: { result: "failed", summary: "Devices clogged within days in real reservoir water." },
    });
    expect(withOutcome.body.outcomes).toHaveLength(1);
    const tested = await transition(steward.token, idea.id, "tested", { initiativeId: pilot.body.id });
    expect(tested.status).toBe(201);
    expect(tested.body).toMatchObject({ from: "examined", to: "tested", initiativeId: pilot.body.id });

    // learned_from needs explicit lessons; implemented needs a deployment/policy.
    expect((await transition(steward.token, idea.id, "learned_from")).status).toBe(422);
    await h.call("POST", `/initiatives/${pilot.body.id}/outcomes`, {
      token: steward.token,
      body: {
        result: "failed",
        summary: "Post-mortem of the reservoir pilot.",
        lessons: "Biofouling, not navigation, is the binding constraint.",
      },
    });
    expect((await transition(steward.token, idea.id, "learned_from")).status).toBe(201);
    expect((await transition(steward.token, idea.id, "implemented")).status).toBe(422);

    // Failed outcomes are evidence too: attach the outcome to a claim.
    const claim = await h.call<IdeaClaimDto>("POST", `/ideas/${idea.id}/claims`, {
      token: reviewer.token,
      body: { statement: "The devices can operate for weeks in untreated water.", role: "premise" },
    });
    const ev = await h.call<EvidenceDto>("POST", `/claims/${claim.body.id}/evidence`, {
      token: reviewer.token,
      body: {
        outcomeId: withOutcome.body.outcomes[0]!.id,
        stance: "challenges",
        summary: "The pilot devices failed within days.",
      },
    });
    expect(ev.body.outcome).toMatchObject({ result: "failed", initiativeId: pilot.body.id });

    const history = await h.call<StageTransitionDto[]>("GET", `/ideas/${idea.id}/stages`);
    expect(history.body.map((t) => t.to)).toEqual([
      "imagined",
      "developed",
      "examined",
      "tested",
      "learned_from",
    ]);
    const detail = await h.call<IdeaDetail>("GET", `/ideas/${idea.id}`);
    expect(detail.body.stage).toBe("learned_from");
    expect(detail.body.stageRequirements.filter((r) => r.met).map((r) => r.stage)).toEqual([
      "imagined",
      "developed",
      "examined",
      "tested",
      "learned_from",
    ]);
    await expect(h.db.execute(sql`delete from stage_transitions`)).rejects.toThrow();
  });

  it("records historical initiatives and enforces forward-only initiative status", async () => {
    const idea = await h.idea(steward.token);
    const done = await h.call<InitiativeDto>("POST", `/ideas/${idea.id}/initiatives`, {
      token: reviewer.token,
      body: {
        kind: "deployment",
        title: "City-wide deployment",
        description: "A deployment that already happened years ago.",
        status: "completed",
        startedOn: "2019-01-01",
        endedOn: "2021-06-30",
      },
    });
    expect(done.status).toBe(201);
    expect(
      (
        await h.call("POST", `/initiatives/${done.body.id}/status`, {
          token: reviewer.token,
          body: { status: "active" },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await h.call("POST", `/initiatives/${done.body.id}/status`, {
          token: moderator.token,
          body: { status: "discontinued" },
        })
      ).status,
    ).toBe(422);
    const bad = await h.call("POST", `/ideas/${idea.id}/initiatives`, {
      token: reviewer.token,
      body: {
        kind: "pilot",
        title: "Backwards dates",
        description: "This initiative ends before it starts.",
        startedOn: "2022-01-01",
        endedOn: "2021-01-01",
      },
    });
    expect(bad.status).toBe(400);
    // Moderators may record transitions too; implemented is now backed by the completed deployment.
    expect((await transition(moderator.token, idea.id, "implemented")).status).toBe(201);
  });
});

describe("reading initiatives", () => {
  it("lists an idea's initiatives with outcomes and reads one", async () => {
    const idea = await h.idea(steward.token);
    const created = await h.call<InitiativeDto>("POST", `/ideas/${idea.id}/initiatives`, {
      token: reviewer.token,
      body: {
        kind: "research",
        title: "Literature review",
        description: "A structured review of prior work on the idea.",
        status: "active",
      },
    });
    await h.call("POST", `/initiatives/${created.body.id}/outcomes`, {
      token: reviewer.token,
      body: {
        result: "inconclusive",
        summary: "Prior work is sparse and methodologically mixed.",
        lessons: "Fund a proper systematic review.",
      },
    });
    const list = await h.call<InitiativeDto[]>("GET", `/ideas/${idea.id}/initiatives`);
    expect(list.body.map((i) => [i.title, i.outcomes.length])).toEqual([["Literature review", 1]]);
    const one = await h.call<InitiativeDto>("GET", `/initiatives/${created.body.id}`);
    expect(one.body.outcomes[0]).toMatchObject({
      result: "inconclusive",
      lessons: "Fund a proper systematic review.",
    });
  });
});
