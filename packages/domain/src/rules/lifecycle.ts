import { DomainError } from "../errors";
import { ERROR_MESSAGES, type ErrorReason } from "../errors.en";
import type { IdeaStage, InitiativeStatus } from "../vocabulary/lifecycle";

/**
 * Facts about an idea that later lifecycle stages must be backed by. Gathered by the API from the database;
 * the rule itself stays pure so it can be unit-tested and reused (e.g. to show "what is missing" in the UI).
 */
export interface StageEvidenceFacts {
  /** Distinct people other than the idea's stewards who evaluated it or argued about it. */
  independentReviewers: number;
  /** Testing initiatives (experiment / prototype / pilot) that have at least one recorded outcome. */
  testsWithOutcomes: number;
  /** Implementing initiatives (deployment / policy) that are active or completed. */
  implementations: number;
  /** Outcomes (of any initiative of this idea) that record explicit lessons. */
  outcomesWithLessons: number;
}

export const MIN_TRANSITION_RATIONALE = 10;

const STAGE_PROOF_REASONS = {
  examined: "stage_proof_examined",
  tested: "stage_proof_tested",
  implemented: "stage_proof_implemented",
  learned_from: "stage_proof_learned_from",
} as const satisfies Partial<Record<IdeaStage, ErrorReason>>;

export function stageProofReason(stage: string): ErrorReason | undefined {
  return Object.hasOwn(STAGE_PROOF_REASONS, stage)
    ? STAGE_PROOF_REASONS[stage as keyof typeof STAGE_PROOF_REASONS]
    : undefined;
}

export type StageRequirement = { stage: IdeaStage; met: boolean; requirement: string };

/** What each stage demands. Earlier stages are a matter of judgement (with a rationale); later ones need proof. */
export function stageRequirements(facts: StageEvidenceFacts): StageRequirement[] {
  return [
    { stage: "imagined", met: true, requirement: "None." },
    { stage: "developed", met: true, requirement: "A steward's judgement, explained in the rationale." },
    {
      stage: "examined",
      met: facts.independentReviewers >= 1,
      requirement: ERROR_MESSAGES[STAGE_PROOF_REASONS.examined],
    },
    {
      stage: "tested",
      met: facts.testsWithOutcomes >= 1,
      requirement: ERROR_MESSAGES[STAGE_PROOF_REASONS.tested],
    },
    {
      stage: "implemented",
      met: facts.implementations >= 1,
      requirement: ERROR_MESSAGES[STAGE_PROOF_REASONS.implemented],
    },
    {
      stage: "learned_from",
      met: facts.outcomesWithLessons >= 1,
      requirement: ERROR_MESSAGES[STAGE_PROOF_REASONS.learned_from],
    },
  ];
}

/**
 * Validates a lifecycle transition.
 *
 * Transitions may go backwards (an implementation can be withdrawn and the idea re-examined) — history is a
 * record of what happened, not a progress bar. What is never allowed: a no-op transition, a transition
 * without an explanation, or claiming a stage that the recorded facts do not support.
 */
export function assertStageTransition(input: {
  from: IdeaStage;
  to: IdeaStage;
  rationale: string;
  facts: StageEvidenceFacts;
}): void {
  const { from, to, rationale, facts } = input;
  if (from === to) {
    throw new DomainError("invariant_violated", "stage_unchanged", { stage: to });
  }
  if (rationale.trim().length < MIN_TRANSITION_RATIONALE) {
    throw new DomainError("invariant_violated", "stage_rationale_too_short", {
      minimum: MIN_TRANSITION_RATIONALE,
    });
  }
  const req = stageRequirements(facts).find((r) => r.stage === to);
  if (req && !req.met) {
    throw new DomainError(
      "invariant_violated",
      "stage_requirement_unmet",
      { stage: to, requirement: req.requirement },
      { facts },
    );
  }
}

const INITIATIVE_TRANSITIONS: Record<InitiativeStatus, readonly InitiativeStatus[]> = {
  planned: ["active", "discontinued"],
  active: ["completed", "discontinued"],
  completed: [],
  discontinued: [],
};

/** Initiatives move forward only; completed and discontinued are terminal (start a new initiative instead). */
export function assertInitiativeTransition(from: InitiativeStatus, to: InitiativeStatus): void {
  if (!INITIATIVE_TRANSITIONS[from].includes(to)) {
    throw new DomainError("invariant_violated", "invalid_initiative_transition", { from, to });
  }
}
