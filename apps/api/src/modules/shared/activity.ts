import { activities } from "../../db/schema";
import type { Ctx } from "./context";

/**
 * The catalogue of domain actions written to the activity ledger. Adding an action is cheap; renaming one is
 * not (it is history) — treat these strings as a public, append-only vocabulary.
 */
export const ACTIVITY_ACTIONS = [
  "person.registered",
  "person.profile_updated",
  "expertise.declared",
  "expertise.revoked",
  "topic.created",
  "topic.translation_updated",
  "idea.proposed",
  "revision.published",
  "revision.proposed",
  "revision.accepted",
  "revision.rejected",
  "revision.withdrawn",
  "steward.appointed",
  "stage.changed",
  "claim.stated",
  "claim.linked",
  "claim.unlinked",
  "source.registered",
  "evidence.attached",
  "evidence.withdrawn",
  "argument.made",
  "argument.withdrawn",
  "evaluation.submitted",
  "evaluation.withdrawn",
  "stance.taken",
  "stance.retracted",
  "involvement.declared",
  "involvement.withdrawn",
  "relation.proposed",
  "relation.retracted",
  "initiative.created",
  "initiative.status_changed",
  "outcome.recorded",
  "comment.posted",
  "moderation.hidden",
  "moderation.restored",
  "moderation.person_deactivated",
  "moderation.person_reactivated",
  /** Written only by the operator erasure procedure (docs/developer/operations.md), never by the API. */
  "moderation.erased",
  "person.role_changed",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** Actions that count as contributing knowledge to an idea (as opposed to signalling about it). */
export const KNOWLEDGE_ACTIONS: readonly ActivityAction[] = [
  "idea.proposed",
  "revision.published",
  "revision.proposed",
  "claim.stated",
  "claim.linked",
  "evidence.attached",
  "argument.made",
  "comment.posted",
  "relation.proposed",
  "initiative.created",
  "outcome.recorded",
];

export type SubjectKind =
  | "person"
  | "topic"
  | "expertise"
  | "idea"
  | "revision"
  | "steward"
  | "stage_transition"
  | "claim"
  | "idea_claim"
  | "source"
  | "evidence"
  | "argument"
  | "evaluation_submission"
  | "stance"
  | "involvement"
  | "relation"
  | "initiative"
  | "outcome"
  | "comment";

export interface ActivityEntry {
  action: ActivityAction;
  subject: { kind: SubjectKind; id: string };
  ideaIds?: readonly string[];
  payload?: Record<string, unknown>;
}

/** Appends to the ledger. Must be called inside the same transaction as the fact it records. */
export async function recordActivity(ctx: Ctx, entry: ActivityEntry): Promise<void> {
  await ctx.db.insert(activities).values({
    actorId: ctx.actor?.id ?? null,
    action: entry.action,
    ideaIds: [...new Set(entry.ideaIds ?? [])],
    subjectKind: entry.subject.kind,
    subjectId: entry.subject.id,
    payload: entry.payload ?? {},
  });
}
