import type { Term } from "./term";

/**
 * LENSES — different ways of discovering ideas, instead of one "objective" ranking (concept.txt).
 *
 * Every lens states honestly *what it measures*. The `signal` groups lenses by the kind of information they
 * rank on, so the UI can make it obvious that "most supported" (attention) and "best evidenced" (quality)
 * measure different things.
 *
 * Lens implementations live in the API (they are queries over derived metrics). Their formulas are
 * provisional — see prompts/scoring-system-prompt-sketch.md — but their *meaning* defined here is stable.
 */
export const LENS_KEYS = [
  "newest",
  "attention",
  "emerging",
  "evidence",
  "potential",
  "feasible",
  "developed",
  "neglected",
  "contested",
  "needs_review",
  "in_practice",
] as const;
export type LensKey = (typeof LENS_KEYS)[number];

export type LensSignal = "time" | "attention" | "quality" | "uncertainty" | "practice";

export const LENS_INFO: Record<LensKey, Term & { signal: LensSignal }> = {
  newest: { label: "Newest", description: "Most recently proposed.", signal: "time" },
  attention: {
    label: "Most supported",
    description: "How many people marked the idea as important. Popularity — not quality, not truth.",
    signal: "attention",
  },
  emerging: {
    label: "Emerging",
    description: "Fastest-growing attention over the last 30 days.",
    signal: "attention",
  },
  evidence: {
    label: "Best evidenced",
    description: "Strongest assessed evidence, regardless of popularity.",
    signal: "quality",
  },
  potential: {
    label: "Highest potential",
    description:
      "Highest assessed potential impact, regardless of current feasibility. Moonshots belong here.",
    signal: "quality",
  },
  feasible: {
    label: "Most feasible",
    description: "Most achievable with foreseeable means.",
    signal: "quality",
  },
  developed: {
    label: "Most developed",
    description: "Most completely worked out: narrative, claims and structure.",
    signal: "quality",
  },
  neglected: {
    label: "Neglected",
    description: "High assessed potential, at-or-below-median attention. Ideas that deserve more eyes.",
    signal: "attention",
  },
  contested: {
    label: "Contested",
    description: "Where assessors disagree most. Uncertainty kept visible.",
    signal: "uncertainty",
  },
  needs_review: {
    label: "Needs review",
    description: "Few independent evaluations yet. Help examine them.",
    signal: "uncertainty",
  },
  in_practice: {
    label: "In practice",
    description: "Recently tested, implemented or learned from in the real world.",
    signal: "practice",
  },
};

/** Minimum independent ratings before a dimension mean is treated as more than "too early to tell". */
export const MIN_RATINGS_FOR_CONFIDENCE = 3;
