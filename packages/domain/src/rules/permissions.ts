import { DomainError } from "../errors";
import type { PersonRole } from "../vocabulary/people";
import type { TrustTier } from "./rate-limits";

/**
 * Authorization policy. One table, one function — every permission decision in the system goes through here
 * so the rules are reviewable in one place and covered by one test matrix.
 *
 * Principles:
 *  - Reading is public (the archive is a public good). Hidden content is visible to moderators only.
 *  - Any member may contribute knowledge and express signals; contribution is how reputation is earned.
 *  - Editing an idea's *narrative* is gated by stewardship, but anyone may *propose* a revision.
 *  - Nobody can edit or delete recorded facts (evaluations, evidence, transitions); they can only be
 *    superseded, withdrawn, or hidden by moderation — and all of that is itself recorded.
 */
export const ACTIONS = [
  "account.manage", // private settings and security history of the actor's own account
  "idea.propose",
  "idea.revise", // publish a revision directly
  "idea.revision.propose", // propose a revision for stewards to decide
  "idea.revision.decide", // accept / reject a proposed revision
  "idea.stage.transition",
  "idea.steward.appoint",
  "knowledge.contribute", // claims, evidence, arguments, relations, initiatives, outcomes, comments, sources
  "signal.express", // evaluations, stances, involvement
  "initiative.manage", // update status / record outcomes of an initiative
  "contribution.withdraw", // withdraw one's own evidence, argument or revision proposal
  "structure.curate", // unlink a claim from an idea, retract a relation
  "content.moderate", // hide / restore any content
  "expertise.verify",
  "topic.manage",
  "person.moderate", // deactivate / reactivate an account
  "role.assign", // change a person's platform role
] as const;
export type Action = (typeof ACTIONS)[number];

export interface Actor {
  id: string;
  role: PersonRole;
  trust: TrustTier;
  /** Deactivated accounts keep their history but cannot act. */
  active: boolean;
}

export interface PermissionContext {
  /** Actor is a current steward/originator of the idea in question. */
  isSteward?: boolean;
  /** Actor created the resource in question (e.g. the initiative). */
  isCreator?: boolean;
  /** Role of the person being acted upon (account moderation). */
  targetRole?: PersonRole;
}

const isModerator = (a: Actor) => a.role === "moderator" || a.role === "admin";

const POLICY: Record<Action, (a: Actor, ctx: PermissionContext) => boolean> = {
  "account.manage": () => true,
  "idea.propose": () => true,
  "idea.revise": (a, c) => !!c.isSteward || isModerator(a),
  "idea.revision.propose": () => true,
  "idea.revision.decide": (a, c) => !!c.isSteward || isModerator(a),
  "idea.stage.transition": (a, c) => !!c.isSteward || isModerator(a),
  "idea.steward.appoint": (a, c) => !!c.isSteward || isModerator(a),
  "knowledge.contribute": () => true,
  "signal.express": () => true,
  "initiative.manage": (a, c) => !!c.isCreator || !!c.isSteward || isModerator(a),
  "contribution.withdraw": (a, c) => !!c.isCreator || isModerator(a),
  "structure.curate": (a, c) => !!c.isCreator || !!c.isSteward || isModerator(a),
  "content.moderate": (a) => isModerator(a),
  "expertise.verify": (a) => isModerator(a),
  "topic.manage": (a) => a.role === "admin",
  // Moderators may act on members; only admins may act on moderators and admins.
  "person.moderate": (a, c) => a.role === "admin" || (a.role === "moderator" && c.targetRole === "member"),
  "role.assign": (a) => a.role === "admin",
};

export function can(actor: Actor | null, action: Action, ctx: PermissionContext = {}): boolean {
  if (!actor || !actor.active) return false;
  return POLICY[action](actor, ctx);
}

/** Throws `unauthenticated` for anonymous actors and `forbidden` when the policy denies. */
export function authorize(
  actor: Actor | null,
  action: Action,
  ctx: PermissionContext = {},
): asserts actor is Actor {
  if (!actor) throw new DomainError("unauthenticated", "sign_in_required");
  if (!can(actor, action, ctx)) throw new DomainError("forbidden", "action_forbidden", { action });
}
