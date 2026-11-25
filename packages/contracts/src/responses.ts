/**
 * Response contracts — zod schemas for every shape the API returns, with inferred TypeScript types.
 *
 * Why runtime schemas (not just types): the same definitions
 *  - generate the OpenAPI document and the API reference in docs/developer/ (so documentation cannot drift),
 *  - are used by the integration tests to validate every response body the API produces (so the server cannot
 *    drift from the contract), and
 *  - let any client validate what it receives.
 *
 * Conventions:
 *  - ids are UUID strings; timestamps are ISO-8601 UTC strings; calendar dates are YYYY-MM-DD.
 *  - Anything computed rather than recorded lives under `signals` / `derived` and names the `algorithm` that
 *    produced it. Clients must never present derived values as recorded facts.
 *  - A rating summary is `null` (or absent) when nobody has rated — absence of data is not a low score.
 *  - Schemas are non-strict for clients: unknown fields are ignored, so additive API changes never break them.
 */
import { z } from "zod";
import { LocaleTag } from "./requests";
import {
  ARGUMENT_STANCES,
  CAPACITIES,
  CLAIM_ROLES,
  CLAIM_STATUSES,
  COMMENT_KINDS,
  CONFIDENCE_LEVELS,
  DIMENSION_KEYS,
  EVALUATION_TARGET_KINDS,
  EVIDENCE_STANCES,
  EXPERTISE_BASES,
  IDEA_SECTIONS,
  IDEA_STAGES,
  INITIATIVE_KINDS,
  INITIATIVE_STATUSES,
  INVOLVEMENT_STATUSES,
  OUTCOME_RESULTS,
  PERSON_ROLES,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyName,
  RELATION_TYPES,
  REVISION_STATUSES,
  SOURCE_KINDS,
  STANCE_KINDS,
  STEWARD_ROLES,
  type DimensionKey,
} from "@ideaproxima/domain";

/** Named response components (OpenAPI `components/schemas`). */
export const responseRegistry = z.registry<{ id: string; description?: string }>();
const named = <T extends z.ZodType>(id: string, schema: T, description?: string): T => {
  responseRegistry.add(schema, description ? { id, description } : { id });
  return schema;
};

const id = z.uuid();
const timestamp = z.iso.datetime();
const calendarDate = z.iso.date();
const int = z.number().int();
const DimensionKeyEnum = z.enum(DIMENSION_KEYS as unknown as [DimensionKey, ...DimensionKey[]]);

// ---------------------------------------------------------------- generic

export type Page<T> = { items: T[]; nextCursor: string | null };
/** A page of items. `nextCursor` is opaque: pass it back as `cursor`; null when there is nothing more. */
export const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const ValidationIssue = named(
  "ValidationIssue",
  z.object({
    path: z.string(),
    code: z.string(),
    message: z.string(),
    params: z.record(z.string(), z.unknown()),
  }),
);
export type ValidationIssue = z.infer<typeof ValidationIssue>;

export const ErrorResponse = named(
  "Error",
  z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.looseObject({ reason: z.string(), issues: z.array(ValidationIssue).optional() }),
      requestId: z.string().optional(),
    }),
  }),
  "Every error. `code` is stable and machine-readable; `message` is for humans; `details.reason` is stable and more specific than `code`. Other detail fields are reason-specific; `requestId` correlates the response with server logs.",
);
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const RateLimitedResponse = named(
  "RateLimited",
  z.object({
    error: ErrorResponse.shape.error.extend({
      code: z.literal("rate_limited"),
      details: z.object({
        reason: z.literal("too_many_requests"),
        policy: z.enum(Object.keys(RATE_LIMIT_POLICIES) as RateLimitPolicyName[]),
        scope: z.enum(["account", "email", "network"]),
        limit: int.positive(),
        periodSeconds: int.positive(),
        retryAfterSeconds: int.positive(),
      }),
    }),
  }),
);

export const OkResponse = named("Ok", z.object({ ok: z.literal(true) }));
export type OkResponse = z.infer<typeof OkResponse>;

export const HealthResponse = named(
  "Health",
  z.object({ ok: z.boolean(), database: z.enum(["up", "down"]) }),
);
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ApiIndexResponse = named(
  "ApiIndex",
  z.object({
    name: z.string(),
    description: z.string(),
    apiVersion: z.literal("v1"),
    /** Entry points, as paths relative to the server. The OpenAPI document lists everything else. */
    links: z.object({
      openapi: z.string(),
      health: z.string(),
      vocabulary: z.string(),
      locales: z.string(),
      ideas: z.string(),
      topics: z.string(),
      search: z.string(),
      activity: z.string(),
    }),
  }),
);
export type ApiIndexResponse = z.infer<typeof ApiIndexResponse>;

// ---------------------------------------------------------------- references

export const PersonRef = named("PersonRef", z.object({ id, handle: z.string(), displayName: z.string() }));
export type PersonRef = z.infer<typeof PersonRef>;

export const TopicRef = named("TopicRef", z.object({ id, slug: z.string(), name: z.string() }));
export type TopicRef = z.infer<typeof TopicRef>;

export const IdeaRef = named(
  "IdeaRef",
  z.object({ id, slug: z.string(), title: z.string(), stage: z.enum(IDEA_STAGES) }),
);
export type IdeaRef = z.infer<typeof IdeaRef>;

// ---------------------------------------------------------------- derived signals

export const RatingSummaryDto = named(
  "RatingSummary",
  z.object({
    value: z.number().describe("Mean rescaled to 0–1 (for meters)."),
    mean: z.number().describe("Mean on the dimension's native scale (e.g. 1–5)."),
    dispersion: z.number().describe("Normalised spread: 0 = full agreement, 0.5 = maximal split."),
    n: int.describe("Number of current ratings. Below 3, show 'too early to tell'."),
  }),
  "A derived summary of current ratings on one dimension.",
);
export type RatingSummaryDto = z.infer<typeof RatingSummaryDto>;
const RatingOrNull = RatingSummaryDto.nullable();

export const IdeaSignals = named(
  "IdeaSignals",
  z.object({
    algorithm: z.string(),
    computedAt: timestamp.nullable(),
    attention: int.describe("People who marked the idea important. Popularity — not quality."),
    ratings: z.partialRecord(DimensionKeyEnum, RatingSummaryDto),
    perspectives: z.record(z.enum(STANCE_KINDS), z.object({ count: int, share: z.number() })),
    completeness: z.number().describe("Share of narrative sections written (0–1)."),
    contestation: z.number().describe("Widest disagreement among confidently rated dimensions (0–0.5)."),
    counts: z.object({
      claims: int,
      evidence: int,
      evidenceSupporting: int,
      evidenceChallenging: int,
      arguments: int,
      comments: int,
      initiatives: int,
      contributors: int,
      evaluators: int,
    }),
  }),
  "Derived signals of an idea. Every value is computed by `algorithm` and can be rebuilt from facts.",
);
export type IdeaSignals = z.infer<typeof IdeaSignals>;

// ---------------------------------------------------------------- people

export const PersonDto = named(
  "Person",
  PersonRef.extend({
    bio: z.string(),
    affiliation: z.string(),
    capacities: z.array(z.enum(CAPACITIES)),
    role: z.enum(PERSON_ROLES),
    active: z.boolean().describe("False when deactivated by moderation. Contributions stay attributed."),
    createdAt: timestamp,
  }),
);
export type PersonDto = z.infer<typeof PersonDto>;

const Preferences = z.object({ locale: LocaleTag.nullable() });

export const MeResponse = named(
  "Me",
  z.object({ person: PersonDto, email: z.string(), preferences: Preferences }),
);
export type MeResponse = z.infer<typeof MeResponse>;

export const AuthResponse = named(
  "Auth",
  z.object({
    person: PersonDto,
    preferences: Preferences,
    token: z.string().describe("Session token. Also set as the HttpOnly `ip_session` cookie."),
    expiresAt: timestamp,
  }),
);
export type AuthResponse = z.infer<typeof AuthResponse>;

export const ExpertiseDto = named(
  "Expertise",
  z.object({ topic: TopicRef, basis: z.enum(EXPERTISE_BASES), note: z.string(), since: timestamp }),
);
export type ExpertiseDto = z.infer<typeof ExpertiseDto>;

// ---------------------------------------------------------------- topics

export const TopicDto = named(
  "Topic",
  TopicRef.extend({
    description: z.string(),
    parentId: id.nullable(),
    ideaCount: int.describe("Visible ideas in this topic or its direct children."),
    latestIdeas: z
      .array(IdeaRef)
      .describe("Up to two newest visible ideas in this topic or its direct children, newest first."),
  }),
);
export type TopicDto = z.infer<typeof TopicDto>;

export const LocaleDto = named(
  "Locale",
  z.object({
    tag: LocaleTag,
    name: z.string(),
    direction: z.enum(["ltr", "rtl"]),
    status: z.enum(["released", "beta"]),
  }),
);
export type LocaleDto = z.infer<typeof LocaleDto>;

export const TopicTranslationDto = named(
  "TopicTranslation",
  z.object({
    locale: LocaleTag,
    name: z.string(),
    description: z.string(),
  }),
);
export type TopicTranslationDto = z.infer<typeof TopicTranslationDto>;

export const TopicDetailDto = named("TopicDetail", TopicDto.extend({ children: z.array(TopicDto) }));
export type TopicDetailDto = z.infer<typeof TopicDetailDto>;

// ---------------------------------------------------------------- ideas

export const IdeaListItem = named(
  "IdeaListItem",
  z.object({
    id,
    slug: z.string(),
    title: z.string(),
    summary: z.string(),
    stage: z.enum(IDEA_STAGES),
    stageChangedAt: timestamp,
    topics: z.array(TopicRef).describe("1–4 topics; the first is primary."),
    tags: z.array(z.string()),
    proposedBy: PersonRef,
    createdAt: timestamp,
    updatedAt: timestamp.describe("When the current revision was published."),
    signals: IdeaSignals,
  }),
);
export type IdeaListItem = z.infer<typeof IdeaListItem>;

export const IdeaPage = named("IdeaPage", page(IdeaListItem));

export const StewardDto = named(
  "Steward",
  z.object({ person: PersonRef, role: z.enum(STEWARD_ROLES), since: timestamp }),
);
export type StewardDto = z.infer<typeof StewardDto>;

export const ViewerRating = named(
  "ViewerRating",
  z.object({
    dimension: DimensionKeyEnum,
    value: z.number(),
    confidence: z.enum(CONFIDENCE_LEVELS).nullable(),
  }),
);
export type ViewerRating = z.infer<typeof ViewerRating>;

export const ViewerState = named(
  "ViewerState",
  z.object({
    isSteward: z.boolean(),
    stances: z.array(z.enum(STANCE_KINDS)),
    ratings: z.array(ViewerRating),
    involvements: z.array(z.object({ capacity: z.enum(CAPACITIES), status: z.enum(INVOLVEMENT_STATUSES) })),
  }),
  "The signed-in viewer's own relationship to an idea.",
);
export type ViewerState = z.infer<typeof ViewerState>;

export const RevisionRef = named(
  "RevisionRef",
  z.object({ id, number: int, author: PersonRef, createdAt: timestamp, changeNote: z.string() }),
);
export type RevisionRef = z.infer<typeof RevisionRef>;

export const StageRequirementDto = named(
  "StageRequirement",
  z.object({ stage: z.enum(IDEA_STAGES), met: z.boolean(), requirement: z.string() }),
);

const IdeaSections = z.partialRecord(z.enum(IDEA_SECTIONS), z.string());

export const IdeaDetail = named(
  "IdeaDetail",
  IdeaListItem.extend({
    revision: RevisionRef,
    sections: IdeaSections.describe("Markdown. `[text](claim:<id>)` links anchor prose to claims."),
    stewards: z.array(StewardDto),
    hidden: z.boolean(),
    stageRequirements: z.array(StageRequirementDto),
    pendingRevisionProposals: int,
    viewer: ViewerState.nullable().describe("Null for anonymous viewers."),
  }),
);
export type IdeaDetail = z.infer<typeof IdeaDetail>;

export const IdeaContentDto = named(
  "IdeaContent",
  z.object({
    title: z.string(),
    summary: z.string(),
    sections: IdeaSections,
    topics: z.array(z.string()).describe("Topic slugs."),
    tags: z.array(z.string()),
  }),
);
export type IdeaContentDto = z.infer<typeof IdeaContentDto>;

export const RevisionSummaryDto = named(
  "RevisionSummary",
  RevisionRef.extend({
    ideaId: id,
    status: z.enum(REVISION_STATUSES),
    baseRevisionId: id.nullable(),
    decidedBy: PersonRef.nullable(),
    decidedAt: timestamp.nullable(),
    decisionNote: z.string(),
  }),
);
export type RevisionSummaryDto = z.infer<typeof RevisionSummaryDto>;

export const RevisionDto = named("Revision", RevisionSummaryDto.extend({ content: IdeaContentDto }));
export type RevisionDto = z.infer<typeof RevisionDto>;

export const StageTransitionDto = named(
  "StageTransition",
  z.object({
    id,
    from: z.enum(IDEA_STAGES).nullable(),
    to: z.enum(IDEA_STAGES),
    rationale: z.string(),
    decidedBy: PersonRef,
    occurredAt: timestamp,
    initiativeId: id.nullable(),
  }),
);
export type StageTransitionDto = z.infer<typeof StageTransitionDto>;

// ---------------------------------------------------------------- knowledge

export const ClaimDto = named(
  "Claim",
  z.object({
    id,
    statement: z.string(),
    createdBy: PersonRef,
    createdAt: timestamp,
    hidden: z.boolean(),
    derived: z.object({
      algorithm: z.string(),
      status: z.enum(CLAIM_STATUSES),
      support: RatingOrNull,
      plausibility: RatingOrNull,
    }),
    evidenceCounts: z.record(z.enum(EVIDENCE_STANCES), int),
    ideaCount: int.describe("Ideas this claim currently underpins."),
  }),
);
export type ClaimDto = z.infer<typeof ClaimDto>;

export const IdeaClaimDto = named(
  "IdeaClaim",
  ClaimDto.extend({
    linkId: id,
    role: z.enum(CLAIM_ROLES),
    depth: int.nullable(),
    position: int,
    addedBy: PersonRef,
    addedAt: timestamp,
  }),
  "A claim as it functions within one idea.",
);
export type IdeaClaimDto = z.infer<typeof IdeaClaimDto>;

export const SourceDto = named(
  "Source",
  z.object({
    id,
    kind: z.enum(SOURCE_KINDS),
    title: z.string(),
    authors: z.string(),
    venue: z.string(),
    year: int.nullable(),
    doi: z.string().nullable(),
    url: z.string().nullable(),
    registeredBy: PersonRef,
    createdAt: timestamp,
  }),
);
export type SourceDto = z.infer<typeof SourceDto>;

export const SourceDetailDto = named("SourceDetail", SourceDto.extend({ citedBy: int }));
export type SourceDetailDto = z.infer<typeof SourceDetailDto>;

export const EvidenceDto = named(
  "Evidence",
  z.object({
    id,
    claimId: id,
    stance: z.enum(EVIDENCE_STANCES),
    summary: z.string(),
    limitations: z.string().describe("What this evidence does NOT establish."),
    locator: z.string(),
    source: SourceDto.nullable(),
    outcome: z.object({ id, initiativeId: id, result: z.enum(OUTCOME_RESULTS) }).nullable(),
    contributedBy: PersonRef,
    createdAt: timestamp,
    withdrawnAt: timestamp.nullable(),
    withdrawnReason: z.string(),
    hidden: z.boolean(),
    derived: z.object({ algorithm: z.string(), quality: RatingOrNull, relevance: RatingOrNull }),
  }),
);
export type EvidenceDto = z.infer<typeof EvidenceDto>;

export const ArgumentDto = named(
  "Argument",
  z.object({
    id,
    target: z.object({ kind: z.enum(["idea", "claim", "argument"]), id }),
    stance: z.enum(ARGUMENT_STANCES),
    title: z.string(),
    body: z.string(),
    author: PersonRef,
    createdAt: timestamp,
    withdrawnAt: timestamp.nullable(),
    hidden: z.boolean(),
    replyCount: int,
    derived: z.object({ algorithm: z.string(), strength: RatingOrNull, usefulCount: int }),
  }),
);
export type ArgumentDto = z.infer<typeof ArgumentDto>;

export const ArgumentDetailDto = named(
  "ArgumentDetail",
  ArgumentDto.extend({ replies: z.array(ArgumentDto) }),
);
export type ArgumentDetailDto = z.infer<typeof ArgumentDetailDto>;

export const ClaimDetailDto = named(
  "ClaimDetail",
  ClaimDto.extend({
    ideas: z.array(IdeaRef.extend({ role: z.enum(CLAIM_ROLES) })),
    evidence: z.array(EvidenceDto),
    arguments: z.array(ArgumentDto),
  }),
);
export type ClaimDetailDto = z.infer<typeof ClaimDetailDto>;

// ---------------------------------------------------------------- signals

export const EvaluationDto = named(
  "Evaluation",
  z.object({
    id,
    submissionId: id,
    evaluator: PersonRef,
    target: z.object({ kind: z.enum(EVALUATION_TARGET_KINDS), id }),
    dimension: z.string(),
    value: z.number(),
    confidence: z.enum(CONFIDENCE_LEVELS).nullable(),
    rationale: z.string(),
    createdAt: timestamp,
    supersededAt: timestamp.nullable().describe("Set when the evaluator re-rated or withdrew."),
  }),
  "One raw observation: a person's rating of a target on one dimension.",
);
export type EvaluationDto = z.infer<typeof EvaluationDto>;

export const EvaluationPage = named("EvaluationPage", page(EvaluationDto));

export const SubmitEvaluationResponse = named(
  "SubmitEvaluationResult",
  z.object({
    submissionId: id,
    changed: z
      .array(z.string())
      .describe("Dimensions recorded; empty when the submission repeated current ratings."),
    current: z.array(ViewerRating),
  }),
);
export type SubmitEvaluationResponse = z.infer<typeof SubmitEvaluationResponse>;

export const WithdrawEvaluationResponse = named(
  "WithdrawEvaluationResult",
  z.object({ current: z.array(ViewerRating) }),
);
export type WithdrawEvaluationResponse = z.infer<typeof WithdrawEvaluationResponse>;

export const StancesResponse = named("Stances", z.object({ stances: z.array(z.enum(STANCE_KINDS)) }));
export type StancesResponse = z.infer<typeof StancesResponse>;

export const InvolvementDto = named(
  "Involvement",
  z.object({
    person: PersonRef,
    capacity: z.enum(CAPACITIES),
    status: z.enum(INVOLVEMENT_STATUSES),
    note: z.string(),
    since: timestamp,
  }),
);
export type InvolvementDto = z.infer<typeof InvolvementDto>;

// ---------------------------------------------------------------- profiles

export const ProfileDto = named(
  "Profile",
  z.object({
    person: PersonDto,
    expertise: z.array(ExpertiseDto),
    contributions: z
      .object({
        ideasProposed: int,
        revisionsAccepted: int,
        claims: int,
        evidence: int,
        arguments: int,
        evaluations: int,
        comments: int,
        initiatives: int,
        usefulReceived: int,
      })
      .describe("Plain counts of recorded contributions — not a quality measure."),
    ideas: z.array(IdeaListItem),
    involvements: z.array(
      z.object({
        idea: IdeaRef,
        capacity: z.enum(CAPACITIES),
        status: z.enum(INVOLVEMENT_STATUSES),
        since: timestamp,
      }),
    ),
  }),
);
export type ProfileDto = z.infer<typeof ProfileDto>;

// ---------------------------------------------------------------- graph

export const RelationDto = named(
  "Relation",
  z.object({
    id,
    type: z.enum(RELATION_TYPES),
    from: IdeaRef,
    to: IdeaRef,
    rationale: z.string(),
    proposedBy: PersonRef,
    createdAt: timestamp,
    derived: z.object({ algorithm: z.string(), validity: RatingOrNull }),
  }),
);
export type RelationDto = z.infer<typeof RelationDto>;

export const IdeaRelationView = named(
  "IdeaRelation",
  RelationDto.extend({
    phrase: z.string().describe('The relation read from the focal idea, e.g. "is required by".'),
    direction: z.enum(["outgoing", "incoming", "symmetric"]),
    other: IdeaRef,
  }),
);
export type IdeaRelationView = z.infer<typeof IdeaRelationView>;

export const GraphDto = named(
  "Graph",
  z.object({
    focusId: id,
    nodes: z.array(IdeaRef.extend({ distance: int, topics: z.array(z.string()) })),
    edges: z.array(z.object({ id, type: z.enum(RELATION_TYPES), from: id, to: id })),
  }),
);
export type GraphDto = z.infer<typeof GraphDto>;

// ---------------------------------------------------------------- practice

export const OutcomeDto = named(
  "Outcome",
  z.object({
    id,
    initiativeId: id,
    result: z.enum(OUTCOME_RESULTS),
    summary: z.string(),
    lessons: z.string(),
    source: SourceDto.nullable(),
    recordedBy: PersonRef,
    recordedAt: timestamp,
  }),
);
export type OutcomeDto = z.infer<typeof OutcomeDto>;

export const InitiativeDto = named(
  "Initiative",
  z.object({
    id,
    idea: IdeaRef,
    kind: z.enum(INITIATIVE_KINDS),
    title: z.string(),
    description: z.string(),
    organization: z.string(),
    url: z.string().nullable(),
    status: z.enum(INITIATIVE_STATUSES),
    startedOn: calendarDate.nullable(),
    endedOn: calendarDate.nullable(),
    createdBy: PersonRef,
    createdAt: timestamp,
    hidden: z.boolean(),
    outcomes: z.array(OutcomeDto),
  }),
);
export type InitiativeDto = z.infer<typeof InitiativeDto>;

// ---------------------------------------------------------------- discussion, history, search, moderation

export const CommentDto = named(
  "Comment",
  z.object({
    id,
    ideaId: id,
    kind: z.enum(COMMENT_KINDS),
    body: z.string().describe("Empty when hidden by moderation (the comment keeps its place in the thread)."),
    author: PersonRef,
    parentId: id.nullable(),
    anchor: z.object({ kind: z.enum(["claim", "evidence", "argument"]), id }).nullable(),
    createdAt: timestamp,
    hidden: z.boolean(),
    derived: z.object({ usefulCount: int }),
  }),
);
export type CommentDto = z.infer<typeof CommentDto>;

export const CommentPage = named("CommentPage", page(CommentDto));

export const ActivityDto = named(
  "Activity",
  z.object({
    id,
    occurredAt: timestamp,
    actor: PersonRef.nullable(),
    action: z.string().describe('Dotted verb, e.g. "evidence.attached", "moderation.hidden".'),
    ideaId: id.nullable(),
    idea: IdeaRef.nullable().describe("The idea `ideaId` refers to, for display; null when none or hidden."),
    subject: z.object({ kind: z.string(), id, hidden: z.boolean() }),
    payload: z.record(z.string(), z.unknown()),
  }),
  "One entry of the append-only activity ledger.",
);
export type ActivityDto = z.infer<typeof ActivityDto>;

export const ActivityPage = named("ActivityPage", page(ActivityDto));

export const SearchResults = named(
  "SearchResults",
  z.object({
    ideas: z.array(IdeaListItem),
    claims: z.array(z.object({ id, statement: z.string(), ideaCount: int, status: z.enum(CLAIM_STATUSES) })),
    sources: z.array(SourceDto),
    people: z.array(PersonRef),
  }),
);
export type SearchResults = z.infer<typeof SearchResults>;

export const ModerationResponse = named("ModerationResult", z.object({ hidden: z.boolean() }));
export type ModerationResponse = z.infer<typeof ModerationResponse>;

// ---------------------------------------------------------------- vocabulary

const VocabularyEntry = z.looseObject({
  key: z.union([z.string(), z.number()]),
  label: z.string(),
  description: z.string(),
});

export const VocabularyResponse = named(
  "Vocabulary",
  z.object({
    locale: LocaleTag,
    stages: z.array(VocabularyEntry),
    sections: z.array(VocabularyEntry),
    claimRoles: z.array(VocabularyEntry),
    consequenceDepths: z.array(VocabularyEntry),
    claimStatuses: z.array(VocabularyEntry),
    evidenceStances: z.array(VocabularyEntry),
    sourceKinds: z.array(VocabularyEntry),
    argumentStances: z.array(VocabularyEntry),
    commentKinds: z.array(z.string()),
    dimensions: z.array(VocabularyEntry),
    confidenceLevels: z.array(z.string()),
    stanceKinds: z.array(VocabularyEntry),
    capacities: z.array(VocabularyEntry),
    involvementStatuses: z.array(VocabularyEntry),
    relationTypes: z.array(VocabularyEntry),
    initiativeKinds: z.array(VocabularyEntry),
    initiativeStatuses: z.array(VocabularyEntry),
    outcomeResults: z.array(VocabularyEntry),
    revisionStatuses: z.array(VocabularyEntry),
    lenses: z.array(VocabularyEntry),
    minRatingsForConfidence: int,
    metricsAlgorithm: z.string(),
    limits: z.record(z.string(), z.object({ min: z.number().optional(), max: z.number() })),
  }),
  "The whole product vocabulary: labels, descriptions, scales and lens explanations.",
);
export type VocabularyResponse = z.infer<typeof VocabularyResponse>;
