import { describe, expect, it } from "vitest";
import {
  DIMENSIONS,
  DIMENSION_KEYS,
  LENS_KEYS,
  LENS_INFO,
  RELATION_TYPE_INFO,
  RELATION_TYPES,
  contestation,
  deriveClaimStatus,
  dimensionsFor,
  perspectiveShares,
  sectionCompleteness,
  summarizeRatings,
  type RatingSummary,
} from "../src";

const scale = { min: 1, max: 5 };
const obs = (...values: number[]) => values.map((value) => ({ value, weight: 1 }));

describe("summarizeRatings", () => {
  it("returns null for no data — absence is not a low score", () => {
    expect(summarizeRatings([], scale)).toBeNull();
    expect(summarizeRatings([{ value: 3, weight: 0 }], scale)).toBeNull();
  });

  it("computes mean, spread and normalised values", () => {
    const s = summarizeRatings(obs(1, 5), scale)!;
    expect(s).toMatchObject({ n: 2, mean: 3, sd: 2, normalizedMean: 0.5, normalizedSd: 0.5 });
    expect(summarizeRatings(obs(4, 4, 4), scale)).toMatchObject({ mean: 4, sd: 0, normalizedMean: 0.75 });
  });

  it("applies weights without changing n", () => {
    const s = summarizeRatings(
      [
        { value: 5, weight: 3 },
        { value: 1, weight: 1 },
      ],
      scale,
    )!;
    expect(s.n).toBe(2);
    expect(s.weightSum).toBe(4);
    expect(s.mean).toBe(4);
  });
});

describe("contestation", () => {
  const summary = (values: number[]) => summarizeRatings(obs(...values), scale);

  it("ignores dimensions with too few ratings", () => {
    expect(contestation([summary([1, 5])])).toBe(0);
  });

  it("is the widest normalised spread among confident dimensions", () => {
    expect(contestation([summary([1, 5, 1, 5]), summary([3, 3, 3]), null])).toBe(0.5);
  });
});

describe("deriveClaimStatus", () => {
  const s = (values: number[]): RatingSummary => summarizeRatings(obs(...values), scale)!;

  it("is unassessed without assessments", () => {
    expect(deriveClaimStatus(null, null)).toBe("unassessed");
  });

  it("maps the support scale to statuses", () => {
    expect(deriveClaimStatus(s([5, 5, 4]), null)).toBe("established");
    expect(deriveClaimStatus(s([4]), null)).toBe("supported");
    expect(deriveClaimStatus(s([3]), null)).toBe("unknown");
    expect(deriveClaimStatus(s([3]), s([4, 4]))).toBe("hypothesis");
    expect(deriveClaimStatus(s([2]), null)).toBe("doubtful");
    expect(deriveClaimStatus(s([1]), null)).toBe("refuted");
  });

  it("derives 'contested' only from real disagreement among enough assessors", () => {
    expect(deriveClaimStatus(s([1, 5]), null)).not.toBe("contested");
    expect(deriveClaimStatus(s([1, 5, 1, 5]), null)).toBe("contested");
  });
});

describe("other baseline metrics", () => {
  it("measures section completeness", () => {
    expect(sectionCompleteness({})).toBe(0);
    const long = "x".repeat(80);
    expect(sectionCompleteness({ overview: long, mechanism: long, motivation: "too short" })).toBe(0.25);
  });

  it("computes perspective shares among stance holders", () => {
    const shares = perspectiveShares({ important: 3, plausible: 1 }, 4);
    expect(shares.important).toEqual({ count: 3, share: 0.75 });
    expect(shares.doubtful).toEqual({ count: 0, share: 0 });
    expect(perspectiveShares({}, 0).important.share).toBe(0);
  });
});

describe("vocabulary integrity", () => {
  it("every dimension applies to at least one target and has a valid scale", () => {
    for (const key of DIMENSION_KEYS) {
      const d = DIMENSIONS[key];
      expect(d.appliesTo.length).toBeGreaterThan(0);
      if (d.scale.kind === "ordinal") {
        expect(d.scale.max).toBeGreaterThan(d.scale.min);
        for (let v = d.scale.min; v <= d.scale.max; v++) expect(d.scale.anchors[v]).toBeTruthy();
      }
    }
  });

  it("popularity is not an evaluation dimension", () => {
    expect(DIMENSION_KEYS).not.toContain("attention");
    expect(DIMENSION_KEYS).not.toContain("popularity");
    expect(dimensionsFor("idea")).toEqual([
      "impact",
      "feasibility",
      "plausibility",
      "evidence",
      "novelty",
      "development",
    ]);
  });

  it("every lens declares what it measures", () => {
    for (const key of LENS_KEYS) expect(LENS_INFO[key].description.length).toBeGreaterThan(10);
  });

  it("symmetric relation types read the same in both directions", () => {
    for (const t of RELATION_TYPES) {
      const info = RELATION_TYPE_INFO[t];
      if (info.symmetric) {
        expect(info.forward).toBe(info.inverse);
        expect(info.buildsOn).toBe(false);
      }
    }
  });
});
