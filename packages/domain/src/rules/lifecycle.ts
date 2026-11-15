import { DomainError } from "../errors";
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

export type StageRequirement = { stage: IdeaStage; met: boolean; requirement: string };

/** What each stage demands. Earlier stages are a matter of judgement (with a rationale); later ones need proof. */
export function stageRequirements(facts: StageEvidenceFacts): StageRequirement[] {
  return [
    { stage: "imagined", met: true, requirement: "None." },
    { stage: "developed", met: true, requirement: "A steward's judgement, explained in the rationale." },
    {
      stage: "examined",
      met: facts.independentReviewers >= 1,
      requirement: "At least one evaluation or argument from someone who is not a steward of the idea.",
    },
    {
      stage: "tested",
      met: facts.testsWithOutcomes >= 1,
      requirement: "At least one experiment, prototype or pilot with a recorded outcome.",
    },
    {
      stage: "implemented",
      met: facts.implementations >= 1,
      requirement: "At least one active or completed deployment or policy initiative.",
    },
    {
      stage: "learned_from",
      met: facts.outcomesWithLessons >= 1,
      requirement: "At least one recorded outcome with explicit lessons.",
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
    throw new DomainError("invariant_violated", `The idea is already at stage "${to}".`);
  }
  if (rationale.trim().length < MIN_TRANSITION_RATIONALE) {
    throw new DomainError(
      "invariant_violated",
      `A stage transition needs a rationale of at least ${MIN_TRANSITION_RATIONALE} characters — history must explain itself.`,
    );
  }
  const req = stageRequirements(facts).find((r) => r.stage === to);
  if (req && !req.met) {
    throw new DomainError("invariant_violated", `Cannot move to "${to}": ${req.requirement}`, {
      stage: to,
      requirement: req.requirement,
      facts,
    });
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
    throw new DomainError("invariant_violated", `An initiative cannot move from "${from}" to "${to}".`);
  }
}
