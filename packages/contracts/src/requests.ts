/**
 * Request schemas. The API validates every request body and query against these, and a frontend can reuse
 * them for form validation. Shape and length checks live here; domain rules (stage proofs, permissions,
 * dimension applicability) live in @ideaproxima/domain and are enforced by the API.
 */
import { z } from "zod";
import {
  ARGUMENT_STANCES,
  CAPACITIES,
  CLAIM_ROLES,
  COMMENT_KINDS,
  CONFIDENCE_LEVELS,
  EVALUATION_TARGET_KINDS,
  EVIDENCE_STANCES,
  GRAPH_DIRECTIONS,
  IDEA_SECTIONS,
  IDEA_STAGES,
  INITIATIVE_KINDS,
  INITIATIVE_STATUSES,
  INVOLVEMENT_STATUSES,
  LENS_KEYS,
  LIMITS,
  MAX_GRAPH_DEPTH,
  OUTCOME_RESULTS,
  PERSON_ROLES,
  RELATION_TYPES,
  REVISION_STATUSES,
  SOURCE_KINDS,
} from "@ideaproxima/domain";

const id = z.uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.iso.date();

// The API owns the supported locale list and validates persisted preferences against it.
export const LocaleTag = z
  .string()
  .max(35)
  .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/);
export const LocaleQuery = z.object({
  locale: z
    .string()
    .optional()
    .describe("Preferred language tag. Unsupported tags fall through to request negotiation."),
});

// ---------------------------------------------------------------- auth & people

export const RegisterRequest = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .min(LIMITS.handle.min)
    .max(LIMITS.handle.max)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, digits and single hyphens."),
  displayName: text(LIMITS.displayName.min, LIMITS.displayName.max),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(LIMITS.password.min).max(LIMITS.password.max),
  locale: LocaleTag.optional().describe("A supported locale tag from GET /v1/locales."),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const LoginRequest = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(LIMITS.password.max),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const UpdateProfileRequest = z.object({
  displayName: text(LIMITS.displayName.min, LIMITS.displayName.max).optional(),
  bio: optionalText(LIMITS.bio.max),
  affiliation: optionalText(200),
  capacities: z.array(z.enum(CAPACITIES)).max(CAPACITIES.length).optional(),
  locale: LocaleTag.nullable().optional().describe("A supported locale tag, or null to resume negotiation."),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const DeclareExpertiseRequest = z.object({
  topic: z.string().trim().min(1).max(80),
  note: optionalText(500),
});
export type DeclareExpertiseRequest = z.infer<typeof DeclareExpertiseRequest>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(LIMITS.password.max),
  newPassword: z.string().min(LIMITS.password.min).max(LIMITS.password.max),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

/** Moderator action on an account (deactivate / reactivate). The reason is published in the moderation log. */
export const PersonModerationRequest = z.object({ reason: text(3, LIMITS.rationale.max) });
export type PersonModerationRequest = z.infer<typeof PersonModerationRequest>;

export const SetRoleRequest = z.object({ role: z.enum(PERSON_ROLES) });
export type SetRoleRequest = z.infer<typeof SetRoleRequest>;

// ---------------------------------------------------------------- ideas & revisions

export const IdeaContentInput = z.object({
  title: text(LIMITS.ideaTitle.min, LIMITS.ideaTitle.max),
  summary: text(LIMITS.ideaSummary.min, LIMITS.ideaSummary.max),
  sections: z.partialRecord(z.enum(IDEA_SECTIONS), z.string().max(LIMITS.section.max)).default({}),
  topics: z
    .array(z.string().trim().min(1).max(80))
    .min(LIMITS.topicsPerIdea.min)
    .max(LIMITS.topicsPerIdea.max),
  tags: z.array(z.string().trim().min(1).max(LIMITS.tag.max)).max(LIMITS.tagsPerIdea.max).default([]),
});
export type IdeaContentInput = z.infer<typeof IdeaContentInput>;

export const ProposeIdeaRequest = IdeaContentInput.extend({});
export type ProposeIdeaRequest = z.infer<typeof ProposeIdeaRequest>;

export const SubmitRevisionRequest = z.object({
  /** The revision the author edited. Publishing over a newer revision is a conflict (optimistic concurrency). */
  baseRevisionId: id,
  content: IdeaContentInput,
  changeNote: text(3, LIMITS.changeNote.max),
  /** "auto": stewards publish directly, everyone else proposes. */
  intent: z.enum(["auto", "publish", "propose"]).default("auto"),
});
export type SubmitRevisionRequest = z.infer<typeof SubmitRevisionRequest>;

export const DecideRevisionRequest = z.object({
  decision: z.enum(["accept", "reject"]),
  note: optionalText(LIMITS.rationale.max),
});
export type DecideRevisionRequest = z.infer<typeof DecideRevisionRequest>;

export const StageTransitionRequest = z.object({
  to: z.enum(IDEA_STAGES),
  rationale: text(1, LIMITS.rationale.max),
  /** Optional initiative that motivated the transition (e.g. the pilot that justifies "tested"). */
  initiativeId: id.optional(),
});
export type StageTransitionRequest = z.infer<typeof StageTransitionRequest>;

export const AppointStewardRequest = z.object({
  handle: z.string().trim().toLowerCase().min(1).max(LIMITS.handle.max),
});
export type AppointStewardRequest = z.infer<typeof AppointStewardRequest>;

// ---------------------------------------------------------------- knowledge

export const ClaimAssessmentInput = z.object({
  support: z.number().int().min(1).max(5).optional(),
  plausibility: z.number().int().min(1).max(5).optional(),
  confidence: z.enum(CONFIDENCE_LEVELS).optional(),
});

export const AddClaimRequest = z
  .object({
    /** Link an existing claim (claims are shared across ideas) … */
    claimId: id.optional(),
    /** … or state a new one. */
    statement: text(LIMITS.claimStatement.min, LIMITS.claimStatement.max).optional(),
    role: z.enum(CLAIM_ROLES),
    depth: z.number().int().min(1).max(4).optional(),
    /** The contributor's own assessment, recorded as an ordinary evaluation of the claim. */
    assessment: ClaimAssessmentInput.optional(),
  })
  .refine((v) => !!v.claimId !== !!v.statement, {
    message: "Provide exactly one of claimId or statement.",
    params: { reason: "claim_reference" },
  })
  .describe("Provide exactly one of `claimId` (link an existing claim) or `statement` (state a new one).");
export type AddClaimRequest = z.infer<typeof AddClaimRequest>;

export const SourceInput = z.object({
  kind: z.enum(SOURCE_KINDS),
  title: text(3, 500),
  authors: optionalText(1_000),
  venue: optionalText(300),
  year: z.number().int().min(1000).max(2200).optional(),
  doi: optionalText(200),
  url: z.url().max(2_000).optional(),
});
export type SourceInput = z.infer<typeof SourceInput>;

export const AttachEvidenceRequest = z
  .object({
    sourceId: id.optional(),
    source: SourceInput.optional(),
    /** Evidence produced on the platform itself: an initiative's recorded outcome. */
    outcomeId: id.optional(),
    stance: z.enum(EVIDENCE_STANCES),
    /** What this evidence shows about the claim. */
    summary: text(LIMITS.evidenceSummary.min, LIMITS.evidenceSummary.max),
    /** What it does NOT establish. Encouraged everywhere in the UI. */
    limitations: optionalText(LIMITS.evidenceSummary.max),
    /** Page, figure, table, section… */
    locator: optionalText(200),
  })
  .refine((v) => [v.sourceId, v.source, v.outcomeId].filter(Boolean).length === 1, {
    message: "Provide exactly one of sourceId, source or outcomeId.",
    params: { reason: "evidence_basis" },
  })
  .describe(
    "Provide exactly one basis: `sourceId`, `source` (registered or matched by DOI/URL) or `outcomeId`.",
  );
export type AttachEvidenceRequest = z.infer<typeof AttachEvidenceRequest>;

export const WithdrawRequest = z.object({ reason: text(3, LIMITS.rationale.max) });
export type WithdrawRequest = z.infer<typeof WithdrawRequest>;

export const ArgumentTarget = z.object({ kind: z.enum(["idea", "claim", "argument"]), id });
export const CreateArgumentRequest = z.object({
  target: ArgumentTarget,
  stance: z.enum(ARGUMENT_STANCES),
  title: text(LIMITS.argumentTitle.min, LIMITS.argumentTitle.max),
  body: text(LIMITS.argumentBody.min, LIMITS.argumentBody.max),
});
export type CreateArgumentRequest = z.infer<typeof CreateArgumentRequest>;

// ---------------------------------------------------------------- signals

export const EvaluationTarget = z.object({ kind: z.enum(EVALUATION_TARGET_KINDS), id });
export type EvaluationTarget = z.infer<typeof EvaluationTarget>;

export const SubmitEvaluationRequest = z.object({
  target: EvaluationTarget,
  ratings: z
    .array(
      z.object({
        dimension: z.string().min(1).max(40),
        value: z.number(),
        confidence: z.enum(CONFIDENCE_LEVELS).optional(),
      }),
    )
    .min(1)
    .max(20),
  rationale: optionalText(LIMITS.rationale.max),
});
export type SubmitEvaluationRequest = z.infer<typeof SubmitEvaluationRequest>;

export const WithdrawEvaluationRequest = z.object({
  target: EvaluationTarget,
  dimensions: z.array(z.string().min(1).max(40)).min(1).max(20),
});
export type WithdrawEvaluationRequest = z.infer<typeof WithdrawEvaluationRequest>;

export const DeclareInvolvementRequest = z.object({
  status: z.enum(INVOLVEMENT_STATUSES),
  note: optionalText(1_000),
});
export type DeclareInvolvementRequest = z.infer<typeof DeclareInvolvementRequest>;

// ---------------------------------------------------------------- graph

export const ProposeRelationRequest = z.object({
  fromIdeaId: id,
  toIdeaId: id,
  type: z.enum(RELATION_TYPES),
  rationale: optionalText(LIMITS.rationale.max),
});
export type ProposeRelationRequest = z.infer<typeof ProposeRelationRequest>;

export const GraphQuery = z.object({
  direction: z.enum(GRAPH_DIRECTIONS).default("both"),
  depth: z.coerce.number().int().min(1).max(MAX_GRAPH_DEPTH).default(2),
});
export type GraphQuery = z.infer<typeof GraphQuery>;

// ---------------------------------------------------------------- practice

export const CreateInitiativeRequest = z.object({
  kind: z.enum(INITIATIVE_KINDS),
  title: text(5, 200),
  description: text(20, 10_000),
  organization: optionalText(200),
  url: z.url().max(2_000).optional(),
  /** Historical initiatives can be recorded directly as completed. */
  status: z.enum(INITIATIVE_STATUSES).default("planned"),
  startedOn: isoDate.optional(),
  endedOn: isoDate.optional(),
});
export type CreateInitiativeRequest = z.infer<typeof CreateInitiativeRequest>;

export const UpdateInitiativeStatusRequest = z.object({
  status: z.enum(INITIATIVE_STATUSES),
  note: optionalText(LIMITS.rationale.max),
  on: isoDate.optional(),
});
export type UpdateInitiativeStatusRequest = z.infer<typeof UpdateInitiativeStatusRequest>;

export const RecordOutcomeRequest = z.object({
  result: z.enum(OUTCOME_RESULTS),
  summary: text(20, 10_000),
  /** What was learned. Required to move an idea to "learned from". */
  lessons: optionalText(10_000),
  sourceId: id.optional(),
});
export type RecordOutcomeRequest = z.infer<typeof RecordOutcomeRequest>;

// ---------------------------------------------------------------- discussion & moderation

export const PostCommentRequest = z.object({
  kind: z.enum(COMMENT_KINDS).default("comment"),
  body: text(LIMITS.commentBody.min, LIMITS.commentBody.max),
  parentId: id.optional(),
  anchor: z.object({ kind: z.enum(["claim", "evidence", "argument"]), id }).optional(),
});
export type PostCommentRequest = z.infer<typeof PostCommentRequest>;

export const MODERATABLE_KINDS = ["idea", "claim", "evidence", "argument", "comment", "initiative"] as const;
export type ModeratableKind = (typeof MODERATABLE_KINDS)[number];

export const ModerationRequest = z.object({
  target: z.object({ kind: z.enum(MODERATABLE_KINDS), id }),
  action: z.enum(["hide", "restore"]),
  reason: text(3, LIMITS.rationale.max),
});
export type ModerationRequest = z.infer<typeof ModerationRequest>;

// ---------------------------------------------------------------- queries

export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(500).optional(),
});

export const ListIdeasQuery = PageQuery.extend({
  lens: z.enum(LENS_KEYS).default("newest"),
  topic: z.string().max(80).optional(),
  stage: z.enum(IDEA_STAGES).optional(),
  tag: z.string().max(LIMITS.tag.max).optional(),
  q: z.string().trim().max(200).optional(),
});
export type ListIdeasQuery = z.infer<typeof ListIdeasQuery>;

export const SearchQuery = PageQuery.extend({ q: z.string().trim().min(1).max(200) });
export type SearchQuery = z.infer<typeof SearchQuery>;

export const ActivityQuery = PageQuery.extend({
  /** Prefix filter on the action verb, e.g. "moderation." for the public moderation log. */
  action: z.string().max(60).optional(),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

export const RevisionsQuery = z.object({ status: z.enum(REVISION_STATUSES).optional() });
export type RevisionsQuery = z.infer<typeof RevisionsQuery>;

// ---------------------------------------------------------------- catalog administration

export const TopicTranslationRequest = z.object({
  name: text(1, 80),
  description: text(0, 500),
});
export type TopicTranslationRequest = z.infer<typeof TopicTranslationRequest>;

export const CreateTopicRequest = z.object({
  name: text(2, 80),
  description: optionalText(1_000),
  /** Slug of an existing topic to nest under. */
  parentSlug: z.string().trim().max(80).optional(),
  /** Defaults to a slug derived from the name. */
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,60}$/)
    .optional(),
});
export type CreateTopicRequest = z.infer<typeof CreateTopicRequest>;

export const EvaluationsQuery = PageQuery.extend({
  targetKind: z.enum(EVALUATION_TARGET_KINDS),
  targetId: id,
  /** "current" = latest rating per person; "all" = full history including superseded ratings. */
  history: z.enum(["current", "all"]).default("current"),
});
export type EvaluationsQuery = z.infer<typeof EvaluationsQuery>;

// ---------------------------------------------------------------- registry (OpenAPI components)

/** Named request-body components for the OpenAPI document. Query schemas become parameters instead. */
export const requestRegistry = z.registry<{ id: string }>();
for (const [id, schema] of Object.entries({
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  DeclareExpertiseRequest,
  ChangePasswordRequest,
  PersonModerationRequest,
  SetRoleRequest,
  IdeaContentInput,
  ProposeIdeaRequest,
  SubmitRevisionRequest,
  DecideRevisionRequest,
  StageTransitionRequest,
  AppointStewardRequest,
  ClaimAssessmentInput,
  AddClaimRequest,
  SourceInput,
  AttachEvidenceRequest,
  WithdrawRequest,
  ArgumentTarget,
  CreateArgumentRequest,
  EvaluationTarget,
  SubmitEvaluationRequest,
  WithdrawEvaluationRequest,
  DeclareInvolvementRequest,
  ProposeRelationRequest,
  CreateInitiativeRequest,
  UpdateInitiativeStatusRequest,
  RecordOutcomeRequest,
  PostCommentRequest,
  ModerationRequest,
  CreateTopicRequest,
  TopicTranslationRequest,
})) {
  requestRegistry.add(schema, { id });
}
