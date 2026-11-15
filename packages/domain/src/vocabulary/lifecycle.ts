import type { Term } from "./term";

/**
 * LIFECYCLE STAGE — what has been *done* with an idea.
 *
 * This follows concept.txt literally: "imagined → developed → examined → tested → implemented → learned from".
 * It is deliberately a different axis from epistemic maturity (how much is *known* about whether the idea
 * would work). The Lovable design merged the two into one "maturity" track; we keep them apart because an
 * idea can be thoroughly examined while still entirely speculative, and an idea can be learned from after a
 * failed test without ever being implemented. Epistemic state is derived from claims and evidence instead
 * (see `deriveClaimStatus` and the `evidence` metrics).
 *
 * The current stage is never edited directly: it is the latest recorded StageTransition, each of which
 * carries a rationale and (for later stages) proof in the form of initiatives and outcomes.
 */
export const IDEA_STAGES = [
  "imagined",
  "developed",
  "examined",
  "tested",
  "implemented",
  "learned_from",
] as const;
export type IdeaStage = (typeof IDEA_STAGES)[number];

export const IDEA_STAGE_INFO: Record<IdeaStage, Term> = {
  imagined: {
    label: "Imagined",
    description: "Proposed and preserved. May be entirely speculative — that is allowed.",
  },
  developed: {
    label: "Developed",
    description: "Worked out: mechanism, prerequisites, consequences and uncertainties are written down.",
  },
  examined: {
    label: "Examined",
    description: "Independently evaluated and challenged by people other than its stewards.",
  },
  tested: {
    label: "Tested",
    description: "At least one experiment, prototype or pilot has been carried out and its outcome recorded.",
  },
  implemented: {
    label: "Implemented",
    description: "Deployed or enacted in the real world, at some scale.",
  },
  learned_from: {
    label: "Learned from",
    description: "Outcomes — successes or failures — have been recorded with explicit lessons.",
  },
};

/** Ordinal position, used only for display ordering. Transitions are NOT restricted to "forward". */
export const stageOrdinal = (stage: IdeaStage): number => IDEA_STAGES.indexOf(stage);

/**
 * INITIATIVES — real-world action taken on an idea: research programmes, experiments, prototypes,
 * pilots, deployments, policy trials, funding rounds. This is how the platform preserves "who acted on it,
 * what was tried, what succeeded, what failed".
 */
export const INITIATIVE_KINDS = [
  "research",
  "experiment",
  "prototype",
  "pilot",
  "deployment",
  "policy",
  "funding",
  "other",
] as const;
export type InitiativeKind = (typeof INITIATIVE_KINDS)[number];

export const INITIATIVE_KIND_INFO: Record<InitiativeKind, Term> = {
  research: {
    label: "Research",
    description: "Theoretical or literature research, modelling, feasibility studies.",
  },
  experiment: { label: "Experiment", description: "A controlled test of one or more claims." },
  prototype: { label: "Prototype", description: "A working (partial) realisation built to learn." },
  pilot: { label: "Pilot", description: "A limited real-world trial with real participants or conditions." },
  deployment: { label: "Deployment", description: "Production use of the idea at some scale." },
  policy: {
    label: "Policy / institutional",
    description: "Enacted as law, regulation, or an institutional rule.",
  },
  funding: { label: "Funding", description: "Money or resources committed to advance the idea." },
  other: { label: "Other", description: "Any other concrete action." },
};

/** Initiative kinds that count as *testing* the idea (required to move an idea to `tested`). */
export const TESTING_INITIATIVE_KINDS: readonly InitiativeKind[] = ["experiment", "prototype", "pilot"];
/** Initiative kinds that count as *implementing* the idea (required to move an idea to `implemented`). */
export const IMPLEMENTING_INITIATIVE_KINDS: readonly InitiativeKind[] = ["deployment", "policy"];

export const INITIATIVE_STATUSES = ["planned", "active", "completed", "discontinued"] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];

export const INITIATIVE_STATUS_INFO: Record<InitiativeStatus, Term> = {
  planned: { label: "Planned", description: "Announced but not started." },
  active: { label: "Active", description: "Under way." },
  completed: { label: "Completed", description: "Finished as intended." },
  discontinued: {
    label: "Discontinued",
    description: "Stopped before completion. Still part of the record.",
  },
};

export const OUTCOME_RESULTS = ["succeeded", "partially_succeeded", "failed", "inconclusive"] as const;
export type OutcomeResult = (typeof OUTCOME_RESULTS)[number];

export const OUTCOME_RESULT_INFO: Record<OutcomeResult, Term> = {
  succeeded: { label: "Succeeded", description: "Achieved what it set out to show or do." },
  partially_succeeded: { label: "Partially succeeded", description: "Some goals met, others not." },
  failed: {
    label: "Failed",
    description: "Did not achieve its goal. Failed experiments remain knowledge and are preserved.",
  },
  inconclusive: { label: "Inconclusive", description: "Could not distinguish success from failure." },
};
