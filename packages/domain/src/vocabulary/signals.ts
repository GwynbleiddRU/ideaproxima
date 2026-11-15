import type { Term } from "./term";

/**
 * EVALUATION TARGETS — things a person can assess. Each evaluation row references exactly one of them.
 */
export const EVALUATION_TARGET_KINDS = [
  "idea",
  "claim",
  "evidence",
  "argument",
  "relation",
  "comment",
] as const;
export type EvaluationTargetKind = (typeof EVALUATION_TARGET_KINDS)[number];

export type RatingScale =
  { kind: "ordinal"; min: number; max: number; anchors: Record<number, string> } | { kind: "binary" };

export interface DimensionDefinition extends Term {
  /** The question the evaluator answers. */
  question: string;
  appliesTo: readonly EvaluationTargetKind[];
  scale: RatingScale;
}

const fivePoint = (anchors: Record<number, string>): RatingScale => ({
  kind: "ordinal",
  min: 1,
  max: 5,
  anchors,
});

/**
 * EVALUATION DIMENSIONS — independent axes of assessment.
 *
 * They are NEVER collapsed into one score at the data level. Popularity is deliberately absent:
 * attention is measured by stances (see STANCE_KINDS), which are a different table and a different signal.
 *
 * Dimension keys are stored as text without a database CHECK so the future scoring work can add or
 * retire dimensions without a destructive migration. Validation happens in `validateRatings`.
 * Retiring a dimension: remove it from new submissions, but keep its definition readable so historical
 * rows remain interpretable (mark it `retired` when that becomes necessary).
 */
export const DIMENSIONS = {
  impact: {
    label: "Potential impact",
    description: "How much it would change what humanity can do, if realised — regardless of feasibility.",
    question: "If this were realised, how much would it change what humanity is capable of?",
    appliesTo: ["idea"],
    scale: fivePoint({
      1: "Marginal",
      2: "Local",
      3: "Significant",
      4: "Transformative",
      5: "Civilization-scale",
    }),
  },
  feasibility: {
    label: "Feasibility",
    description: "How achievable it is with foreseeable means.",
    question: "How achievable is this with foreseeable technology, resources and institutions?",
    appliesTo: ["idea"],
    scale: fivePoint({
      1: "Not foreseeable",
      2: "Distant",
      3: "Plausible within decades",
      4: "Near-term",
      5: "Possible today",
    }),
  },
  plausibility: {
    label: "Scientific / logical support",
    description: "How sound the underlying scientific or logical case is.",
    question: "How sound is the scientific or logical reasoning behind it?",
    appliesTo: ["idea", "claim"],
    scale: fivePoint({ 1: "Unsound", 2: "Weak", 3: "Reasonable", 4: "Strong", 5: "Compelling" }),
  },
  evidence: {
    label: "Evidence",
    description:
      "Perceived strength of the available evidence. Complemented by the structured evidence graph.",
    question: "How strong is the real-world evidence currently available?",
    appliesTo: ["idea"],
    scale: fivePoint({ 1: "None", 2: "Anecdotal", 3: "Preliminary", 4: "Substantial", 5: "Conclusive" }),
  },
  novelty: {
    label: "Novelty",
    description: "How new it is relative to existing ideas and practice.",
    question: "How new is this compared to existing ideas?",
    appliesTo: ["idea"],
    scale: fivePoint({
      1: "Well known",
      2: "Variation",
      3: "Fresh angle",
      4: "Original",
      5: "Unprecedented",
    }),
  },
  development: {
    label: "Development",
    description: "How complete and rigorous the idea's development is.",
    question: "How thoroughly and rigorously is this idea worked out?",
    appliesTo: ["idea"],
    scale: fivePoint({ 1: "Sketch", 2: "Outline", 3: "Worked out", 4: "Rigorous", 5: "Comprehensive" }),
  },
  support: {
    label: "Evidential support",
    description: "Where the claim stands in light of the evidence.",
    question: "Given the evidence you know of, where does this claim stand?",
    appliesTo: ["claim"],
    scale: fivePoint({
      1: "Refuted",
      2: "Doubtful",
      3: "Unknown / untested",
      4: "Supported",
      5: "Established",
    }),
  },
  quality: {
    label: "Evidence quality",
    description: "Methodological soundness and reliability of a piece of evidence.",
    question: "How reliable is this evidence, methodologically?",
    appliesTo: ["evidence"],
    scale: fivePoint({ 1: "Unreliable", 2: "Weak", 3: "Moderate", 4: "Strong", 5: "Rigorous" }),
  },
  relevance: {
    label: "Relevance",
    description: "How directly the evidence bears on the claim it is attached to.",
    question: "How directly does this evidence bear on the claim?",
    appliesTo: ["evidence"],
    scale: fivePoint({ 1: "Tangential", 2: "Indirect", 3: "Relevant", 4: "Direct", 5: "Decisive" }),
  },
  strength: {
    label: "Argument strength",
    description: "How strong the reasoning is, whether or not you agree with its conclusion.",
    question: "How strong is this argument, regardless of whether you agree?",
    appliesTo: ["argument"],
    scale: fivePoint({ 1: "Fallacious", 2: "Weak", 3: "Reasonable", 4: "Strong", 5: "Decisive" }),
  },
  validity: {
    label: "Relationship validity",
    description: "Whether a stated relationship between two ideas is accurate.",
    question: "Is this relationship between the two ideas accurate?",
    appliesTo: ["relation"],
    scale: fivePoint({ 1: "Wrong", 2: "Doubtful", 3: "Partly", 4: "Accurate", 5: "Obviously accurate" }),
  },
  useful: {
    label: "Useful",
    description: "This contribution moved the discussion forward.",
    question: "Was this useful?",
    appliesTo: ["comment", "argument"],
    scale: { kind: "binary" },
  },
} as const satisfies Record<string, DimensionDefinition>;

export type DimensionKey = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as DimensionKey[];

export const dimensionsFor = (target: EvaluationTargetKind): DimensionKey[] =>
  DIMENSION_KEYS.filter((k) => (DIMENSIONS[k].appliesTo as readonly EvaluationTargetKind[]).includes(target));

export const isDimensionKey = (k: string): k is DimensionKey => Object.hasOwn(DIMENSIONS, k);

/** Self-reported confidence accompanying a rating. Raw input for calibration and uncertainty display. */
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/**
 * STANCES — lightweight community perspectives on an idea ("community voting" in concept.txt).
 *
 * Kept in a separate table from evaluations: stances say what people *care about and believe at a glance*;
 * evaluations are deliberate assessments with a rationale. `important` is the attention signal (the "vote").
 * None of these is ever folded into quality metrics.
 */
export const STANCE_KINDS = ["important", "worth_researching", "plausible", "doubtful", "ready_now"] as const;
export type StanceKind = (typeof STANCE_KINDS)[number];

export const STANCE_KIND_INFO: Record<StanceKind, Term> = {
  important: { label: "Important", description: "I think this matters. (The attention signal.)" },
  worth_researching: { label: "Worth researching", description: "This deserves serious research effort." },
  plausible: { label: "Plausible", description: "I think this could work." },
  doubtful: { label: "Doubtful", description: "I doubt this could work." },
  ready_now: { label: "Ready today", description: "This could be pursued with today's means." },
};

/** Pairs of stances one person cannot hold simultaneously; taking one retracts the other. */
export const MUTUALLY_EXCLUSIVE_STANCES: ReadonlyArray<readonly [StanceKind, StanceKind]> = [
  ["plausible", "doubtful"],
];

/**
 * CAPACITIES — ways a person can advance ideas. Used both on profiles ("I can contribute via…") and on
 * involvements ("I am researching / funding this idea"). This is the matching surface between ideas and the
 * scientists, engineers, funders and organisations who could act on them.
 */
export const CAPACITIES = [
  "research",
  "engineering",
  "funding",
  "entrepreneurship",
  "policy",
  "organizing",
  "communication",
] as const;
export type Capacity = (typeof CAPACITIES)[number];

export const CAPACITY_INFO: Record<Capacity, Term> = {
  research: { label: "Research", description: "Scientific or scholarly investigation." },
  engineering: { label: "Engineering", description: "Designing and building." },
  funding: { label: "Funding", description: "Providing capital, grants or resources." },
  entrepreneurship: { label: "Entrepreneurship", description: "Turning it into a venture or product." },
  policy: { label: "Policy", description: "Law, regulation, governance." },
  organizing: { label: "Organizing", description: "Communities, coordination, pilots." },
  communication: { label: "Communication", description: "Writing, teaching, public understanding." },
};

export const INVOLVEMENT_STATUSES = ["offering", "active", "concluded"] as const;
export type InvolvementStatus = (typeof INVOLVEMENT_STATUSES)[number];

export const INVOLVEMENT_STATUS_INFO: Record<InvolvementStatus, Term> = {
  offering: { label: "Offering to help", description: "Willing and able to contribute in this capacity." },
  active: { label: "Actively involved", description: "Currently working on it in this capacity." },
  concluded: { label: "Previously involved", description: "Was involved; preserved for attribution." },
};
