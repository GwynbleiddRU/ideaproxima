# API reference

<!-- Generated from packages/contracts by `npm run docs:api`. Do not edit by hand. -->

Every endpoint, request and response of the Ideaproxima API, generated from the same schemas the server
validates against and the test suite checks every response with. The machine-readable form is
[`api/openapi.json`](api/openapi.json) (also served live at `GET /v1/openapi.json`). Conventions —
authentication, errors, pagination, idempotency — are explained in the [developer guide](developer-guide.md#api-conventions).

**68 endpoints.** Access “signed in” means a session (Bearer token or `ip_session` cookie) is required; further restrictions are listed per endpoint.

## Contents

- [Catalog](#catalog) — Vocabulary, topics, search, the activity feed and service metadata.
  - `GET /v1` — API index (`apiIndex`)
  - `GET /v1/health` — Readiness check (`health`)
  - `GET /v1/openapi.json` — This API as an OpenAPI 3.1 document (`openapi`)
  - `GET /v1/locales` — List supported product languages (`locales`)
  - `GET /v1/vocabulary` — The product vocabulary (`vocabulary`)
  - `GET /v1/topics` — List topics (`listTopics`)
  - `POST /v1/topics` — Create a topic (`createTopic`)
  - `GET /v1/topics/:slug` — Get a topic with its child topics (`getTopic`)
  - `PUT /v1/topics/:slug/translations/:locale` — Add or replace a topic translation (`putTopicTranslation`)
  - `GET /v1/search` — Search ideas, claims, sources and people (`search`)
  - `GET /v1/activity` — The global activity feed (`activity`)
- [Identity](#identity) — Accounts, sessions, profiles, expertise and account moderation.
  - `POST /v1/auth/register` — Create an account (`register`)
  - `POST /v1/auth/login` — Sign in (`login`)
  - `POST /v1/auth/logout` — Sign out (revokes the current session) (`logout`)
  - `GET /v1/me` — The signed-in account (`me`)
  - `PATCH /v1/me` — Update your profile or saved language (`updateMe`)
  - `POST /v1/me/password` — Change your password (`changePassword`)
  - `POST /v1/me/expertise` — Declare expertise in a topic (`declareExpertise`)
  - `DELETE /v1/me/expertise/:topic` — Withdraw declared expertise (`revokeExpertise`)
  - `GET /v1/people/:handle` — A person's contribution profile (`profile`)
  - `GET /v1/people/:handle/activity` — A person's activity (`personActivity`)
  - `POST /v1/people/:handle/deactivate` — Deactivate an account (`deactivatePerson`)
  - `POST /v1/people/:handle/reactivate` — Reactivate an account (`reactivatePerson`)
  - `PUT /v1/people/:handle/role` — Set a person's platform role (`setRole`)
- [Ideas](#ideas) — Ideas, their narrative revisions, stewardship and lifecycle.
  - `GET /v1/ideas` — Discover ideas through a lens (`listIdeas`)
  - `POST /v1/ideas` — Propose an idea (`proposeIdea`)
  - `GET /v1/ideas/:idea` — An idea in full (`getIdea`)
  - `GET /v1/ideas/:idea/revisions` — The idea's revision history (newest first, without content) (`listRevisions`)
  - `POST /v1/ideas/:idea/revisions` — Publish or propose a new version of the narrative (`submitRevision`)
  - `GET /v1/ideas/:idea/revisions/:revision` — One revision with its full content (`getRevision`)
  - `POST /v1/ideas/:idea/revisions/:revision/decision` — Accept or reject a proposed revision (`decideRevision`)
  - `POST /v1/ideas/:idea/revisions/:revision/withdraw` — Withdraw your pending proposal (`withdrawRevision`)
  - `POST /v1/ideas/:idea/stewards` — Appoint a co-steward (`appointSteward`)
  - `GET /v1/ideas/:idea/stages` — Lifecycle history (oldest first) (`listStages`)
  - `POST /v1/ideas/:idea/stages` — Record a lifecycle transition (`transitionStage`)
  - `GET /v1/ideas/:idea/timeline` — Everything that happened to the idea (newest first) (`timeline`)
- [Knowledge](#knowledge) — Claims, sources, evidence and arguments — the epistemic structure of ideas.
  - `GET /v1/ideas/:idea/claims` — The idea's claims, with derived status and evidence counts (`listIdeaClaims`)
  - `POST /v1/ideas/:idea/claims` — State a new claim, or link an existing one, in a role (`addClaim`)
  - `POST /v1/ideas/:idea/claims/:link/unlink` — Remove a claim from an idea (recorded, not deleted) (`unlinkClaim`)
  - `GET /v1/ideas/:idea/arguments` — Arguments that target the idea (`listIdeaArguments`)
  - `GET /v1/claims/:claim` — A claim with every idea using it, its evidence and arguments (`getClaim`)
  - `POST /v1/claims/:claim/evidence` — Attach evidence to a claim (`attachEvidence`)
  - `POST /v1/evidence/:evidence/withdraw` — Withdraw evidence (stays on record with the reason) (`withdrawEvidence`)
  - `POST /v1/sources` — Register a source, or get the existing one with the same DOI/URL (`registerSource`)
  - `GET /v1/sources/:source` — A source and how often it is cited (`getSource`)
  - `POST /v1/arguments` — Argue for, against, or with caveats about an idea, a claim or another argument (`createArgument`)
  - `GET /v1/arguments/:argument` — An argument with its replies (`getArgument`)
  - `POST /v1/arguments/:argument/withdraw` — Withdraw an argument (`withdrawArgument`)
- [Signals](#signals) — Evaluations, stances and involvements — what people assess, care about and commit to.
  - `GET /v1/evaluations` — Raw evaluations of one target (`listEvaluations`)
  - `POST /v1/evaluations` — Rate a target on one or more dimensions (`submitEvaluation`)
  - `POST /v1/evaluations/withdraw` — Withdraw your ratings on some dimensions (`withdrawEvaluation`)
  - `PUT /v1/ideas/:idea/stances/:kind` — Take a stance on an idea (idempotent) (`takeStance`)
  - `DELETE /v1/ideas/:idea/stances/:kind` — Retract a stance (idempotent) (`retractStance`)
  - `GET /v1/ideas/:idea/involvements` — Who offers or is working on the idea, in which capacity (`listInvolvements`)
  - `PUT /v1/ideas/:idea/involvements/:capacity` — Declare your involvement in one capacity (idempotent) (`declareInvolvement`)
  - `DELETE /v1/ideas/:idea/involvements/:capacity` — Withdraw your involvement in one capacity (`withdrawInvolvement`)
- [Graph](#graph) — Typed relations between ideas and graph traversal.
  - `GET /v1/ideas/:idea/relations` — The idea's typed relations, phrased from its point of view (`listIdeaRelations`)
  - `GET /v1/ideas/:idea/graph` — Traverse the idea graph (`graph`)
  - `POST /v1/relations` — Relate two ideas (`proposeRelation`)
  - `POST /v1/relations/:relation/retract` — Retract a relation (`retractRelation`)
- [Practice](#practice) — Initiatives (real-world action) and their outcomes.
  - `GET /v1/ideas/:idea/initiatives` — Real-world action taken on the idea, with outcomes (`listInitiatives`)
  - `POST /v1/ideas/:idea/initiatives` — Record an initiative (it may be historical and already completed) (`createInitiative`)
  - `GET /v1/initiatives/:initiative` — An initiative with its outcomes (`getInitiative`)
  - `POST /v1/initiatives/:initiative/status` — Move an initiative forward (planned → active → completed | discontinued) (`updateInitiativeStatus`)
  - `POST /v1/initiatives/:initiative/outcomes` — Record what an initiative produced — including failures (`recordOutcome`)
- [Discussion](#discussion) — Comments and moderation.
  - `GET /v1/ideas/:idea/comments` — The idea's discussion (oldest first) (`listComments`)
  - `POST /v1/ideas/:idea/comments` — Comment, ask or suggest — optionally replying or anchored to a claim, evidence or argument (`postComment`)
  - `POST /v1/moderation` — Hide or restore content (`moderate`)
- [Schemas](#schemas)

## Catalog

Vocabulary, topics, search, the activity feed and service metadata.

### `GET /v1`

**API index** · `apiIndex`

**Access:** public

Name, version and the main entry points. `GET /` redirects here; the full description is `GET /v1/openapi.json`.

Response `200`: [`ApiIndex`](#schema-apiindex)

### `GET /v1/health`

**Readiness check** · `health`

**Access:** public

200 when the API can reach its database, 503 otherwise.

Response `200`: [`Health`](#schema-health)

Response `503`: [`Error`](#schema-error)

### `GET /v1/openapi.json`

**This API as an OpenAPI 3.1 document** · `openapi`

**Access:** public

Response `200`: object

### `GET /v1/locales`

**List supported product languages** · `locales`

**Access:** public

Response `200`: [`Locale`](#schema-locale)[]

### `GET /v1/vocabulary`

**The product vocabulary** · `vocabulary`

**Access:** public

Every vocabulary with labels, descriptions, rating scales and lens explanations. Render labels from here instead of hard-coding them.

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `locale` | string | no | Preferred language tag. Unsupported tags fall through to request negotiation. |

Response `200`: [`Vocabulary`](#schema-vocabulary)

### `GET /v1/topics`

**List topics** · `listTopics`

**Access:** public

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `locale` | string | no | Preferred language tag. Unsupported tags fall through to request negotiation. |

Response `200`: [`Topic`](#schema-topic)[]

### `POST /v1/topics`

**Create a topic** · `createTopic`

**Access:** signed in — Admins.

Request body: [`CreateTopicRequest`](#schema-createtopicrequest)

Response `201`: [`Topic`](#schema-topic)

Notable errors:

- `conflict` — a topic with that slug exists

### `GET /v1/topics/:slug`

**Get a topic with its child topics** · `getTopic`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `slug` | Topic slug. |

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `locale` | string | no | Preferred language tag. Unsupported tags fall through to request negotiation. |

Response `200`: [`TopicDetail`](#schema-topicdetail)

### `PUT /v1/topics/:slug/translations/:locale`

**Add or replace a topic translation** · `putTopicTranslation`

**Access:** signed in — Admins.

Path parameters:

| Name | Description |
| --- | --- |
| `slug` | Topic slug. |
| `locale` | Supported locale tag from GET /v1/locales. |

Request body: [`TopicTranslationRequest`](#schema-topictranslationrequest)

Response `200`: [`TopicTranslation`](#schema-topictranslation)

### `GET /v1/search`

**Search ideas, claims, sources and people** · `search`

**Access:** public

Full-text search (English stemming). At most 25 results per kind.

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | 1–100; default `20` |
| `cursor` | string | no | length 0–500 |
| `q` | string | yes | length 1–200 |

Response `200`: [`SearchResults`](#schema-searchresults)

### `GET /v1/activity`

**The global activity feed** · `activity`

**Access:** public

Newest first. `action=moderation.` returns the public moderation log. For public readers, activity about hidden ideas is omitted and other hidden subjects have an empty payload and subject.hidden=true. Moderation entries stay public.

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | 1–100; default `20` |
| `cursor` | string | no | length 0–500 |
| `action` | string | no | length 0–60 |

Response `200`: [`ActivityPage`](#schema-activitypage)

## Identity

Accounts, sessions, profiles, expertise and account moderation.

### `POST /v1/auth/register`

**Create an account** · `register`

**Access:** public

Returns a session token and sets the `ip_session` cookie. Rate-limited per client address.

Request body: [`RegisterRequest`](#schema-registerrequest)

Response `201`: [`Auth`](#schema-auth)

Notable errors:

- `conflict` — email or handle already taken
- `rate_limited` — too many attempts
- `unavailable` — password service busy

### `POST /v1/auth/login`

**Sign in** · `login`

**Access:** public

Returns a session token and sets the `ip_session` cookie. Rate-limited per client address.

Request body: [`LoginRequest`](#schema-loginrequest)

Response `200`: [`Auth`](#schema-auth)

Notable errors:

- `unauthenticated` — wrong email or password
- `rate_limited` — too many attempts
- `unavailable` — password service busy

### `POST /v1/auth/logout`

**Sign out (revokes the current session)** · `logout`

**Access:** public

Response `200`: [`Ok`](#schema-ok)

### `GET /v1/me`

**The signed-in account** · `me`

**Access:** signed in

Response `200`: [`Me`](#schema-me)

### `PATCH /v1/me`

**Update your profile or saved language** · `updateMe`

**Access:** signed in

Request body: [`UpdateProfileRequest`](#schema-updateprofilerequest)

Response `200`: [`Person`](#schema-person)

### `POST /v1/me/password`

**Change your password** · `changePassword`

**Access:** signed in

Signs out every other session.

Request body: [`ChangePasswordRequest`](#schema-changepasswordrequest)

Response `200`: [`Ok`](#schema-ok)

Notable errors:

- `forbidden` — the current password is not correct
- `unavailable` — password service busy

### `POST /v1/me/expertise`

**Declare expertise in a topic** · `declareExpertise`

**Access:** signed in

Recorded as a dated, self-declared fact. Returns your current expertise.

Request body: [`DeclareExpertiseRequest`](#schema-declareexpertiserequest)

Response `201`: [`Expertise`](#schema-expertise)[]

### `DELETE /v1/me/expertise/:topic`

**Withdraw declared expertise** · `revokeExpertise`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `topic` | Topic slug. |

Response `200`: [`Expertise`](#schema-expertise)[]

### `GET /v1/people/:handle`

**A person's contribution profile** · `profile`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `handle` | Person handle. |

Response `200`: [`Profile`](#schema-profile)

### `GET /v1/people/:handle/activity`

**A person's activity** · `personActivity`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `handle` | Person handle. |

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | 1–100; default `20` |
| `cursor` | string | no | length 0–500 |

Response `200`: [`ActivityPage`](#schema-activitypage)

### `POST /v1/people/:handle/deactivate`

**Deactivate an account** · `deactivatePerson`

**Access:** signed in — Moderators (for members) and admins (for anyone).

The person can no longer sign in or act; their sessions end; their contributions stay attributed. Logged publicly with the reason.

Path parameters:

| Name | Description |
| --- | --- |
| `handle` | Person handle. |

Request body: [`PersonModerationRequest`](#schema-personmoderationrequest)

Response `200`: [`Person`](#schema-person)

Notable errors:

- `conflict` — already deactivated
- `invariant_violated` — you cannot moderate yourself

### `POST /v1/people/:handle/reactivate`

**Reactivate an account** · `reactivatePerson`

**Access:** signed in — Moderators (for members) and admins (for anyone).

Path parameters:

| Name | Description |
| --- | --- |
| `handle` | Person handle. |

Request body: [`PersonModerationRequest`](#schema-personmoderationrequest)

Response `200`: [`Person`](#schema-person)

Notable errors:

- `conflict` — already active

### `PUT /v1/people/:handle/role`

**Set a person's platform role** · `setRole`

**Access:** signed in — Admins (not on themselves).

Path parameters:

| Name | Description |
| --- | --- |
| `handle` | Person handle. |

Request body: [`SetRoleRequest`](#schema-setrolerequest)

Response `200`: [`Person`](#schema-person)

## Ideas

Ideas, their narrative revisions, stewardship and lifecycle.

### `GET /v1/ideas`

**Discover ideas through a lens** · `listIdeas`

**Access:** public

Each lens measures something different and says so (see `GET /v1/vocabulary` → lenses). Filters combine with any lens.

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | 1–100; default `20` |
| `cursor` | string | no | length 0–500 |
| `lens` | `newest` \| `attention` \| `emerging` \| `evidence` \| `potential` \| `feasible` \| `developed` \| `neglected` \| `contested` \| `needs_review` \| `in_practice` | no | default `"newest"` |
| `topic` | string | no | length 0–80 |
| `stage` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | no |  |
| `tag` | string | no | length 0–40 |
| `q` | string | no | length 0–200 |

Response `200`: [`IdeaPage`](#schema-ideapage)

### `POST /v1/ideas`

**Propose an idea** · `proposeIdea`

**Access:** signed in

Records the idea, its first revision, the proposer as originator steward and the `imagined` stage. Only title, summary and one topic are required.

Request body: [`ProposeIdeaRequest`](#schema-proposeidearequest)

Response `201`: [`IdeaDetail`](#schema-ideadetail)

### `GET /v1/ideas/:idea`

**An idea in full** · `getIdea`

**Access:** public

Current narrative, stewards, derived signals, stage requirements and — when signed in — your own stances, ratings and involvements.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Response `200`: [`IdeaDetail`](#schema-ideadetail)

### `GET /v1/ideas/:idea/revisions`

**The idea's revision history (newest first, without content)** · `listRevisions`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `proposed` \| `accepted` \| `rejected` \| `withdrawn` | no |  |

Response `200`: [`RevisionSummary`](#schema-revisionsummary)[]

### `POST /v1/ideas/:idea/revisions`

**Publish or propose a new version of the narrative** · `submitRevision`

**Access:** signed in

Stewards publish directly (`intent: auto|publish`); everyone else proposes. Publishing requires `baseRevisionId` to be the current revision.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Request body: [`SubmitRevisionRequest`](#schema-submitrevisionrequest)

Response `201`: [`Revision`](#schema-revision)

Notable errors:

- `conflict` — the idea changed since you started editing (details.currentRevisionId)
- `validation_failed` — the revision changes nothing

### `GET /v1/ideas/:idea/revisions/:revision`

**One revision with its full content** · `getRevision`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `revision` | Revision id. |

Response `200`: [`Revision`](#schema-revision)

### `POST /v1/ideas/:idea/revisions/:revision/decision`

**Accept or reject a proposed revision** · `decideRevision`

**Access:** signed in — Stewards of the idea, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `revision` | Revision id. |

Request body: [`DecideRevisionRequest`](#schema-deciderevisionrequest)

Response `200`: [`Revision`](#schema-revision)

Notable errors:

- `conflict` — the proposal is based on an outdated revision
- `invariant_violated` — already decided

### `POST /v1/ideas/:idea/revisions/:revision/withdraw`

**Withdraw your pending proposal** · `withdrawRevision`

**Access:** signed in — The proposal's author, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `revision` | Revision id. |

Response `200`: [`Revision`](#schema-revision)

### `POST /v1/ideas/:idea/stewards`

**Appoint a co-steward** · `appointSteward`

**Access:** signed in — Stewards of the idea, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Request body: [`AppointStewardRequest`](#schema-appointstewardrequest)

Response `201`: [`Steward`](#schema-steward)[]

### `GET /v1/ideas/:idea/stages`

**Lifecycle history (oldest first)** · `listStages`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Response `200`: [`StageTransition`](#schema-stagetransition)[]

### `POST /v1/ideas/:idea/stages`

**Record a lifecycle transition** · `transitionStage`

**Access:** signed in — Stewards of the idea, or moderators.

Needs a rationale (≥ 10 characters). `examined`, `tested`, `implemented` and `learned_from` need proof on record — see the idea's `stageRequirements`.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Request body: [`StageTransitionRequest`](#schema-stagetransitionrequest)

Response `201`: [`StageTransition`](#schema-stagetransition)

Notable errors:

- `invariant_violated` — the requirement for the stage is not met (details.requirement)

### `GET /v1/ideas/:idea/timeline`

**Everything that happened to the idea (newest first)** · `timeline`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | 1–100; default `20` |
| `cursor` | string | no | length 0–500 |

Response `200`: [`ActivityPage`](#schema-activitypage)

## Knowledge

Claims, sources, evidence and arguments — the epistemic structure of ideas.

### `GET /v1/ideas/:idea/claims`

**The idea's claims, with derived status and evidence counts** · `listIdeaClaims`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Response `200`: [`IdeaClaim`](#schema-ideaclaim)[]

### `POST /v1/ideas/:idea/claims`

**State a new claim, or link an existing one, in a role** · `addClaim`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Request body: [`AddClaimRequest`](#schema-addclaimrequest)

Response `201`: [`IdeaClaim`](#schema-ideaclaim)

Notable errors:

- `conflict` — already linked in that role

### `POST /v1/ideas/:idea/claims/:link/unlink`

**Remove a claim from an idea (recorded, not deleted)** · `unlinkClaim`

**Access:** signed in — The person who linked it, stewards, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `link` | Claim link id (`linkId` of an IdeaClaim). |

Response `200`: [`Ok`](#schema-ok)

### `GET /v1/ideas/:idea/arguments`

**Arguments that target the idea** · `listIdeaArguments`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Response `200`: [`Argument`](#schema-argument)[]

### `GET /v1/claims/:claim`

**A claim with every idea using it, its evidence and arguments** · `getClaim`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `claim` | Claim id. |

Response `200`: [`ClaimDetail`](#schema-claimdetail)

### `POST /v1/claims/:claim/evidence`

**Attach evidence to a claim** · `attachEvidence`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `claim` | Claim id. |

Request body: [`AttachEvidenceRequest`](#schema-attachevidencerequest)

Response `201`: [`Evidence`](#schema-evidence)

Notable errors:

- `conflict` — this source is already attached to the claim

### `POST /v1/evidence/:evidence/withdraw`

**Withdraw evidence (stays on record with the reason)** · `withdrawEvidence`

**Access:** signed in — The contributor, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `evidence` | Evidence id. |

Request body: [`WithdrawRequest`](#schema-withdrawrequest)

Response `200`: [`Evidence`](#schema-evidence)

### `POST /v1/sources`

**Register a source, or get the existing one with the same DOI/URL** · `registerSource`

**Access:** signed in

201 when created, 200 when an existing source matched.

Request body: [`SourceInput`](#schema-sourceinput)

Response `201`: [`Source`](#schema-source)

Response `200`: [`Source`](#schema-source)

### `GET /v1/sources/:source`

**A source and how often it is cited** · `getSource`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `source` | Source id. |

Response `200`: [`SourceDetail`](#schema-sourcedetail)

### `POST /v1/arguments`

**Argue for, against, or with caveats about an idea, a claim or another argument** · `createArgument`

**Access:** signed in

Request body: [`CreateArgumentRequest`](#schema-createargumentrequest)

Response `201`: [`Argument`](#schema-argument)

### `GET /v1/arguments/:argument`

**An argument with its replies** · `getArgument`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `argument` | Argument id. |

Response `200`: [`ArgumentDetail`](#schema-argumentdetail)

### `POST /v1/arguments/:argument/withdraw`

**Withdraw an argument** · `withdrawArgument`

**Access:** signed in — The author, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `argument` | Argument id. |

Response `200`: [`Argument`](#schema-argument)

## Signals

Evaluations, stances and involvements — what people assess, care about and commit to.

### `GET /v1/evaluations`

**Raw evaluations of one target** · `listEvaluations`

**Access:** public

`history=all` includes superseded ratings, so changes of opinion can be studied.

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | 1–100; default `20` |
| `cursor` | string | no | length 0–500 |
| `targetKind` | `idea` \| `claim` \| `evidence` \| `argument` \| `relation` \| `comment` | yes |  |
| `targetId` | string (uuid) | yes |  |
| `history` | `current` \| `all` | no | default `"current"` |

Response `200`: [`EvaluationPage`](#schema-evaluationpage)

### `POST /v1/evaluations`

**Rate a target on one or more dimensions** · `submitEvaluation`

**Access:** signed in

Omit a dimension to say 'I don't know'. Re-rating supersedes your previous rating; repeating it is a no-op.

Request body: [`SubmitEvaluationRequest`](#schema-submitevaluationrequest)

Response `200`: [`SubmitEvaluationResult`](#schema-submitevaluationresult)

Notable errors:

- `invariant_violated` — you cannot mark your own contribution as useful

### `POST /v1/evaluations/withdraw`

**Withdraw your ratings on some dimensions** · `withdrawEvaluation`

**Access:** signed in

Request body: [`WithdrawEvaluationRequest`](#schema-withdrawevaluationrequest)

Response `200`: [`WithdrawEvaluationResult`](#schema-withdrawevaluationresult)

### `PUT /v1/ideas/:idea/stances/:kind`

**Take a stance on an idea (idempotent)** · `takeStance`

**Access:** signed in

`plausible` and `doubtful` exclude each other. Returns your current stances.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `kind` | Stance kind: important, worth_researching, plausible, doubtful, ready_now. |

Response `200`: [`Stances`](#schema-stances)

### `DELETE /v1/ideas/:idea/stances/:kind`

**Retract a stance (idempotent)** · `retractStance`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `kind` | Stance kind: important, worth_researching, plausible, doubtful, ready_now. |

Response `200`: [`Stances`](#schema-stances)

### `GET /v1/ideas/:idea/involvements`

**Who offers or is working on the idea, in which capacity** · `listInvolvements`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Response `200`: [`Involvement`](#schema-involvement)[]

### `PUT /v1/ideas/:idea/involvements/:capacity`

**Declare your involvement in one capacity (idempotent)** · `declareInvolvement`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `capacity` | Capacity: research, engineering, funding, entrepreneurship, policy, organizing, communication. |

Request body: [`DeclareInvolvementRequest`](#schema-declareinvolvementrequest)

Response `200`: [`Involvement`](#schema-involvement)[]

### `DELETE /v1/ideas/:idea/involvements/:capacity`

**Withdraw your involvement in one capacity** · `withdrawInvolvement`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |
| `capacity` | Capacity: research, engineering, funding, entrepreneurship, policy, organizing, communication. |

Response `200`: [`Involvement`](#schema-involvement)[]

## Graph

Typed relations between ideas and graph traversal.

### `GET /v1/ideas/:idea/relations`

**The idea's typed relations, phrased from its point of view** · `listIdeaRelations`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Response `200`: [`IdeaRelation`](#schema-idearelation)[]

### `GET /v1/ideas/:idea/graph`

**Traverse the idea graph** · `graph`

**Access:** public

`downstream`: what realising this idea would unlock. `upstream`: what must exist first. `both`: the whole neighbourhood.

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `direction` | `upstream` \| `downstream` \| `both` | no | default `"both"` |
| `depth` | integer | no | 1–4; default `2` |

Response `200`: [`Graph`](#schema-graph)

### `POST /v1/relations`

**Relate two ideas** · `proposeRelation`

**Access:** signed in

Request body: [`ProposeRelationRequest`](#schema-proposerelationrequest)

Response `201`: [`Relation`](#schema-relation)

Notable errors:

- `conflict` — the relation already exists
- `invariant_violated` — an idea cannot relate to itself

### `POST /v1/relations/:relation/retract`

**Retract a relation** · `retractRelation`

**Access:** signed in — The proposer, stewards of either idea, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `relation` | Relation id. |

Response `200`: [`Ok`](#schema-ok)

## Practice

Initiatives (real-world action) and their outcomes.

### `GET /v1/ideas/:idea/initiatives`

**Real-world action taken on the idea, with outcomes** · `listInitiatives`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Response `200`: [`Initiative`](#schema-initiative)[]

### `POST /v1/ideas/:idea/initiatives`

**Record an initiative (it may be historical and already completed)** · `createInitiative`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Request body: [`CreateInitiativeRequest`](#schema-createinitiativerequest)

Response `201`: [`Initiative`](#schema-initiative)

### `GET /v1/initiatives/:initiative`

**An initiative with its outcomes** · `getInitiative`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `initiative` | Initiative id. |

Response `200`: [`Initiative`](#schema-initiative)

### `POST /v1/initiatives/:initiative/status`

**Move an initiative forward (planned → active → completed | discontinued)** · `updateInitiativeStatus`

**Access:** signed in — The initiative's creator, stewards of the idea, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `initiative` | Initiative id. |

Request body: [`UpdateInitiativeStatusRequest`](#schema-updateinitiativestatusrequest)

Response `200`: [`Initiative`](#schema-initiative)

Notable errors:

- `invariant_violated` — that status change is not allowed

### `POST /v1/initiatives/:initiative/outcomes`

**Record what an initiative produced — including failures** · `recordOutcome`

**Access:** signed in — The initiative's creator, stewards of the idea, or moderators.

Path parameters:

| Name | Description |
| --- | --- |
| `initiative` | Initiative id. |

Request body: [`RecordOutcomeRequest`](#schema-recordoutcomerequest)

Response `201`: [`Initiative`](#schema-initiative)

Notable errors:

- `invariant_violated` — a planned initiative has no outcome yet

## Discussion

Comments and moderation.

### `GET /v1/ideas/:idea/comments`

**The idea's discussion (oldest first)** · `listComments`

**Access:** public

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Query parameters:

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | 1–100; default `20` |
| `cursor` | string | no | length 0–500 |

Response `200`: [`CommentPage`](#schema-commentpage)

### `POST /v1/ideas/:idea/comments`

**Comment, ask or suggest — optionally replying or anchored to a claim, evidence or argument** · `postComment`

**Access:** signed in

Path parameters:

| Name | Description |
| --- | --- |
| `idea` | Idea id (UUID) or slug. |

Request body: [`PostCommentRequest`](#schema-postcommentrequest)

Response `201`: [`Comment`](#schema-comment)

### `POST /v1/moderation`

**Hide or restore content** · `moderate`

**Access:** signed in — Moderators.

Content is never deleted. The action and reason are published in the moderation log.

Request body: [`ModerationRequest`](#schema-moderationrequest)

Response `200`: [`ModerationResult`](#schema-moderationresult)

Notable errors:

- `conflict` — already in that state

## Schemas

Named request and response shapes. Nested inline objects are listed with dotted paths.

### <a id="schema-activity"></a>Activity

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `occurredAt` | string (date-time) | yes |  |
| `actor` | [`PersonRef`](#schema-personref) \| null | yes (nullable) |  |
| `action` | string | yes | Dotted verb, e.g. "evidence.attached", "moderation.hidden". |
| `ideaId` | string (uuid) \| null | yes (nullable) |  |
| `idea` | [`IdeaRef`](#schema-idearef) \| null | yes (nullable) | The idea `ideaId` refers to, for display; null when none or hidden. |
| `subject` | object | yes |  |
| `subject.kind` | string | yes |  |
| `subject.id` | string (uuid) | yes |  |
| `subject.hidden` | boolean | yes |  |
| `payload` | map (string → any) | yes |  |

### <a id="schema-activitypage"></a>ActivityPage

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | [`Activity`](#schema-activity)[] | yes |  |
| `nextCursor` | string \| null | yes |  |

### <a id="schema-addclaimrequest"></a>AddClaimRequest

Provide exactly one of `claimId` (link an existing claim) or `statement` (state a new one).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `claimId` | string (uuid) | no |  |
| `statement` | string | no | length 10–600 |
| `role` | `premise` \| `mechanism` \| `prerequisite` \| `consequence` \| `risk` | yes |  |
| `depth` | integer | no | 1–4 |
| `assessment` | [`ClaimAssessmentInput`](#schema-claimassessmentinput) | no |  |

### <a id="schema-apiindex"></a>ApiIndex

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes |  |
| `description` | string | yes |  |
| `apiVersion` | `"v1"` | yes |  |
| `links` | object | yes |  |
| `links.openapi` | string | yes |  |
| `links.health` | string | yes |  |
| `links.vocabulary` | string | yes |  |
| `links.locales` | string | yes |  |
| `links.ideas` | string | yes |  |
| `links.topics` | string | yes |  |
| `links.search` | string | yes |  |
| `links.activity` | string | yes |  |

### <a id="schema-appointstewardrequest"></a>AppointStewardRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `handle` | string | yes | length 1–32 |

### <a id="schema-argument"></a>Argument

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `target` | object | yes |  |
| `target.kind` | `idea` \| `claim` \| `argument` | yes |  |
| `target.id` | string (uuid) | yes |  |
| `stance` | `supports` \| `opposes` \| `qualifies` | yes |  |
| `title` | string | yes |  |
| `body` | string | yes |  |
| `author` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `withdrawnAt` | string (date-time) \| null | yes (nullable) |  |
| `hidden` | boolean | yes |  |
| `replyCount` | integer | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.strength` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `derived.usefulCount` | integer | yes |  |

### <a id="schema-argumentdetail"></a>ArgumentDetail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `target` | object | yes |  |
| `target.kind` | `idea` \| `claim` \| `argument` | yes |  |
| `target.id` | string (uuid) | yes |  |
| `stance` | `supports` \| `opposes` \| `qualifies` | yes |  |
| `title` | string | yes |  |
| `body` | string | yes |  |
| `author` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `withdrawnAt` | string (date-time) \| null | yes (nullable) |  |
| `hidden` | boolean | yes |  |
| `replyCount` | integer | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.strength` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `derived.usefulCount` | integer | yes |  |
| `replies` | [`Argument`](#schema-argument)[] | yes |  |

### <a id="schema-argumenttarget"></a>ArgumentTarget

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `idea` \| `claim` \| `argument` | yes |  |
| `id` | string (uuid) | yes |  |

### <a id="schema-attachevidencerequest"></a>AttachEvidenceRequest

Provide exactly one basis: `sourceId`, `source` (registered or matched by DOI/URL) or `outcomeId`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `sourceId` | string (uuid) | no |  |
| `source` | [`SourceInput`](#schema-sourceinput) | no |  |
| `outcomeId` | string (uuid) | no |  |
| `stance` | `supports` \| `challenges` \| `mixed` | yes |  |
| `summary` | string | yes | length 10–2000 |
| `limitations` | string | no | length 0–2000 |
| `locator` | string | no | length 0–200 |

### <a id="schema-auth"></a>Auth

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `person` | [`Person`](#schema-person) | yes |  |
| `preferences` | object | yes |  |
| `preferences.locale` | string \| null | yes (nullable) | length 0–35 |
| `token` | string | yes | Session token. Also set as the HttpOnly `ip_session` cookie. |
| `expiresAt` | string (date-time) | yes |  |

### <a id="schema-changepasswordrequest"></a>ChangePasswordRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `currentPassword` | string | yes | length 1–200 |
| `newPassword` | string | yes | length 10–200 |

### <a id="schema-claim"></a>Claim

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `statement` | string | yes |  |
| `createdBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `hidden` | boolean | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.status` | `unassessed` \| `established` \| `supported` \| `hypothesis` \| `unknown` \| `doubtful` \| `refuted` \| `contested` | yes |  |
| `derived.support` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `derived.plausibility` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `evidenceCounts` | map (supports \| challenges \| mixed → integer) | yes |  |
| `ideaCount` | integer | yes | Ideas this claim currently underpins. |

### <a id="schema-claimassessmentinput"></a>ClaimAssessmentInput

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `support` | integer | no | 1–5 |
| `plausibility` | integer | no | 1–5 |
| `confidence` | `low` \| `medium` \| `high` | no |  |

### <a id="schema-claimdetail"></a>ClaimDetail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `statement` | string | yes |  |
| `createdBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `hidden` | boolean | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.status` | `unassessed` \| `established` \| `supported` \| `hypothesis` \| `unknown` \| `doubtful` \| `refuted` \| `contested` | yes |  |
| `derived.support` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `derived.plausibility` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `evidenceCounts` | map (supports \| challenges \| mixed → integer) | yes |  |
| `ideaCount` | integer | yes | Ideas this claim currently underpins. |
| `ideas` | object[] | yes |  |
| `ideas[].id` | string (uuid) | yes |  |
| `ideas[].slug` | string | yes |  |
| `ideas[].title` | string | yes |  |
| `ideas[].stage` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |
| `ideas[].role` | `premise` \| `mechanism` \| `prerequisite` \| `consequence` \| `risk` | yes |  |
| `evidence` | [`Evidence`](#schema-evidence)[] | yes |  |
| `arguments` | [`Argument`](#schema-argument)[] | yes |  |

### <a id="schema-comment"></a>Comment

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `ideaId` | string (uuid) | yes |  |
| `kind` | `comment` \| `question` \| `suggestion` | yes |  |
| `body` | string | yes | Empty when hidden by moderation (the comment keeps its place in the thread). |
| `author` | [`PersonRef`](#schema-personref) | yes |  |
| `parentId` | string (uuid) \| null | yes (nullable) |  |
| `anchor` | object \| null | yes (nullable) |  |
| `anchor.kind` | `claim` \| `evidence` \| `argument` | yes |  |
| `anchor.id` | string (uuid) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `hidden` | boolean | yes |  |
| `derived` | object | yes |  |
| `derived.usefulCount` | integer | yes |  |

### <a id="schema-commentpage"></a>CommentPage

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | [`Comment`](#schema-comment)[] | yes |  |
| `nextCursor` | string \| null | yes |  |

### <a id="schema-createargumentrequest"></a>CreateArgumentRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `target` | [`ArgumentTarget`](#schema-argumenttarget) | yes |  |
| `stance` | `supports` \| `opposes` \| `qualifies` | yes |  |
| `title` | string | yes | length 5–200 |
| `body` | string | yes | length 20–10000 |

### <a id="schema-createinitiativerequest"></a>CreateInitiativeRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `research` \| `experiment` \| `prototype` \| `pilot` \| `deployment` \| `policy` \| `funding` \| `other` | yes |  |
| `title` | string | yes | length 5–200 |
| `description` | string | yes | length 20–10000 |
| `organization` | string | no | length 0–200 |
| `url` | string (uri) | no | length 0–2000 |
| `status` | `planned` \| `active` \| `completed` \| `discontinued` | no | default `"planned"` |
| `startedOn` | string (date) | no |  |
| `endedOn` | string (date) | no |  |

### <a id="schema-createtopicrequest"></a>CreateTopicRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | length 2–80 |
| `description` | string | no | length 0–1000 |
| `parentSlug` | string | no | length 0–80 |
| `slug` | string | no |  |

### <a id="schema-deciderevisionrequest"></a>DecideRevisionRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `decision` | `accept` \| `reject` | yes |  |
| `note` | string | no | length 0–4000 |

### <a id="schema-declareexpertiserequest"></a>DeclareExpertiseRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `topic` | string | yes | length 1–80 |
| `note` | string | no | length 0–500 |

### <a id="schema-declareinvolvementrequest"></a>DeclareInvolvementRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `offering` \| `active` \| `concluded` | yes |  |
| `note` | string | no | length 0–1000 |

### <a id="schema-error"></a>Error

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `error` | object | yes |  |
| `error.code` | string | yes |  |
| `error.message` | string | yes |  |
| `error.details` | object | yes |  |
| `error.details.reason` | string | yes |  |
| `error.details.issues` | [`ValidationIssue`](#schema-validationissue)[] | no |  |
| `error.requestId` | string | no |  |

### <a id="schema-evaluation"></a>Evaluation

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `submissionId` | string (uuid) | yes |  |
| `evaluator` | [`PersonRef`](#schema-personref) | yes |  |
| `target` | object | yes |  |
| `target.kind` | `idea` \| `claim` \| `evidence` \| `argument` \| `relation` \| `comment` | yes |  |
| `target.id` | string (uuid) | yes |  |
| `dimension` | string | yes |  |
| `value` | number | yes |  |
| `confidence` | `low` \| `medium` \| `high` \| null | yes (nullable) |  |
| `rationale` | string | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `supersededAt` | string (date-time) \| null | yes (nullable) | Set when the evaluator re-rated or withdrew. |

### <a id="schema-evaluationpage"></a>EvaluationPage

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | [`Evaluation`](#schema-evaluation)[] | yes |  |
| `nextCursor` | string \| null | yes |  |

### <a id="schema-evaluationtarget"></a>EvaluationTarget

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `idea` \| `claim` \| `evidence` \| `argument` \| `relation` \| `comment` | yes |  |
| `id` | string (uuid) | yes |  |

### <a id="schema-evidence"></a>Evidence

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `claimId` | string (uuid) | yes |  |
| `stance` | `supports` \| `challenges` \| `mixed` | yes |  |
| `summary` | string | yes |  |
| `limitations` | string | yes | What this evidence does NOT establish. |
| `locator` | string | yes |  |
| `source` | [`Source`](#schema-source) \| null | yes (nullable) |  |
| `outcome` | object \| null | yes (nullable) |  |
| `outcome.id` | string (uuid) | yes |  |
| `outcome.initiativeId` | string (uuid) | yes |  |
| `outcome.result` | `succeeded` \| `partially_succeeded` \| `failed` \| `inconclusive` | yes |  |
| `contributedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `withdrawnAt` | string (date-time) \| null | yes (nullable) |  |
| `withdrawnReason` | string | yes |  |
| `hidden` | boolean | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.quality` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `derived.relevance` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |

### <a id="schema-expertise"></a>Expertise

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `topic` | [`TopicRef`](#schema-topicref) | yes |  |
| `basis` | `self_declared` \| `verified` | yes |  |
| `note` | string | yes |  |
| `since` | string (date-time) | yes |  |

### <a id="schema-graph"></a>Graph

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `focusId` | string (uuid) | yes |  |
| `nodes` | object[] | yes |  |
| `nodes[].id` | string (uuid) | yes |  |
| `nodes[].slug` | string | yes |  |
| `nodes[].title` | string | yes |  |
| `nodes[].stage` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |
| `nodes[].distance` | integer | yes |  |
| `nodes[].topics` | string[] | yes |  |
| `edges` | object[] | yes |  |
| `edges[].id` | string (uuid) | yes |  |
| `edges[].type` | `requires` \| `applies` \| `extends` \| `derived_from` \| `alternative_to` \| `complements` \| `conflicts_with` | yes |  |
| `edges[].from` | string (uuid) | yes |  |
| `edges[].to` | string (uuid) | yes |  |

### <a id="schema-health"></a>Health

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ok` | boolean | yes |  |
| `database` | `up` \| `down` | yes |  |

### <a id="schema-ideaclaim"></a>IdeaClaim

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `statement` | string | yes |  |
| `createdBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `hidden` | boolean | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.status` | `unassessed` \| `established` \| `supported` \| `hypothesis` \| `unknown` \| `doubtful` \| `refuted` \| `contested` | yes |  |
| `derived.support` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `derived.plausibility` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `evidenceCounts` | map (supports \| challenges \| mixed → integer) | yes |  |
| `ideaCount` | integer | yes | Ideas this claim currently underpins. |
| `linkId` | string (uuid) | yes |  |
| `role` | `premise` \| `mechanism` \| `prerequisite` \| `consequence` \| `risk` | yes |  |
| `depth` | integer \| null | yes (nullable) |  |
| `position` | integer | yes |  |
| `addedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `addedAt` | string (date-time) | yes |  |

### <a id="schema-ideacontent"></a>IdeaContent

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes |  |
| `summary` | string | yes |  |
| `sections` | map (overview \| motivation \| mechanism \| prerequisites \| uncertainties \| challenges \| consequences \| origins → string) | yes |  |
| `topics` | string[] | yes | Topic slugs. |
| `tags` | string[] | yes |  |

### <a id="schema-ideacontentinput"></a>IdeaContentInput

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | length 5–160 |
| `summary` | string | yes | length 20–600 |
| `sections` | map (overview \| motivation \| mechanism \| prerequisites \| uncertainties \| challenges \| consequences \| origins → string) | no | default `{}` |
| `topics` | string[] | yes | 1–4 items |
| `tags` | string[] | no | 0–12 items; default `[]` |

### <a id="schema-ideadetail"></a>IdeaDetail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `slug` | string | yes |  |
| `title` | string | yes |  |
| `summary` | string | yes |  |
| `stage` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |
| `stageChangedAt` | string (date-time) | yes |  |
| `topics` | [`TopicRef`](#schema-topicref)[] | yes | 1–4 topics; the first is primary. |
| `tags` | string[] | yes |  |
| `proposedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `updatedAt` | string (date-time) | yes | When the current revision was published. |
| `signals` | [`IdeaSignals`](#schema-ideasignals) | yes |  |
| `revision` | [`RevisionRef`](#schema-revisionref) | yes |  |
| `sections` | map (overview \| motivation \| mechanism \| prerequisites \| uncertainties \| challenges \| consequences \| origins → string) | yes | Markdown. `[text](claim:<id>)` links anchor prose to claims. |
| `stewards` | [`Steward`](#schema-steward)[] | yes |  |
| `hidden` | boolean | yes |  |
| `stageRequirements` | [`StageRequirement`](#schema-stagerequirement)[] | yes |  |
| `pendingRevisionProposals` | integer | yes |  |
| `viewer` | [`ViewerState`](#schema-viewerstate) \| null | yes (nullable) | Null for anonymous viewers. |

### <a id="schema-idealistitem"></a>IdeaListItem

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `slug` | string | yes |  |
| `title` | string | yes |  |
| `summary` | string | yes |  |
| `stage` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |
| `stageChangedAt` | string (date-time) | yes |  |
| `topics` | [`TopicRef`](#schema-topicref)[] | yes | 1–4 topics; the first is primary. |
| `tags` | string[] | yes |  |
| `proposedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `updatedAt` | string (date-time) | yes | When the current revision was published. |
| `signals` | [`IdeaSignals`](#schema-ideasignals) | yes |  |

### <a id="schema-ideapage"></a>IdeaPage

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | [`IdeaListItem`](#schema-idealistitem)[] | yes |  |
| `nextCursor` | string \| null | yes |  |

### <a id="schema-idearef"></a>IdeaRef

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `slug` | string | yes |  |
| `title` | string | yes |  |
| `stage` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |

### <a id="schema-idearelation"></a>IdeaRelation

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `type` | `requires` \| `applies` \| `extends` \| `derived_from` \| `alternative_to` \| `complements` \| `conflicts_with` | yes |  |
| `from` | [`IdeaRef`](#schema-idearef) | yes |  |
| `to` | [`IdeaRef`](#schema-idearef) | yes |  |
| `rationale` | string | yes |  |
| `proposedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.validity` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |
| `phrase` | string | yes | The relation read from the focal idea, e.g. "is required by". |
| `direction` | `outgoing` \| `incoming` \| `symmetric` | yes |  |
| `other` | [`IdeaRef`](#schema-idearef) | yes |  |

### <a id="schema-ideasignals"></a>IdeaSignals

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `algorithm` | string | yes |  |
| `computedAt` | string (date-time) \| null | yes (nullable) |  |
| `attention` | integer | yes | People who marked the idea important. Popularity — not quality. |
| `ratings` | map (impact \| feasibility \| plausibility \| evidence \| novelty \| development \| support \| quality \| relevance \| strength \| validity \| useful → [`RatingSummary`](#schema-ratingsummary)) | yes |  |
| `perspectives` | map (important \| worth_researching \| plausible \| doubtful \| ready_now → { count: integer, share: number }) | yes |  |
| `completeness` | number | yes | Share of narrative sections written (0–1). |
| `contestation` | number | yes | Widest disagreement among confidently rated dimensions (0–0.5). |
| `counts` | object | yes |  |
| `counts.claims` | integer | yes |  |
| `counts.evidence` | integer | yes |  |
| `counts.evidenceSupporting` | integer | yes |  |
| `counts.evidenceChallenging` | integer | yes |  |
| `counts.arguments` | integer | yes |  |
| `counts.comments` | integer | yes |  |
| `counts.initiatives` | integer | yes |  |
| `counts.contributors` | integer | yes |  |
| `counts.evaluators` | integer | yes |  |

### <a id="schema-initiative"></a>Initiative

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `idea` | [`IdeaRef`](#schema-idearef) | yes |  |
| `kind` | `research` \| `experiment` \| `prototype` \| `pilot` \| `deployment` \| `policy` \| `funding` \| `other` | yes |  |
| `title` | string | yes |  |
| `description` | string | yes |  |
| `organization` | string | yes |  |
| `url` | string \| null | yes |  |
| `status` | `planned` \| `active` \| `completed` \| `discontinued` | yes |  |
| `startedOn` | string (date) \| null | yes (nullable) |  |
| `endedOn` | string (date) \| null | yes (nullable) |  |
| `createdBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `hidden` | boolean | yes |  |
| `outcomes` | [`Outcome`](#schema-outcome)[] | yes |  |

### <a id="schema-involvement"></a>Involvement

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `person` | [`PersonRef`](#schema-personref) | yes |  |
| `capacity` | `research` \| `engineering` \| `funding` \| `entrepreneurship` \| `policy` \| `organizing` \| `communication` | yes |  |
| `status` | `offering` \| `active` \| `concluded` | yes |  |
| `note` | string | yes |  |
| `since` | string (date-time) | yes |  |

### <a id="schema-locale"></a>Locale

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `tag` | string | yes | length 0–35 |
| `name` | string | yes |  |
| `direction` | `ltr` \| `rtl` | yes |  |
| `status` | `released` \| `beta` | yes |  |

### <a id="schema-loginrequest"></a>LoginRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string (email) | yes |  |
| `password` | string | yes | length 1–200 |

### <a id="schema-me"></a>Me

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `person` | [`Person`](#schema-person) | yes |  |
| `email` | string | yes |  |
| `preferences` | object | yes |  |
| `preferences.locale` | string \| null | yes (nullable) | length 0–35 |

### <a id="schema-moderationrequest"></a>ModerationRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `target` | object | yes |  |
| `target.kind` | `idea` \| `claim` \| `evidence` \| `argument` \| `comment` \| `initiative` | yes |  |
| `target.id` | string (uuid) | yes |  |
| `action` | `hide` \| `restore` | yes |  |
| `reason` | string | yes | length 3–4000 |

### <a id="schema-moderationresult"></a>ModerationResult

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `hidden` | boolean | yes |  |

### <a id="schema-ok"></a>Ok

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ok` | `true` | yes |  |

### <a id="schema-outcome"></a>Outcome

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `initiativeId` | string (uuid) | yes |  |
| `result` | `succeeded` \| `partially_succeeded` \| `failed` \| `inconclusive` | yes |  |
| `summary` | string | yes |  |
| `lessons` | string | yes |  |
| `source` | [`Source`](#schema-source) \| null | yes (nullable) |  |
| `recordedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `recordedAt` | string (date-time) | yes |  |

### <a id="schema-person"></a>Person

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `handle` | string | yes |  |
| `displayName` | string | yes |  |
| `bio` | string | yes |  |
| `affiliation` | string | yes |  |
| `capacities` | `research` \| `engineering` \| `funding` \| `entrepreneurship` \| `policy` \| `organizing` \| `communication`[] | yes |  |
| `role` | `member` \| `moderator` \| `admin` | yes |  |
| `active` | boolean | yes | False when deactivated by moderation. Contributions stay attributed. |
| `createdAt` | string (date-time) | yes |  |

### <a id="schema-personmoderationrequest"></a>PersonModerationRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 3–4000 |

### <a id="schema-personref"></a>PersonRef

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `handle` | string | yes |  |
| `displayName` | string | yes |  |

### <a id="schema-postcommentrequest"></a>PostCommentRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `comment` \| `question` \| `suggestion` | no | default `"comment"` |
| `body` | string | yes | length 2–10000 |
| `parentId` | string (uuid) | no |  |
| `anchor` | object | no |  |
| `anchor.kind` | `claim` \| `evidence` \| `argument` | yes |  |
| `anchor.id` | string (uuid) | yes |  |

### <a id="schema-profile"></a>Profile

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `person` | [`Person`](#schema-person) | yes |  |
| `expertise` | [`Expertise`](#schema-expertise)[] | yes |  |
| `contributions` | object | yes | Plain counts of recorded contributions — not a quality measure. |
| `contributions.ideasProposed` | integer | yes |  |
| `contributions.revisionsAccepted` | integer | yes |  |
| `contributions.claims` | integer | yes |  |
| `contributions.evidence` | integer | yes |  |
| `contributions.arguments` | integer | yes |  |
| `contributions.evaluations` | integer | yes |  |
| `contributions.comments` | integer | yes |  |
| `contributions.initiatives` | integer | yes |  |
| `contributions.usefulReceived` | integer | yes |  |
| `ideas` | [`IdeaListItem`](#schema-idealistitem)[] | yes |  |
| `involvements` | object[] | yes |  |
| `involvements[].idea` | [`IdeaRef`](#schema-idearef) | yes |  |
| `involvements[].capacity` | `research` \| `engineering` \| `funding` \| `entrepreneurship` \| `policy` \| `organizing` \| `communication` | yes |  |
| `involvements[].status` | `offering` \| `active` \| `concluded` | yes |  |
| `involvements[].since` | string (date-time) | yes |  |

### <a id="schema-proposeidearequest"></a>ProposeIdeaRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | length 5–160 |
| `summary` | string | yes | length 20–600 |
| `sections` | map (overview \| motivation \| mechanism \| prerequisites \| uncertainties \| challenges \| consequences \| origins → string) | no | default `{}` |
| `topics` | string[] | yes | 1–4 items |
| `tags` | string[] | no | 0–12 items; default `[]` |

### <a id="schema-proposerelationrequest"></a>ProposeRelationRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fromIdeaId` | string (uuid) | yes |  |
| `toIdeaId` | string (uuid) | yes |  |
| `type` | `requires` \| `applies` \| `extends` \| `derived_from` \| `alternative_to` \| `complements` \| `conflicts_with` | yes |  |
| `rationale` | string | no | length 0–4000 |

### <a id="schema-ratingsummary"></a>RatingSummary

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `value` | number | yes | Mean rescaled to 0–1 (for meters). |
| `mean` | number | yes | Mean on the dimension's native scale (e.g. 1–5). |
| `dispersion` | number | yes | Normalised spread: 0 = full agreement, 0.5 = maximal split. |
| `n` | integer | yes | Number of current ratings. Below 3, show 'too early to tell'. |

### <a id="schema-recordoutcomerequest"></a>RecordOutcomeRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `result` | `succeeded` \| `partially_succeeded` \| `failed` \| `inconclusive` | yes |  |
| `summary` | string | yes | length 20–10000 |
| `lessons` | string | no | length 0–10000 |
| `sourceId` | string (uuid) | no |  |

### <a id="schema-registerrequest"></a>RegisterRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `handle` | string | yes | length 3–32 |
| `displayName` | string | yes | length 2–80 |
| `email` | string (email) | yes |  |
| `password` | string | yes | length 10–200 |
| `locale` | string | no | A supported locale tag from GET /v1/locales. — length 0–35 |

### <a id="schema-relation"></a>Relation

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `type` | `requires` \| `applies` \| `extends` \| `derived_from` \| `alternative_to` \| `complements` \| `conflicts_with` | yes |  |
| `from` | [`IdeaRef`](#schema-idearef) | yes |  |
| `to` | [`IdeaRef`](#schema-idearef) | yes |  |
| `rationale` | string | yes |  |
| `proposedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `derived` | object | yes |  |
| `derived.algorithm` | string | yes |  |
| `derived.validity` | [`RatingSummary`](#schema-ratingsummary) \| null | yes (nullable) |  |

### <a id="schema-revision"></a>Revision

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `number` | integer | yes |  |
| `author` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `changeNote` | string | yes |  |
| `ideaId` | string (uuid) | yes |  |
| `status` | `proposed` \| `accepted` \| `rejected` \| `withdrawn` | yes |  |
| `baseRevisionId` | string (uuid) \| null | yes (nullable) |  |
| `decidedBy` | [`PersonRef`](#schema-personref) \| null | yes (nullable) |  |
| `decidedAt` | string (date-time) \| null | yes (nullable) |  |
| `decisionNote` | string | yes |  |
| `content` | [`IdeaContent`](#schema-ideacontent) | yes |  |

### <a id="schema-revisionref"></a>RevisionRef

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `number` | integer | yes |  |
| `author` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `changeNote` | string | yes |  |

### <a id="schema-revisionsummary"></a>RevisionSummary

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `number` | integer | yes |  |
| `author` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `changeNote` | string | yes |  |
| `ideaId` | string (uuid) | yes |  |
| `status` | `proposed` \| `accepted` \| `rejected` \| `withdrawn` | yes |  |
| `baseRevisionId` | string (uuid) \| null | yes (nullable) |  |
| `decidedBy` | [`PersonRef`](#schema-personref) \| null | yes (nullable) |  |
| `decidedAt` | string (date-time) \| null | yes (nullable) |  |
| `decisionNote` | string | yes |  |

### <a id="schema-searchresults"></a>SearchResults

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ideas` | [`IdeaListItem`](#schema-idealistitem)[] | yes |  |
| `claims` | object[] | yes |  |
| `claims[].id` | string (uuid) | yes |  |
| `claims[].statement` | string | yes |  |
| `claims[].ideaCount` | integer | yes |  |
| `claims[].status` | `unassessed` \| `established` \| `supported` \| `hypothesis` \| `unknown` \| `doubtful` \| `refuted` \| `contested` | yes |  |
| `sources` | [`Source`](#schema-source)[] | yes |  |
| `people` | [`PersonRef`](#schema-personref)[] | yes |  |

### <a id="schema-setrolerequest"></a>SetRoleRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `role` | `member` \| `moderator` \| `admin` | yes |  |

### <a id="schema-source"></a>Source

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `kind` | `peer_reviewed_article` \| `preprint` \| `book` \| `report` \| `dataset` \| `patent` \| `standard` \| `thesis` \| `web_page` \| `news` \| `expert_statement` \| `other` | yes |  |
| `title` | string | yes |  |
| `authors` | string | yes |  |
| `venue` | string | yes |  |
| `year` | integer \| null | yes (nullable) |  |
| `doi` | string \| null | yes |  |
| `url` | string \| null | yes |  |
| `registeredBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |

### <a id="schema-sourcedetail"></a>SourceDetail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `kind` | `peer_reviewed_article` \| `preprint` \| `book` \| `report` \| `dataset` \| `patent` \| `standard` \| `thesis` \| `web_page` \| `news` \| `expert_statement` \| `other` | yes |  |
| `title` | string | yes |  |
| `authors` | string | yes |  |
| `venue` | string | yes |  |
| `year` | integer \| null | yes (nullable) |  |
| `doi` | string \| null | yes |  |
| `url` | string \| null | yes |  |
| `registeredBy` | [`PersonRef`](#schema-personref) | yes |  |
| `createdAt` | string (date-time) | yes |  |
| `citedBy` | integer | yes |  |

### <a id="schema-sourceinput"></a>SourceInput

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `peer_reviewed_article` \| `preprint` \| `book` \| `report` \| `dataset` \| `patent` \| `standard` \| `thesis` \| `web_page` \| `news` \| `expert_statement` \| `other` | yes |  |
| `title` | string | yes | length 3–500 |
| `authors` | string | no | length 0–1000 |
| `venue` | string | no | length 0–300 |
| `year` | integer | no | 1000–2200 |
| `doi` | string | no | length 0–200 |
| `url` | string (uri) | no | length 0–2000 |

### <a id="schema-stagerequirement"></a>StageRequirement

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `stage` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |
| `met` | boolean | yes |  |
| `requirement` | string | yes |  |

### <a id="schema-stagetransition"></a>StageTransition

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `from` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` \| null | yes (nullable) |  |
| `to` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |
| `rationale` | string | yes |  |
| `decidedBy` | [`PersonRef`](#schema-personref) | yes |  |
| `occurredAt` | string (date-time) | yes |  |
| `initiativeId` | string (uuid) \| null | yes (nullable) |  |

### <a id="schema-stagetransitionrequest"></a>StageTransitionRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `to` | `imagined` \| `developed` \| `examined` \| `tested` \| `implemented` \| `learned_from` | yes |  |
| `rationale` | string | yes | length 1–4000 |
| `initiativeId` | string (uuid) | no |  |

### <a id="schema-stances"></a>Stances

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `stances` | `important` \| `worth_researching` \| `plausible` \| `doubtful` \| `ready_now`[] | yes |  |

### <a id="schema-steward"></a>Steward

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `person` | [`PersonRef`](#schema-personref) | yes |  |
| `role` | `originator` \| `steward` | yes |  |
| `since` | string (date-time) | yes |  |

### <a id="schema-submitevaluationrequest"></a>SubmitEvaluationRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `target` | [`EvaluationTarget`](#schema-evaluationtarget) | yes |  |
| `ratings` | object[] | yes | 1–20 items |
| `ratings[].dimension` | string | yes | length 1–40 |
| `ratings[].value` | number | yes |  |
| `ratings[].confidence` | `low` \| `medium` \| `high` | no |  |
| `rationale` | string | no | length 0–4000 |

### <a id="schema-submitevaluationresult"></a>SubmitEvaluationResult

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `submissionId` | string (uuid) | yes |  |
| `changed` | string[] | yes | Dimensions recorded; empty when the submission repeated current ratings. |
| `current` | [`ViewerRating`](#schema-viewerrating)[] | yes |  |

### <a id="schema-submitrevisionrequest"></a>SubmitRevisionRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `baseRevisionId` | string (uuid) | yes |  |
| `content` | [`IdeaContentInput`](#schema-ideacontentinput) | yes |  |
| `changeNote` | string | yes | length 3–500 |
| `intent` | `auto` \| `publish` \| `propose` | no | default `"auto"` |

### <a id="schema-topic"></a>Topic

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | yes |  |
| `parentId` | string (uuid) \| null | yes (nullable) |  |
| `ideaCount` | integer | yes | Visible ideas in this topic or its direct children. |
| `latestIdeas` | [`IdeaRef`](#schema-idearef)[] | yes | Up to two newest visible ideas in this topic or its direct children, newest first. |

### <a id="schema-topicdetail"></a>TopicDetail

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |
| `description` | string | yes |  |
| `parentId` | string (uuid) \| null | yes (nullable) |  |
| `ideaCount` | integer | yes | Visible ideas in this topic or its direct children. |
| `latestIdeas` | [`IdeaRef`](#schema-idearef)[] | yes | Up to two newest visible ideas in this topic or its direct children, newest first. |
| `children` | [`Topic`](#schema-topic)[] | yes |  |

### <a id="schema-topicref"></a>TopicRef

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (uuid) | yes |  |
| `slug` | string | yes |  |
| `name` | string | yes |  |

### <a id="schema-topictranslation"></a>TopicTranslation

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `locale` | string | yes | length 0–35 |
| `name` | string | yes |  |
| `description` | string | yes |  |

### <a id="schema-topictranslationrequest"></a>TopicTranslationRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | length 1–80 |
| `description` | string | yes | length 0–500 |

### <a id="schema-updateinitiativestatusrequest"></a>UpdateInitiativeStatusRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `planned` \| `active` \| `completed` \| `discontinued` | yes |  |
| `note` | string | no | length 0–4000 |
| `on` | string (date) | no |  |

### <a id="schema-updateprofilerequest"></a>UpdateProfileRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `displayName` | string | no | length 2–80 |
| `bio` | string | no | length 0–2000 |
| `affiliation` | string | no | length 0–200 |
| `capacities` | `research` \| `engineering` \| `funding` \| `entrepreneurship` \| `policy` \| `organizing` \| `communication`[] | no | 0–7 items |
| `locale` | string \| null | no | A supported locale tag, or null to resume negotiation. — length 0–35 |

### <a id="schema-validationissue"></a>ValidationIssue

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `path` | string | yes |  |
| `code` | string | yes |  |
| `message` | string | yes |  |
| `params` | map (string → any) | yes |  |

### <a id="schema-viewerrating"></a>ViewerRating

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dimension` | `impact` \| `feasibility` \| `plausibility` \| `evidence` \| `novelty` \| `development` \| `support` \| `quality` \| `relevance` \| `strength` \| `validity` \| `useful` | yes |  |
| `value` | number | yes |  |
| `confidence` | `low` \| `medium` \| `high` \| null | yes (nullable) |  |

### <a id="schema-viewerstate"></a>ViewerState

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `isSteward` | boolean | yes |  |
| `stances` | `important` \| `worth_researching` \| `plausible` \| `doubtful` \| `ready_now`[] | yes |  |
| `ratings` | [`ViewerRating`](#schema-viewerrating)[] | yes |  |
| `involvements` | object[] | yes |  |
| `involvements[].capacity` | `research` \| `engineering` \| `funding` \| `entrepreneurship` \| `policy` \| `organizing` \| `communication` | yes |  |
| `involvements[].status` | `offering` \| `active` \| `concluded` | yes |  |

### <a id="schema-vocabulary"></a>Vocabulary

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `locale` | string | yes | length 0–35 |
| `stages` | object[] | yes |  |
| `stages[].key` | string \| number | yes |  |
| `stages[].label` | string | yes |  |
| `stages[].description` | string | yes |  |
| `sections` | object[] | yes |  |
| `sections[].key` | string \| number | yes |  |
| `sections[].label` | string | yes |  |
| `sections[].description` | string | yes |  |
| `claimRoles` | object[] | yes |  |
| `claimRoles[].key` | string \| number | yes |  |
| `claimRoles[].label` | string | yes |  |
| `claimRoles[].description` | string | yes |  |
| `consequenceDepths` | object[] | yes |  |
| `consequenceDepths[].key` | string \| number | yes |  |
| `consequenceDepths[].label` | string | yes |  |
| `consequenceDepths[].description` | string | yes |  |
| `claimStatuses` | object[] | yes |  |
| `claimStatuses[].key` | string \| number | yes |  |
| `claimStatuses[].label` | string | yes |  |
| `claimStatuses[].description` | string | yes |  |
| `evidenceStances` | object[] | yes |  |
| `evidenceStances[].key` | string \| number | yes |  |
| `evidenceStances[].label` | string | yes |  |
| `evidenceStances[].description` | string | yes |  |
| `sourceKinds` | object[] | yes |  |
| `sourceKinds[].key` | string \| number | yes |  |
| `sourceKinds[].label` | string | yes |  |
| `sourceKinds[].description` | string | yes |  |
| `argumentStances` | object[] | yes |  |
| `argumentStances[].key` | string \| number | yes |  |
| `argumentStances[].label` | string | yes |  |
| `argumentStances[].description` | string | yes |  |
| `commentKinds` | string[] | yes |  |
| `dimensions` | object[] | yes |  |
| `dimensions[].key` | string \| number | yes |  |
| `dimensions[].label` | string | yes |  |
| `dimensions[].description` | string | yes |  |
| `confidenceLevels` | string[] | yes |  |
| `stanceKinds` | object[] | yes |  |
| `stanceKinds[].key` | string \| number | yes |  |
| `stanceKinds[].label` | string | yes |  |
| `stanceKinds[].description` | string | yes |  |
| `capacities` | object[] | yes |  |
| `capacities[].key` | string \| number | yes |  |
| `capacities[].label` | string | yes |  |
| `capacities[].description` | string | yes |  |
| `involvementStatuses` | object[] | yes |  |
| `involvementStatuses[].key` | string \| number | yes |  |
| `involvementStatuses[].label` | string | yes |  |
| `involvementStatuses[].description` | string | yes |  |
| `relationTypes` | object[] | yes |  |
| `relationTypes[].key` | string \| number | yes |  |
| `relationTypes[].label` | string | yes |  |
| `relationTypes[].description` | string | yes |  |
| `initiativeKinds` | object[] | yes |  |
| `initiativeKinds[].key` | string \| number | yes |  |
| `initiativeKinds[].label` | string | yes |  |
| `initiativeKinds[].description` | string | yes |  |
| `initiativeStatuses` | object[] | yes |  |
| `initiativeStatuses[].key` | string \| number | yes |  |
| `initiativeStatuses[].label` | string | yes |  |
| `initiativeStatuses[].description` | string | yes |  |
| `outcomeResults` | object[] | yes |  |
| `outcomeResults[].key` | string \| number | yes |  |
| `outcomeResults[].label` | string | yes |  |
| `outcomeResults[].description` | string | yes |  |
| `revisionStatuses` | object[] | yes |  |
| `revisionStatuses[].key` | string \| number | yes |  |
| `revisionStatuses[].label` | string | yes |  |
| `revisionStatuses[].description` | string | yes |  |
| `lenses` | object[] | yes |  |
| `lenses[].key` | string \| number | yes |  |
| `lenses[].label` | string | yes |  |
| `lenses[].description` | string | yes |  |
| `minRatingsForConfidence` | integer | yes |  |
| `metricsAlgorithm` | string | yes |  |
| `limits` | map (string → { min: number, max: number }) | yes |  |

### <a id="schema-withdrawevaluationrequest"></a>WithdrawEvaluationRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `target` | [`EvaluationTarget`](#schema-evaluationtarget) | yes |  |
| `dimensions` | string[] | yes | 1–20 items |

### <a id="schema-withdrawevaluationresult"></a>WithdrawEvaluationResult

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `current` | [`ViewerRating`](#schema-viewerrating)[] | yes |  |

### <a id="schema-withdrawrequest"></a>WithdrawRequest

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `reason` | string | yes | length 3–4000 |

