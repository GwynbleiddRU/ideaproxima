/**
 * ENDPOINT CATALOGUE — every HTTP endpoint of the API, declared once.
 *
 * It is the single source for: the OpenAPI document (`GET /v1/openapi.json`, docs/developer/api/openapi.json), the
 * generated API reference (docs/developer/api-reference.md), and the integration tests, which (1) assert that this
 * catalogue and the server's routes are identical and (2) validate every successful response body against
 * the `response` schema declared here. Adding a route without cataloguing it fails the test suite.
 */
import { z } from "zod";
import * as Req from "./requests";
import * as Res from "./responses";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointSpec {
  method: HttpMethod;
  /** Path with `:param` placeholders, including the /v1 prefix. */
  path: string;
  tag: Tag;
  summary: string;
  description?: string;
  /** "public": no session needed (viewer-specific fields appear when signed in). "member": a session is required. */
  auth: "public" | "member";
  /** Who may perform it, beyond being signed in. */
  who?: string;
  query?: z.ZodType;
  body?: z.ZodType;
  response: z.ZodType;
  /** Success status (default 200). A list when the operation can succeed in several ways. */
  status?: number | number[];
  /** Notable domain errors beyond validation/auth, as `code: meaning`. */
  errors?: string[];
}

export const TAGS = {
  Catalog: "Vocabulary, topics, search, the activity feed and service metadata.",
  Identity: "Accounts, sessions, profiles, expertise and account moderation.",
  Ideas: "Ideas, their narrative revisions, stewardship and lifecycle.",
  Knowledge: "Claims, sources, evidence and arguments — the epistemic structure of ideas.",
  Signals: "Evaluations, stances and involvements — what people assess, care about and commit to.",
  Graph: "Typed relations between ideas and graph traversal.",
  Practice: "Initiatives (real-world action) and their outcomes.",
  Discussion: "Comments and moderation.",
} as const;
export type Tag = keyof typeof TAGS;

/** Descriptions of path parameters, by name. */
export const PATH_PARAMS: Record<string, string> = {
  idea: "Idea id (UUID) or slug.",
  revision: "Revision id.",
  link: "Claim link id (`linkId` of an IdeaClaim).",
  claim: "Claim id.",
  evidence: "Evidence id.",
  source: "Source id.",
  argument: "Argument id.",
  relation: "Relation id.",
  initiative: "Initiative id.",
  handle: "Person handle.",
  topic: "Topic slug.",
  slug: "Topic slug.",
  kind: "Stance kind: important, worth_researching, plausible, doubtful, ready_now.",
  capacity: "Capacity: research, engineering, funding, entrepreneurship, policy, organizing, communication.",
};

const STEWARD_OR_MOD = "Stewards of the idea, or moderators.";
const OpenApiDocument = z.looseObject({ openapi: z.string() });

export const ENDPOINTS = {
  // ---------------------------------------------------------------- catalog
  apiIndex: {
    method: "GET",
    path: "/v1",
    tag: "Catalog",
    auth: "public",
    summary: "API index",
    description:
      "Name, version and the main entry points. `GET /` redirects here; the full description is `GET /v1/openapi.json`.",
    response: Res.ApiIndexResponse,
  },
  health: {
    method: "GET",
    path: "/v1/health",
    tag: "Catalog",
    auth: "public",
    summary: "Readiness check",
    description: "200 when the API can reach its database, 503 otherwise.",
    response: Res.HealthResponse,
    status: [200, 503],
  },
  openapi: {
    method: "GET",
    path: "/v1/openapi.json",
    tag: "Catalog",
    auth: "public",
    summary: "This API as an OpenAPI 3.1 document",
    response: OpenApiDocument,
  },
  vocabulary: {
    method: "GET",
    path: "/v1/vocabulary",
    tag: "Catalog",
    auth: "public",
    summary: "The product vocabulary",
    description:
      "Every vocabulary with labels, descriptions, rating scales and lens explanations. Render labels from here instead of hard-coding them.",
    response: Res.VocabularyResponse,
  },
  listTopics: {
    method: "GET",
    path: "/v1/topics",
    tag: "Catalog",
    auth: "public",
    summary: "List topics",
    response: z.array(Res.TopicDto),
  },
  createTopic: {
    method: "POST",
    path: "/v1/topics",
    tag: "Catalog",
    auth: "member",
    who: "Admins.",
    summary: "Create a topic",
    body: Req.CreateTopicRequest,
    response: Res.TopicDto,
    status: 201,
    errors: ["conflict: a topic with that slug exists"],
  },
  getTopic: {
    method: "GET",
    path: "/v1/topics/:slug",
    tag: "Catalog",
    auth: "public",
    summary: "Get a topic with its child topics",
    response: Res.TopicDetailDto,
  },
  search: {
    method: "GET",
    path: "/v1/search",
    tag: "Catalog",
    auth: "public",
    summary: "Search ideas, claims, sources and people",
    description: "Full-text search (English stemming). At most 25 results per kind.",
    query: Req.SearchQuery,
    response: Res.SearchResults,
  },
  activity: {
    method: "GET",
    path: "/v1/activity",
    tag: "Catalog",
    auth: "public",
    summary: "The global activity feed",
    description:
      "Newest first. `action=moderation.` returns the public moderation log. Activity about hidden ideas is omitted except moderation entries.",
    query: Req.ActivityQuery,
    response: Res.ActivityPage,
  },

  // ---------------------------------------------------------------- identity
  register: {
    method: "POST",
    path: "/v1/auth/register",
    tag: "Identity",
    auth: "public",
    summary: "Create an account",
    description: "Returns a session token and sets the `ip_session` cookie. Rate-limited per client address.",
    body: Req.RegisterRequest,
    response: Res.AuthResponse,
    status: 201,
    errors: ["conflict: email or handle already taken", "rate_limited: too many attempts"],
  },
  login: {
    method: "POST",
    path: "/v1/auth/login",
    tag: "Identity",
    auth: "public",
    summary: "Sign in",
    description: "Returns a session token and sets the `ip_session` cookie. Rate-limited per client address.",
    body: Req.LoginRequest,
    response: Res.AuthResponse,
    errors: ["unauthenticated: wrong email or password", "rate_limited: too many attempts"],
  },
  logout: {
    method: "POST",
    path: "/v1/auth/logout",
    tag: "Identity",
    auth: "public",
    summary: "Sign out (revokes the current session)",
    response: Res.OkResponse,
  },
  me: {
    method: "GET",
    path: "/v1/me",
    tag: "Identity",
    auth: "member",
    summary: "The signed-in account",
    response: Res.MeResponse,
  },
  updateMe: {
    method: "PATCH",
    path: "/v1/me",
    tag: "Identity",
    auth: "member",
    summary: "Update your profile",
    body: Req.UpdateProfileRequest,
    response: Res.PersonDto,
  },
  changePassword: {
    method: "POST",
    path: "/v1/me/password",
    tag: "Identity",
    auth: "member",
    summary: "Change your password",
    description: "Signs out every other session.",
    body: Req.ChangePasswordRequest,
    response: Res.OkResponse,
    errors: ["forbidden: the current password is not correct"],
  },
  declareExpertise: {
    method: "POST",
    path: "/v1/me/expertise",
    tag: "Identity",
    auth: "member",
    summary: "Declare expertise in a topic",
    description: "Recorded as a dated, self-declared fact. Returns your current expertise.",
    body: Req.DeclareExpertiseRequest,
    response: z.array(Res.ExpertiseDto),
    status: 201,
  },
  revokeExpertise: {
    method: "DELETE",
    path: "/v1/me/expertise/:topic",
    tag: "Identity",
    auth: "member",
    summary: "Withdraw declared expertise",
    response: z.array(Res.ExpertiseDto),
  },
  profile: {
    method: "GET",
    path: "/v1/people/:handle",
    tag: "Identity",
    auth: "public",
    summary: "A person's contribution profile",
    response: Res.ProfileDto,
  },
  personActivity: {
    method: "GET",
    path: "/v1/people/:handle/activity",
    tag: "Identity",
    auth: "public",
    summary: "A person's activity",
    query: Req.PageQuery,
    response: Res.ActivityPage,
  },
  deactivatePerson: {
    method: "POST",
    path: "/v1/people/:handle/deactivate",
    tag: "Identity",
    auth: "member",
    who: "Moderators (for members) and admins (for anyone).",
    summary: "Deactivate an account",
    description:
      "The person can no longer sign in or act; their sessions end; their contributions stay attributed. Logged publicly with the reason.",
    body: Req.PersonModerationRequest,
    response: Res.PersonDto,
    errors: ["conflict: already deactivated", "invariant_violated: you cannot moderate yourself"],
  },
  reactivatePerson: {
    method: "POST",
    path: "/v1/people/:handle/reactivate",
    tag: "Identity",
    auth: "member",
    who: "Moderators (for members) and admins (for anyone).",
    summary: "Reactivate an account",
    body: Req.PersonModerationRequest,
    response: Res.PersonDto,
    errors: ["conflict: already active"],
  },
  setRole: {
    method: "PUT",
    path: "/v1/people/:handle/role",
    tag: "Identity",
    auth: "member",
    who: "Admins (not on themselves).",
    summary: "Set a person's platform role",
    body: Req.SetRoleRequest,
    response: Res.PersonDto,
  },

  // ---------------------------------------------------------------- ideas
  listIdeas: {
    method: "GET",
    path: "/v1/ideas",
    tag: "Ideas",
    auth: "public",
    summary: "Discover ideas through a lens",
    description:
      "Each lens measures something different and says so (see `GET /v1/vocabulary` → lenses). Filters combine with any lens.",
    query: Req.ListIdeasQuery,
    response: Res.IdeaPage,
  },
  proposeIdea: {
    method: "POST",
    path: "/v1/ideas",
    tag: "Ideas",
    auth: "member",
    summary: "Propose an idea",
    description:
      "Records the idea, its first revision, the proposer as originator steward and the `imagined` stage. Only title, summary and one topic are required.",
    body: Req.ProposeIdeaRequest,
    response: Res.IdeaDetail,
    status: 201,
  },
  getIdea: {
    method: "GET",
    path: "/v1/ideas/:idea",
    tag: "Ideas",
    auth: "public",
    summary: "An idea in full",
    description:
      "Current narrative, stewards, derived signals, stage requirements and — when signed in — your own stances, ratings and involvements.",
    response: Res.IdeaDetail,
  },
  listRevisions: {
    method: "GET",
    path: "/v1/ideas/:idea/revisions",
    tag: "Ideas",
    auth: "public",
    summary: "The idea's revision history (newest first, without content)",
    query: Req.RevisionsQuery,
    response: z.array(Res.RevisionSummaryDto),
  },
  submitRevision: {
    method: "POST",
    path: "/v1/ideas/:idea/revisions",
    tag: "Ideas",
    auth: "member",
    summary: "Publish or propose a new version of the narrative",
    description:
      "Stewards publish directly (`intent: auto|publish`); everyone else proposes. Publishing requires `baseRevisionId` to be the current revision.",
    body: Req.SubmitRevisionRequest,
    response: Res.RevisionDto,
    status: 201,
    errors: [
      "conflict: the idea changed since you started editing (details.currentRevisionId)",
      "validation_failed: the revision changes nothing",
    ],
  },
  getRevision: {
    method: "GET",
    path: "/v1/ideas/:idea/revisions/:revision",
    tag: "Ideas",
    auth: "public",
    summary: "One revision with its full content",
    response: Res.RevisionDto,
  },
  decideRevision: {
    method: "POST",
    path: "/v1/ideas/:idea/revisions/:revision/decision",
    tag: "Ideas",
    auth: "member",
    who: STEWARD_OR_MOD,
    summary: "Accept or reject a proposed revision",
    body: Req.DecideRevisionRequest,
    response: Res.RevisionDto,
    errors: [
      "conflict: the proposal is based on an outdated revision",
      "invariant_violated: already decided",
    ],
  },
  withdrawRevision: {
    method: "POST",
    path: "/v1/ideas/:idea/revisions/:revision/withdraw",
    tag: "Ideas",
    auth: "member",
    who: "The proposal's author, or moderators.",
    summary: "Withdraw your pending proposal",
    response: Res.RevisionDto,
  },
  appointSteward: {
    method: "POST",
    path: "/v1/ideas/:idea/stewards",
    tag: "Ideas",
    auth: "member",
    who: STEWARD_OR_MOD,
    summary: "Appoint a co-steward",
    body: Req.AppointStewardRequest,
    response: z.array(Res.StewardDto),
    status: 201,
  },
  listStages: {
    method: "GET",
    path: "/v1/ideas/:idea/stages",
    tag: "Ideas",
    auth: "public",
    summary: "Lifecycle history (oldest first)",
    response: z.array(Res.StageTransitionDto),
  },
  transitionStage: {
    method: "POST",
    path: "/v1/ideas/:idea/stages",
    tag: "Ideas",
    auth: "member",
    who: STEWARD_OR_MOD,
    summary: "Record a lifecycle transition",
    description:
      "Needs a rationale (≥ 10 characters). `examined`, `tested`, `implemented` and `learned_from` need proof on record — see the idea's `stageRequirements`.",
    body: Req.StageTransitionRequest,
    response: Res.StageTransitionDto,
    status: 201,
    errors: ["invariant_violated: the requirement for the stage is not met (details.requirement)"],
  },
  timeline: {
    method: "GET",
    path: "/v1/ideas/:idea/timeline",
    tag: "Ideas",
    auth: "public",
    summary: "Everything that happened to the idea (newest first)",
    query: Req.PageQuery,
    response: Res.ActivityPage,
  },

  // ---------------------------------------------------------------- knowledge
  listIdeaClaims: {
    method: "GET",
    path: "/v1/ideas/:idea/claims",
    tag: "Knowledge",
    auth: "public",
    summary: "The idea's claims, with derived status and evidence counts",
    response: z.array(Res.IdeaClaimDto),
  },
  addClaim: {
    method: "POST",
    path: "/v1/ideas/:idea/claims",
    tag: "Knowledge",
    auth: "member",
    summary: "State a new claim, or link an existing one, in a role",
    body: Req.AddClaimRequest,
    response: Res.IdeaClaimDto,
    status: 201,
    errors: ["conflict: already linked in that role"],
  },
  unlinkClaim: {
    method: "POST",
    path: "/v1/ideas/:idea/claims/:link/unlink",
    tag: "Knowledge",
    auth: "member",
    who: "The person who linked it, stewards, or moderators.",
    summary: "Remove a claim from an idea (recorded, not deleted)",
    response: Res.OkResponse,
  },
  listIdeaArguments: {
    method: "GET",
    path: "/v1/ideas/:idea/arguments",
    tag: "Knowledge",
    auth: "public",
    summary: "Arguments that target the idea",
    response: z.array(Res.ArgumentDto),
  },
  getClaim: {
    method: "GET",
    path: "/v1/claims/:claim",
    tag: "Knowledge",
    auth: "public",
    summary: "A claim with every idea using it, its evidence and arguments",
    response: Res.ClaimDetailDto,
  },
  attachEvidence: {
    method: "POST",
    path: "/v1/claims/:claim/evidence",
    tag: "Knowledge",
    auth: "member",
    summary: "Attach evidence to a claim",
    body: Req.AttachEvidenceRequest,
    response: Res.EvidenceDto,
    status: 201,
    errors: ["conflict: this source is already attached to the claim"],
  },
  withdrawEvidence: {
    method: "POST",
    path: "/v1/evidence/:evidence/withdraw",
    tag: "Knowledge",
    auth: "member",
    who: "The contributor, or moderators.",
    summary: "Withdraw evidence (stays on record with the reason)",
    body: Req.WithdrawRequest,
    response: Res.EvidenceDto,
  },
  registerSource: {
    method: "POST",
    path: "/v1/sources",
    tag: "Knowledge",
    auth: "member",
    summary: "Register a source, or get the existing one with the same DOI/URL",
    description: "201 when created, 200 when an existing source matched.",
    body: Req.SourceInput,
    response: Res.SourceDto,
    status: [201, 200],
  },
  getSource: {
    method: "GET",
    path: "/v1/sources/:source",
    tag: "Knowledge",
    auth: "public",
    summary: "A source and how often it is cited",
    response: Res.SourceDetailDto,
  },
  createArgument: {
    method: "POST",
    path: "/v1/arguments",
    tag: "Knowledge",
    auth: "member",
    summary: "Argue for, against, or with caveats about an idea, a claim or another argument",
    body: Req.CreateArgumentRequest,
    response: Res.ArgumentDto,
    status: 201,
  },
  getArgument: {
    method: "GET",
    path: "/v1/arguments/:argument",
    tag: "Knowledge",
    auth: "public",
    summary: "An argument with its replies",
    response: Res.ArgumentDetailDto,
  },
  withdrawArgument: {
    method: "POST",
    path: "/v1/arguments/:argument/withdraw",
    tag: "Knowledge",
    auth: "member",
    who: "The author, or moderators.",
    summary: "Withdraw an argument",
    response: Res.ArgumentDto,
  },

  // ---------------------------------------------------------------- signals
  listEvaluations: {
    method: "GET",
    path: "/v1/evaluations",
    tag: "Signals",
    auth: "public",
    summary: "Raw evaluations of one target",
    description: "`history=all` includes superseded ratings, so changes of opinion can be studied.",
    query: Req.EvaluationsQuery,
    response: Res.EvaluationPage,
  },
  submitEvaluation: {
    method: "POST",
    path: "/v1/evaluations",
    tag: "Signals",
    auth: "member",
    summary: "Rate a target on one or more dimensions",
    description:
      "Omit a dimension to say 'I don't know'. Re-rating supersedes your previous rating; repeating it is a no-op.",
    body: Req.SubmitEvaluationRequest,
    response: Res.SubmitEvaluationResponse,
    errors: ["invariant_violated: you cannot mark your own contribution as useful"],
  },
  withdrawEvaluation: {
    method: "POST",
    path: "/v1/evaluations/withdraw",
    tag: "Signals",
    auth: "member",
    summary: "Withdraw your ratings on some dimensions",
    body: Req.WithdrawEvaluationRequest,
    response: Res.WithdrawEvaluationResponse,
  },
  takeStance: {
    method: "PUT",
    path: "/v1/ideas/:idea/stances/:kind",
    tag: "Signals",
    auth: "member",
    summary: "Take a stance on an idea (idempotent)",
    description: "`plausible` and `doubtful` exclude each other. Returns your current stances.",
    response: Res.StancesResponse,
  },
  retractStance: {
    method: "DELETE",
    path: "/v1/ideas/:idea/stances/:kind",
    tag: "Signals",
    auth: "member",
    summary: "Retract a stance (idempotent)",
    response: Res.StancesResponse,
  },
  listInvolvements: {
    method: "GET",
    path: "/v1/ideas/:idea/involvements",
    tag: "Signals",
    auth: "public",
    summary: "Who offers or is working on the idea, in which capacity",
    response: z.array(Res.InvolvementDto),
  },
  declareInvolvement: {
    method: "PUT",
    path: "/v1/ideas/:idea/involvements/:capacity",
    tag: "Signals",
    auth: "member",
    summary: "Declare your involvement in one capacity (idempotent)",
    body: Req.DeclareInvolvementRequest,
    response: z.array(Res.InvolvementDto),
  },
  withdrawInvolvement: {
    method: "DELETE",
    path: "/v1/ideas/:idea/involvements/:capacity",
    tag: "Signals",
    auth: "member",
    summary: "Withdraw your involvement in one capacity",
    response: z.array(Res.InvolvementDto),
  },

  // ---------------------------------------------------------------- graph
  listIdeaRelations: {
    method: "GET",
    path: "/v1/ideas/:idea/relations",
    tag: "Graph",
    auth: "public",
    summary: "The idea's typed relations, phrased from its point of view",
    response: z.array(Res.IdeaRelationView),
  },
  graph: {
    method: "GET",
    path: "/v1/ideas/:idea/graph",
    tag: "Graph",
    auth: "public",
    summary: "Traverse the idea graph",
    description:
      "`downstream`: what realising this idea would unlock. `upstream`: what must exist first. `both`: the whole neighbourhood.",
    query: Req.GraphQuery,
    response: Res.GraphDto,
  },
  proposeRelation: {
    method: "POST",
    path: "/v1/relations",
    tag: "Graph",
    auth: "member",
    summary: "Relate two ideas",
    body: Req.ProposeRelationRequest,
    response: Res.RelationDto,
    status: 201,
    errors: ["conflict: the relation already exists", "invariant_violated: an idea cannot relate to itself"],
  },
  retractRelation: {
    method: "POST",
    path: "/v1/relations/:relation/retract",
    tag: "Graph",
    auth: "member",
    who: "The proposer, stewards of either idea, or moderators.",
    summary: "Retract a relation",
    response: Res.OkResponse,
  },

  // ---------------------------------------------------------------- practice
  listInitiatives: {
    method: "GET",
    path: "/v1/ideas/:idea/initiatives",
    tag: "Practice",
    auth: "public",
    summary: "Real-world action taken on the idea, with outcomes",
    response: z.array(Res.InitiativeDto),
  },
  createInitiative: {
    method: "POST",
    path: "/v1/ideas/:idea/initiatives",
    tag: "Practice",
    auth: "member",
    summary: "Record an initiative (it may be historical and already completed)",
    body: Req.CreateInitiativeRequest,
    response: Res.InitiativeDto,
    status: 201,
  },
  getInitiative: {
    method: "GET",
    path: "/v1/initiatives/:initiative",
    tag: "Practice",
    auth: "public",
    summary: "An initiative with its outcomes",
    response: Res.InitiativeDto,
  },
  updateInitiativeStatus: {
    method: "POST",
    path: "/v1/initiatives/:initiative/status",
    tag: "Practice",
    auth: "member",
    who: "The initiative's creator, stewards of the idea, or moderators.",
    summary: "Move an initiative forward (planned → active → completed | discontinued)",
    body: Req.UpdateInitiativeStatusRequest,
    response: Res.InitiativeDto,
    errors: ["invariant_violated: that status change is not allowed"],
  },
  recordOutcome: {
    method: "POST",
    path: "/v1/initiatives/:initiative/outcomes",
    tag: "Practice",
    auth: "member",
    who: "The initiative's creator, stewards of the idea, or moderators.",
    summary: "Record what an initiative produced — including failures",
    body: Req.RecordOutcomeRequest,
    response: Res.InitiativeDto,
    status: 201,
    errors: ["invariant_violated: a planned initiative has no outcome yet"],
  },

  // ---------------------------------------------------------------- discussion & moderation
  listComments: {
    method: "GET",
    path: "/v1/ideas/:idea/comments",
    tag: "Discussion",
    auth: "public",
    summary: "The idea's discussion (oldest first)",
    query: Req.PageQuery,
    response: Res.CommentPage,
  },
  postComment: {
    method: "POST",
    path: "/v1/ideas/:idea/comments",
    tag: "Discussion",
    auth: "member",
    summary: "Comment, ask or suggest — optionally replying or anchored to a claim, evidence or argument",
    body: Req.PostCommentRequest,
    response: Res.CommentDto,
    status: 201,
  },
  moderate: {
    method: "POST",
    path: "/v1/moderation",
    tag: "Discussion",
    auth: "member",
    who: "Moderators.",
    summary: "Hide or restore content",
    description: "Content is never deleted. The action and reason are published in the moderation log.",
    body: Req.ModerationRequest,
    response: Res.ModerationResponse,
    errors: ["conflict: already in that state"],
  },
} as const satisfies Record<string, EndpointSpec>;

export type EndpointName = keyof typeof ENDPOINTS;

/** Finds the catalogued endpoint for a concrete request (path without query string, including /v1). */
export function matchEndpoint(method: string, path: string): [EndpointName, EndpointSpec] | null {
  for (const [name, spec] of Object.entries(ENDPOINTS) as [EndpointName, EndpointSpec][]) {
    if (spec.method !== method.toUpperCase()) continue;
    const pattern = new RegExp(`^${spec.path.replace(/[.]/g, "\\.").replace(/:[A-Za-z]+/g, "[^/]+")}$`);
    if (pattern.test(path)) return [name, spec];
  }
  return null;
}
