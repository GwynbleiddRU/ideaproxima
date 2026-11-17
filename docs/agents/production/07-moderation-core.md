# 07 — Moderation core: policy, reports, decisions, appeals

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/07-moderation-core-prompt-sketch.md`.

| Status     | Not started                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [00](00-immediate-hardening.md), [02](02-background-jobs.md), [03](03-rate-limiting.md) (`moderation.report`, trust tiers) |
| Unblocks   | [08](08-ai-moderation.md), which writes into the queue and uses the decision records built here                            |
| Size       | 4 sessions · 18–24 engineer-days                                                                                           |

## Outcome

Anyone can report content; moderators work a prioritised queue instead of browsing; every decision is a
structured, public record with a reason; the person affected is told and can appeal to a different moderator;
every piece of user text in the system can be hidden; and nothing hidden leaks
([audit](api-audit.md): MOD-1, MOD-2, MOD-4, MOD-5, MOD-7, MOD-8; roadmap P0-2).

This plan is the human process. [08 — AI moderation](08-ai-moderation.md) adds an automated signal to the same
queue and the same records; it must not exist without this one.

## What the concept requires of moderation

`concept.txt` is specific enough to decide the hard questions in advance:

| The concept says                                                                                   | Therefore                                                                                             |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "An idea does not need to be immediately feasible, scientifically proven, or universally accepted" | Being wrong, unproven, unpopular or controversial is **never** a moderation reason                    |
| Anyone may propose "a social structure, political principle … biological capability"               | Political and biological ideas are in scope. Policy targets conduct and concrete harm, not topics     |
| "Community voting provides one signal … It does not determine what is true"                        | Reports are a signal for review. No number of reports hides anything by itself                        |
| "The platform should preserve uncertainty rather than hide it"                                     | Moderation hides, never erases; decisions and their reasons are public; a doubtful case stays visible |
| "A collective memory"                                                                              | Hidden content stays in the archive, restorable; only the law can force erasure (operator procedure)  |
| Reputation reflects "demonstrated intellectual contribution"                                       | Moderation history may restrict an account; it never feeds evaluation weights or quality metrics      |
| The audience includes funders looking for "investment ideas"                                       | Solicitation and investment scams are a first-class reason: this audience is what scammers come for   |

## Design

### The content policy

A user-facing document, `docs/user/content-policy.md`, drafted in this plan and **approved by the owner**
before launch. It defines stable reason codes that reports, decisions, statistics and the AI mapping all share
(`MODERATION_REASONS` in `packages/domain`):

| Code                     | Not preserved                                                                             | Explicitly allowed                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `child_safety`           | Any sexualisation of minors. Zero tolerance; immediate hide; legal reporting duties apply | —                                                                               |
| `violence_threats`       | Threats, incitement, glorification of violence against people                             | Analysing violence, war, history, risk                                          |
| `dangerous_instructions` | Operational instructions that give real uplift for serious physical harm                  | Ideas, policy and risk discussion about any technology, including dual-use ones |
| `harassment_hate`        | Attacks on a person, or on people for who they are; slurs; dehumanisation                 | Attacking an argument, an institution or an ideology, however sharply           |
| `privacy`                | Personal data of private individuals, credentials, doxxing                                | Public roles and published work of public figures                               |
| `sexual_content`         | Explicit sexual material                                                                  | Medical and scientific discussion                                               |
| `self_harm`              | Encouraging or instructing self-harm                                                      | Research and prevention                                                         |
| `spam_scam`              | Advertising, link farms, repetition, solicitation of money, investment schemes, phishing  | Declaring an involvement ("I can fund this") through the involvement feature    |
| `manipulation`           | Sock puppets, coordinated voting or evaluating, impersonation                             | Disclosed collaboration                                                         |
| `intellectual_property`  | Content removed after a valid rights-holder notice                                        | Quotation and citation                                                          |
| `illegal_other`          | Content unlawful to host that fits no code above                                          | —                                                                               |
| `not_a_contribution`     | Gibberish, tests, content unrelated to ideas (lowest severity; prefer a nudge)            | A rough, half-formed idea                                                       |

Severity (drives priority and time targets): `child_safety`, `violence_threats`, `privacy` are **critical**;
`dangerous_instructions`, `harassment_hate`, `self_harm`, `sexual_content`, `spam_scam`, `illegal_other` are
**standard**; the rest are **low**.

### Records

```sql
-- FACT (append-only): one person's report of one subject.
create table reports (
  id           uuid primary key,
  reporter_id  uuid not null references people(id),
  subject_kind text not null,  subject_id uuid not null,
  field        text not null default '',        -- '' = the whole subject
  reason       text not null,                   -- a MODERATION_REASONS code
  note         text not null default '',        -- ≤ 1,000 characters, visible to moderators only
  created_at   timestamptz not null default now(),
  unique (reporter_id, subject_kind, subject_id, field)
);

-- OPERATIONAL (mutable): the work item that gathers every signal about one subject.
create table moderation_cases (
  id           uuid primary key,
  subject_kind text not null,  subject_id uuid not null,  field text not null default '',
  state        text not null default 'open',    -- open | in_review | decided
  origin       text not null,                   -- report | automated | moderator | appeal
  severity     text not null,                   -- critical | standard | low (highest among its signals)
  priority     double precision not null,       -- computed; the queue sorts on it
  language     text not null default 'und',
  author_id    uuid references people(id),
  assigned_to  uuid references people(id),  assigned_until timestamptz,
  opened_at    timestamptz not null default now(),
  decided_at   timestamptz,  decision_id uuid
);
create unique index moderation_cases_open_key
  on moderation_cases (subject_kind, subject_id, field) where state <> 'decided';

-- FACT (append-only): what was decided, by whom, why. Public except internal_note.
create table moderation_decisions (
  id            uuid primary key,
  case_id       uuid not null references moderation_cases(id),
  subject_kind  text not null,  subject_id uuid not null,  field text not null default '',
  outcome       text not null,   -- no_action | hide | restore | redact | unredact | hold | release
  account_action text,           -- null | restrict | unrestrict | deactivate | reactivate
  reason        text not null,   -- a MODERATION_REASONS code ('none' for no_action)
  statement     text not null,   -- the public statement of reasons
  internal_note text not null default '',
  decided_by    uuid references people(id),   -- null = automated or operator
  automated     boolean not null default false,
  basis         jsonb not null default '{}',  -- report ids, assessment ids (plan 08), policy version
  appeal_of     uuid references moderation_decisions(id),
  created_at    timestamptz not null default now()
);

-- FACT (append-only): the affected person contests a decision. One per decision.
create table appeals (
  id uuid primary key, decision_id uuid not null unique references moderation_decisions(id),
  appellant_id uuid not null references people(id), statement text not null,
  created_at timestamptz not null default now()
);

-- PROJECTION (sparse): what is currently not visible, and why. Rows exist only for non-visible things.
create table content_visibility (
  subject_kind text not null,  subject_id uuid not null,  field text not null default '',
  state        text not null,   -- hidden | held | redacted
  decision_id  uuid not null references moderation_decisions(id),
  since        timestamptz not null default now(),
  primary key (subject_kind, subject_id, field)
);
```

`reports`, `moderation_decisions` and `appeals` get history guards in a new custom migration. `internal_note`
and `reports.note` are never returned to non-moderators.

**One writer for visibility.** `modules/moderation` is the only code that changes visibility, through one
function, `setVisibility(tx, subject, state, decision)`. It writes the `content_visibility` row **and** the
existing `hidden_at` column in the same transaction. `hidden_at` stays because every list query already
filters on it; `content_visibility` adds what a timestamp cannot say: why, by which decision, and field-level
redaction. A test asserts the two never disagree.

### Every text can be hidden (MOD-2)

| Text                                                                                                                                                                                             | Mechanism                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Ideas, claims, evidence, arguments, comments, initiatives                                                                                                                                        | Existing `hidden_at` (now set through `setVisibility`)                                                                  |
| Revisions (proposed, rejected, withdrawn, or accepted but no longer current)                                                                                                                     | New `idea_revisions.hidden_at`; content is blanked in DTOs, the row keeps its place                                     |
| Sources, outcomes                                                                                                                                                                                | New `hidden_at`; their guards change from "no change at all" to "`hidden_at` may change"                                |
| Evaluation rationale; relation rationale; involvement note; stage-transition rationale; change, decision and withdrawal notes; evidence limitations and locator; initiative organisation and URL | **Field redaction**: a `content_visibility` row with `field` set; DTO builders blank the field and set `redacted: true` |
| Profile display name, bio, affiliation                                                                                                                                                           | Field redaction; a redacted display name shows the handle                                                               |

Rules: the current revision of an idea cannot be hidden (hide the idea, or publish a clean revision first; a
moderator may do either). Redacting an evaluation's rationale does not touch its value: the rating is the
fact, the sentence is the conduct. DTO builders load redactions with one batched lookup per list, like
`usefulCounts()`.

### The ledger stops carrying text (completes MOD-1)

- New activity payloads contain ids and enumerations only. No `statement`, `title`, `changeNote`, `note`.
- `ActivityDto.subject` gains `label`: the subject's current display text (a claim's statement, an argument's
  title, "revision 3"), resolved at read time with visibility applied, by one batched loader per kind.
- For rows written before this change, a per-action allow-list projects the payload: only known non-text keys
  are returned.
- Activities whose subject is hidden, held or redacted are returned without a label and with
  `subject.hidden: true`, as plan 00 introduced.
- Ledger verbs: `moderation.hidden` and `moderation.restored` gain `decisionId`, `reason` and `automated` in
  their payload; `moderation.redacted`, `moderation.unredacted`, `moderation.person_restricted` and
  `moderation.appeal_decided` are added. `review.held` and `review.released` (used by plan 08) deliberately sit
  outside the `moderation.` prefix, so the public moderation log stays a list of decisions rather than of
  routine checks.
- **Filing a report is private by exception**, like a password change: who reported what must not be public,
  or reporting invites retaliation. It is not written to the public ledger; the `reports` table is its record.
  Add this exception to non-negotiable 7 and to API design rule 7.

### Workflow and endpoints

| Endpoint                                                | Who                 | Does                                                                                           |
| ------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /v1/reports`                                      | Members             | Files a report; idempotent per reporter and subject; opens or updates the case                 |
| `GET /v1/moderation/cases`                              | Moderators          | The queue: filters `state`, `severity`, `reason`, `language`, `assignee`; sorted by priority   |
| `GET /v1/moderation/cases/:case`                        | Moderators          | Subject snapshot, author with tier and history, reports, automated assessments, past decisions |
| `POST /v1/moderation/cases/:case/claim`, `…/release`    | Moderators          | A 30-minute assignment lease                                                                   |
| `POST /v1/moderation/cases/:case/decision`              | Moderators          | Records the decision and applies it atomically; closes the case; enqueues notices              |
| `POST /v1/moderation`                                   | Moderators          | Kept: a direct hide or restore. Now creates a case and a decision behind the scenes            |
| `GET /v1/me/moderation`                                 | Members             | Decisions that affected the caller's content or account, with statements and appeal status     |
| `POST /v1/moderation/decisions/:decision/appeal`        | The affected author | One appeal per decision, within 6 months                                                       |
| `POST /v1/people/:handle/restrict`, `…/unrestrict`      | Moderators          | Posting restriction until a date (the `restricted` tier of plan 03)                            |
| `POST /v1/moderation/people/:handle/hide-contributions` | Moderators          | A job hides everything visible by one account (spam clean-up); one decision, itemised ledger   |
| `GET /v1/moderation/stats?from=&to=`                    | Public              | Transparency figures (below)                                                                   |

Rules encoded in the domain policy (`packages/domain/src/rules/permissions.ts` and a new
`rules/moderation.ts`):

- New actions: `content.report`, `moderation.review`, `moderation.decide`, `moderation.appeal`,
  `person.restrict`.
- **Four eyes on appeals:** an appeal is decided by a moderator other than the one who made the appealed
  decision. If the original was automated, any moderator may decide.
- Nobody moderates their own content or account, or a case they reported.
- **Priority** is a pure function: severity weight × (1 + log₂ of distinct reporters, weighted by each
  reporter's upheld-report rate) + automated score (plan 08) + a boost for `new` and `restricted` authors + age.
  Report count alone never changes visibility.
- Reporters whose reports are mostly dismissed lose weight and then report budget; reporting is not a weapon.
- Moderators declare the languages they read (`people.languages`, a public profile field that also helps
  collaborators find each other); the queue defaults to those.

**Notices.** A decision that affects someone enqueues a notice: an entry in `GET /v1/me/moderation`
immediately, and an e-mail once [04](04-accounts-and-trust.md) provides delivery. It contains the statement of
reasons, the reason code, whether the decision was automated, and how to appeal. Reporters receive the outcome
without the internal note. This is also what the EU Digital Services Act expects of a hosting service (notice
and action, statement of reasons, internal complaint handling). The design supports it; legal review is the
owner's.

**Time targets** (measured from case opening to decision; exported as metrics, alerting in
[10](10-deployment-and-operations.md)): critical 4 hours, standard 48 hours, low 7 days.

**Transparency.** `GET /v1/moderation/stats` is computed from decisions: counts by reason, outcome and origin;
share automated; median and 90th-percentile time to decision; appeals filed, upheld and overturned. It is
public for the same reason the moderation log is.

### Web

A report dialog on every piece of content; "Moderation" in the account area (notices and appeals); the
moderator queue and case view; the restriction and clean-up actions. All previewed in `designs/` and approved
before implementation.

## Phases

| Phase | Scope                                                                                                                                                                | Days |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| A     | `content_visibility` and `setVisibility`; `hidden_at` for revisions, sources, outcomes; field redaction in every DTO builder; text-free payloads and `subject.label` | 5–6  |
| B     | Policy draft and reason codes; reports; cases and priority; queue endpoints; decisions; permissions; the kept `POST /v1/moderation`                                  | 5–7  |
| C     | Notices; appeals with four-eyes; restrictions; bulk clean-up job; public statistics                                                                                  | 4–5  |
| D     | Web: report dialog, notices and appeals, moderator queue (previews first)                                                                                            | 4–6  |

## Verification

- For every text field in the "can be hidden" table: after hiding or redacting, the text is absent from every
  endpoint that could return it (detail, lists, search, feeds, profile) for anonymous and member callers and
  present for moderators. This is one table-driven test, and it is the most important test in the plan.
- History guards reject updates and deletes on the three new fact tables.
- Workflow: duplicate reports coalesce into one case; a decision applies visibility, ledger and notice in one
  transaction; the appealed decision's author cannot decide the appeal; restricting changes the caller's tier.
- `content_visibility` and `hidden_at` agree after every operation (asserted in a test helper).
- `npm run check`, `npm run test:pg` (concurrency: two moderators deciding the same case, one wins with 409),
  `npm run test:e2e`.

## Documentation to update

`docs/user/content-policy.md` (new), `docs/user/user-guide.md` (reporting, notices, appeals),
`docs/agents/domain-model.md` and `data-model.md` (new facts, the projection, guard table),
`docs/agents/api-architecture.md` (rule 8, "hidden ≠ deleted", gains field redaction and the label rule),
`docs/agents/open-questions.md` (7 and 19), `docs/developer/operations.md` (moderator handbook: queue, time
targets, the child-safety and legal-notice runbooks), `docs/agents/roadmap.md` (P0-2).

## Decisions for the owner

1. The content policy text and the reason codes.
2. Whether moderators' names stay public in the moderation log (today's behaviour) or are shown by role.
3. Who may authorise legally required erasure (open question 19).
4. The legal reporting procedure for child-safety material in the operating jurisdiction.
