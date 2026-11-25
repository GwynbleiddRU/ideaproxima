import { describe, expect, it } from "vitest";
import type { DomainError } from "../src";
import {
  ACTIONS,
  assertInitiativeTransition,
  assertStageTransition,
  can,
  describeRelationFrom,
  isValidHandle,
  normalizeDoi,
  normalizeIdeaContent,
  normalizeRelation,
  parseClaimAnchors,
  sameIdeaContent,
  slugify,
  stageRequirements,
  stancesDisplacedBy,
  validateRatings,
  type Actor,
  type StageEvidenceFacts,
} from "../src";

const noFacts: StageEvidenceFacts = {
  independentReviewers: 0,
  testsWithOutcomes: 0,
  implementations: 0,
  outcomesWithLessons: 0,
};
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return "ok";
};

describe("lifecycle transitions", () => {
  const rationale = "Explained clearly enough.";

  it("allows judgement-based early stages with a rationale", () => {
    expect(
      code(() => assertStageTransition({ from: "imagined", to: "developed", rationale, facts: noFacts })),
    ).toBe("ok");
  });

  it("requires history to explain itself", () => {
    expect(
      code(() =>
        assertStageTransition({ from: "imagined", to: "developed", rationale: "short", facts: noFacts }),
      ),
    ).toBe("invariant_violated");
  });

  it("rejects no-op transitions", () => {
    expect(
      code(() => assertStageTransition({ from: "developed", to: "developed", rationale, facts: noFacts })),
    ).toBe("invariant_violated");
  });

  it("requires proof for later stages", () => {
    for (const to of ["examined", "tested", "implemented", "learned_from"] as const) {
      expect(code(() => assertStageTransition({ from: "imagined", to, rationale, facts: noFacts }))).toBe(
        "invariant_violated",
      );
    }
    const facts: StageEvidenceFacts = {
      independentReviewers: 1,
      testsWithOutcomes: 1,
      implementations: 1,
      outcomesWithLessons: 1,
    };
    for (const to of ["examined", "tested", "implemented", "learned_from"] as const) {
      expect(code(() => assertStageTransition({ from: "imagined", to, rationale, facts }))).toBe("ok");
    }
  });

  it("allows going backwards (history is a record, not a progress bar)", () => {
    expect(
      code(() =>
        assertStageTransition({
          from: "implemented",
          to: "examined",
          rationale,
          facts: { ...noFacts, independentReviewers: 2 },
        }),
      ),
    ).toBe("ok");
  });

  it("reports what each stage requires", () => {
    const reqs = stageRequirements({ ...noFacts, independentReviewers: 1 });
    expect(reqs.find((r) => r.stage === "examined")?.met).toBe(true);
    expect(reqs.find((r) => r.stage === "tested")?.met).toBe(false);
  });

  it("moves initiatives forward only", () => {
    expect(code(() => assertInitiativeTransition("planned", "active"))).toBe("ok");
    expect(code(() => assertInitiativeTransition("active", "completed"))).toBe("ok");
    expect(code(() => assertInitiativeTransition("completed", "active"))).toBe("invariant_violated");
    expect(code(() => assertInitiativeTransition("planned", "completed"))).toBe("invariant_violated");
  });
});

describe("relations", () => {
  it("forbids self-relations", () => {
    expect(code(() => normalizeRelation({ fromIdeaId: "a", toIdeaId: "a", type: "requires" }))).toBe(
      "invariant_violated",
    );
  });

  it("keeps direction for directed types and canonicalises symmetric ones", () => {
    expect(normalizeRelation({ fromIdeaId: "b", toIdeaId: "a", type: "requires" })).toEqual({
      fromIdeaId: "b",
      toIdeaId: "a",
      type: "requires",
    });
    expect(normalizeRelation({ fromIdeaId: "b", toIdeaId: "a", type: "alternative_to" })).toEqual({
      fromIdeaId: "a",
      toIdeaId: "b",
      type: "alternative_to",
    });
  });

  it("phrases a relation from either endpoint", () => {
    const rel = { fromIdeaId: "nanobots", toIdeaId: "fabrication", type: "requires" as const };
    expect(describeRelationFrom(rel, "nanobots")).toMatchObject({
      otherIdeaId: "fabrication",
      phrase: "requires",
      direction: "outgoing",
    });
    expect(describeRelationFrom(rel, "fabrication")).toMatchObject({
      otherIdeaId: "nanobots",
      phrase: "is required by",
      direction: "incoming",
    });
  });
});

describe("ratings", () => {
  it("accepts applicable dimensions within scale", () => {
    expect(validateRatings("idea", [{ dimension: "impact", value: 5, confidence: "high" }])).toEqual([
      { dimension: "impact", value: 5, confidence: "high" },
    ]);
  });

  it("rejects unknown, inapplicable, out-of-scale, fractional and duplicate ratings", () => {
    expect(code(() => validateRatings("idea", [{ dimension: "beauty", value: 3 }]))).toBe(
      "validation_failed",
    );
    expect(code(() => validateRatings("idea", [{ dimension: "support", value: 3 }]))).toBe(
      "validation_failed",
    );
    expect(code(() => validateRatings("idea", [{ dimension: "impact", value: 6 }]))).toBe(
      "validation_failed",
    );
    expect(code(() => validateRatings("idea", [{ dimension: "impact", value: 2.5 }]))).toBe(
      "validation_failed",
    );
    expect(
      code(() =>
        validateRatings("idea", [
          { dimension: "impact", value: 2 },
          { dimension: "impact", value: 3 },
        ]),
      ),
    ).toBe("validation_failed");
    expect(code(() => validateRatings("idea", []))).toBe("validation_failed");
  });

  it("binary dimensions only accept 1", () => {
    expect(code(() => validateRatings("comment", [{ dimension: "useful", value: 1 }]))).toBe("ok");
    expect(code(() => validateRatings("comment", [{ dimension: "useful", value: 0 }]))).toBe(
      "validation_failed",
    );
  });

  it("plausible and doubtful are mutually exclusive stances", () => {
    expect(stancesDisplacedBy("plausible")).toEqual(["doubtful"]);
    expect(stancesDisplacedBy("doubtful")).toEqual(["plausible"]);
    expect(stancesDisplacedBy("important")).toEqual([]);
  });
});

describe("permissions", () => {
  const member: Actor = { id: "m", role: "member", active: true, trust: "new" };
  const moderator: Actor = { id: "mod", role: "moderator", active: true, trust: "staff" };
  const admin: Actor = { id: "adm", role: "admin", active: true, trust: "staff" };
  const deactivated: Actor = { id: "x", role: "admin", active: false, trust: "staff" };

  it("denies everything to anonymous and deactivated actors", () => {
    for (const action of ACTIONS) {
      expect(can(null, action)).toBe(false);
      expect(can(deactivated, action, { isSteward: true, isCreator: true })).toBe(false);
    }
  });

  it("lets every member contribute and signal", () => {
    expect(can(member, "idea.propose")).toBe(true);
    expect(can(member, "knowledge.contribute")).toBe(true);
    expect(can(member, "signal.express")).toBe(true);
    expect(can(member, "idea.revision.propose")).toBe(true);
  });

  it("gates narrative and lifecycle decisions on stewardship", () => {
    for (const action of [
      "idea.revise",
      "idea.revision.decide",
      "idea.stage.transition",
      "idea.steward.appoint",
    ] as const) {
      expect(can(member, action)).toBe(false);
      expect(can(member, action, { isSteward: true })).toBe(true);
      expect(can(moderator, action)).toBe(true);
    }
  });

  it("lets moderators act on members only, and only admins change roles", () => {
    expect(can(member, "person.moderate", { targetRole: "member" })).toBe(false);
    expect(can(moderator, "person.moderate", { targetRole: "member" })).toBe(true);
    expect(can(moderator, "person.moderate", { targetRole: "moderator" })).toBe(false);
    expect(can(moderator, "person.moderate", { targetRole: "admin" })).toBe(false);
    expect(can(admin, "person.moderate", { targetRole: "admin" })).toBe(true);
    expect(can(moderator, "role.assign")).toBe(false);
    expect(can(admin, "role.assign")).toBe(true);
  });

  it("restricts withdrawal to creators and moderation to moderators", () => {
    expect(can(member, "contribution.withdraw")).toBe(false);
    expect(can(member, "contribution.withdraw", { isCreator: true })).toBe(true);
    expect(can(member, "content.moderate")).toBe(false);
    expect(can(moderator, "content.moderate")).toBe(true);
    expect(can(moderator, "topic.manage")).toBe(false);
    expect(can(admin, "topic.manage")).toBe(true);
  });
});

describe("content", () => {
  const base = {
    title: "  Orbital sunshades  ",
    summary: "A swarm of reflective sails at L1 dimming sunlight.",
    sections: {},
    topics: ["Space"],
    tags: ["Climate", "climate ", ""],
  };

  it("normalises content idempotently", () => {
    const once = normalizeIdeaContent(base);
    expect(once).toEqual({
      title: "Orbital sunshades",
      summary: base.summary,
      sections: {},
      topics: ["space"],
      tags: ["climate"],
    });
    expect(normalizeIdeaContent(once)).toEqual(once);
  });

  it("drops empty sections and detects no-op revisions", () => {
    const a = normalizeIdeaContent({ ...base, sections: { overview: "  ", mechanism: "Sails." } });
    expect(a.sections).toEqual({ mechanism: "Sails." });
    const b = normalizeIdeaContent({ ...base, tags: ["climate"], sections: { mechanism: "Sails." } });
    expect(sameIdeaContent(a, b)).toBe(true);
    expect(sameIdeaContent(a, { ...b, summary: b.summary + "!" })).toBe(false);
  });

  it("enforces content limits", () => {
    expect(code(() => normalizeIdeaContent({ ...base, title: "abc" }))).toBe("validation_failed");
    expect(code(() => normalizeIdeaContent({ ...base, topics: [] }))).toBe("validation_failed");
  });

  it("slugifies, validates handles and normalises DOIs", () => {
    expect(slugify("Water-cleaning nanorobots!")).toBe("water-cleaning-nanorobots");
    expect(slugify("Lúcia's économie")).toBe("lucia-s-economie");
    expect(slugify("???")).toBe("idea");
    expect(isValidHandle("mira-okafor")).toBe(true);
    expect(isValidHandle("Mira")).toBe(false);
    expect(isValidHandle("a--b")).toBe(false);
    expect(normalizeDoi("https://doi.org/10.1000/XYZ.123")).toBe("10.1000/xyz.123");
    expect(normalizeDoi("doi: 10.1234/abc")).toBe("10.1234/abc");
    expect(normalizeDoi("not a doi")).toBeNull();
  });

  it("parses claim anchors from markdown", () => {
    const id = "0190f5c2-1234-7abc-8def-0123456789ab";
    const anchors = parseClaimAnchors(
      `Swarms could [recognise molecules](claim:${id}) and [link](https://x.org).`,
    );
    expect(anchors).toEqual([{ text: "recognise molecules", claimId: id, index: 13 }]);
  });
});
