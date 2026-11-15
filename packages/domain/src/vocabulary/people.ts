import type { Term } from "./term";

/**
 * Platform roles. Deliberately minimal: most authority is contextual (being a steward of a specific idea),
 * not global. Moderators keep the archive usable; they do not decide what is true.
 */
export const PERSON_ROLES = ["member", "moderator", "admin"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

/** Roles a person can hold on a specific idea. */
export const STEWARD_ROLES = ["originator", "steward"] as const;
export type StewardRole = (typeof STEWARD_ROLES)[number];

export const STEWARD_ROLE_INFO: Record<StewardRole, Term> = {
  originator: { label: "Originator", description: "Proposed the idea on the platform." },
  steward: {
    label: "Steward",
    description: "Maintains the idea's narrative; accepts or rejects proposed revisions.",
  },
};

/**
 * Basis of a person's claimed expertise in a topic. Self-declared and verified expertise are separate facts so
 * that "expert evaluation" can be shown as its own lens — never silently merged into community evaluation.
 */
export const EXPERTISE_BASES = ["self_declared", "verified"] as const;
export type ExpertiseBasis = (typeof EXPERTISE_BASES)[number];

export const REVISION_STATUSES = ["proposed", "accepted", "rejected", "withdrawn"] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export const REVISION_STATUS_INFO: Record<RevisionStatus, Term> = {
  proposed: { label: "Proposed", description: "Awaiting a steward's decision." },
  accepted: { label: "Accepted", description: "Part of the idea's published history." },
  rejected: { label: "Rejected", description: "Not adopted. Preserved with the reason." },
  withdrawn: { label: "Withdrawn", description: "Withdrawn by its author before a decision." },
};
