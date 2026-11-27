# Data model

Source of truth: `apps/api/src/db/schema/*.ts` (commented per table) and the migrations in `apps/api/drizzle/`.
This document explains the _shape_ and the _guarantees_.

## Data categories

| Tier            | Meaning                                          | Mutability                                                                            | Examples                                                                                                 |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Facts**       | Things that happened or were explicitly recorded | Append-only. Only supersession/withdrawal/moderation markers may change (DB-enforced) | revisions, evaluations, stances, evidence, transitions, outcomes, activities                             |
| **Projections** | Current state, for querying                      | Rewritten only by the service that appends the underlying fact, same transaction      | `ideas.title/summary/tags/updated_at/current_revision_id`, `ideas.stage/stage_changed_at`, `idea_topics` |
| **Derived**     | Computed from facts by an algorithm              | Disposable; rebuilt any time                                                          | `idea_metrics`                                                                                           |
| **Operational** | State needed to run the service                  | Mutable and eligible for cleanup                                                      | `sessions`, `jobs`, `job_schedules`, `rate_limits`                                                       |

Mutable by nature (not history): `people` profile fields, `accounts`, `topics`, `topic_translations`, `initiatives.status`
(status _history_ is in the ledger), `hidden_at` flags (moderation _history_ is in the ledger).

## Tables

`rate_limits` holds a scoped key and its theoretical arrival time in an unlogged table. A database crash
can reset these budgets. The worker purges timestamps older than one minute on a one-minute schedule.
The same job purges expired `used_registration_challenges` receipts. Their primary key is the random salt.
This operational table is logged so an accepted proof remains spent through a restart.

### Identity

- **people** — public identity. `handle` (unique), `display_name`, `bio`, `affiliation`, `capacities text[]`
  (CHECK ⊆ vocabulary), `role` (member/moderator/admin), `deactivated_at`.
- **accounts** — `person_id` PK, `email` (unique, lowercased), `password_hash` (scrypt), `email_verified_at`, and a nullable product `locale` preference. Private registration records include `confirmed_minimum_age`, `age_confirmed_at`, `terms_version` and `terms_accepted_at`. Older accounts retain nulls. `established_at` is a rebuildable marker maintained by the daily trust job.
- **account_tokens** — private operational verification (48 hours), recovery (one hour), and email change (24 hours). The worker installs the token hash at dispatch. Verified-first requests hold a pending registration with its scrypt hash until consumption or replacement. Expired rows are purged after 30 days.
- **sessions** — `token_hash` (unique, SHA-256), expiry, revocation, browser family, last use and the reserved `mfa_at` timestamp. A legacy session falls back to its creation time until its first eligible last-use update.
- **security_events** — private operational history indexed by person and by retention date. Failed sign-ins for an unknown address have no person reference. Only the normalized client family and a keyed hash of the trusted network are retained. A daily job purges events after 90 days.
- **topics** — `slug` (unique), `name`, `description`, `parent_id` (hierarchy), `position`.
- **topic_translations** — `(topic_id, locale)` PK, translated `name` and `description`. The catalog service
  overlays this text on topic reads. The canonical `topics` row supplies fallback and names in idea references.
- **person_expertise** — person × topic × `basis` (self_declared | verified), `verified_by`, `created_at`,
  `revoked_at`. Partial unique: one current row per (person, topic, basis).

### Ideas

- **ideas** — identity (`id`, `slug` unique, `proposed_by`, `created_at`) + projections + `hidden_at` + generated
  `search tsvector` (title weight A, summary weight B; GIN). Never deleted (trigger).
- **idea_revisions** — `number` (unique per idea), `base_revision_id`, `author_id`, `change_note`,
  `content jsonb` (`IdeaContent`: title, summary, sections, topics, tags), `status`
  (proposed/accepted/rejected/withdrawn), `decided_by/at`, `decision_note`. Content immutable (trigger).
- **idea_topics** — projection of the current revision's topics; `position` 0 = primary.
- **idea_stewards** — person × idea × role (originator/steward), `granted_by/at`, `revoked_at`.
- **stage_transitions** — `from_stage`, `to_stage`, `rationale`, `decided_by`, `initiative_id`, `occurred_at`.
  Fully append-only.

### Knowledge

- **claims** — `statement`, `created_by`, `hidden_at`, generated `search tsvector`. Immutable statement.
- **idea_claims** — idea × claim × `role`, `depth` (1–4, only for consequence/risk; CHECK), `position`,
  `added_by/at`, `removed_at/by`. Partial unique: one current link per (idea, claim, role).
- **sources** — `kind`, `title`, `authors`, `venue`, `published_year`, `doi` (normalised, partial unique), `url`.
  Fully append-only (there is no correction path yet; see open questions).
- **evidence** — `claim_id`, exactly one of `source_id` / `outcome_id` (CHECK), `stance`
  (supports/challenges/mixed), `summary`, `limitations` ("what it does NOT establish"), `locator`,
  `contributed_by`, `withdrawn_at/reason`, `hidden_at`. Partial unique: one active attachment per (claim, source)
  and per (claim, outcome).
- **arguments** — exactly one of `idea_id` / `claim_id` / `parent_argument_id` (CHECK), `stance`
  (supports/opposes/qualifies), `title`, `body`, `author_id`, `withdrawn_at`, `hidden_at`.

### Signals

- **evaluations** — `submission_id` (groups one submission), `evaluator_id`, exactly one of
  `idea_id/claim_id/evidence_id/argument_id/relation_id/comment_id` (CHECK `num_nonnulls = 1`), generated
  `target_kind` + `target_id`, `dimension` (text, validated in code so dimensions can evolve), `value`,
  `confidence` (low/medium/high), `rationale`, `created_at`, `superseded_at`.
  Partial unique: one current row per (evaluator, target_id, dimension).
- **stances** — person × idea × `kind`, `created_at`, `retracted_at`. Partial unique: one current per kind.
- **involvements** — person × idea × `capacity`, `status` (offering/active/concluded), `note`, `superseded_at`.

### Graph

- **idea_relations** — `from_idea_id`, `to_idea_id` (CHECK ≠), `type`, `rationale`, `proposed_by`,
  `retracted_at/by`. Symmetric types stored in canonical (sorted) order. Partial unique per (from, to, type);
  partial indexes on (from, type) and (to, type) for traversal.

### Practice

- **initiatives** — `idea_id`, `kind`, `title`, `description`, `organization` (free text), `url`, `status`,
  `started_on`, `ended_on`, `created_by`, `hidden_at`.
- **outcomes** — `initiative_id`, `result`, `summary`, `lessons`, `source_id`, `recorded_by/at`. Fully append-only.

### Discussion, history, derived

- **comments** — `idea_id`, `parent_id`, at most one anchor (`anchor_claim_id/evidence_id/argument_id`), `kind`,
  `body`, `author_id`, `hidden_at`. Not editable.
- **activities** — `occurred_at`, `actor_id`, `action` (dotted verb), `idea_ids uuid[]` (GIN; an action on a shared
  claim belongs to every idea using it), `subject_kind`, `subject_id`, `payload jsonb`. Fully append-only.
- **idea_metrics** — key/value: (`idea_id`, `metric`) PK, `value`, `sample_size`, `dispersion`, `algorithm`,
  `computed_at`, `details jsonb`. Index on (metric, value) for lens sorting. Refreshes preserve the timestamp
  of each unchanged key and remove keys the algorithm no longer produces.

Metric keys written by `baseline-v0`: `rating.<dimension>` (normalised mean, dispersion = normalised SD, n;
details: raw mean/sd/weightSum), `attention`, `perspective.<stance>` (share; details: count), `completeness`,
`contestation`, `count.{claims,evidence,evidenceSupporting,evidenceChallenging,arguments,comments,initiatives,contributors,evaluators}`.

## History guarantees (migration `0001_history_guards.sql`)

| Table                                            | Allowed changes                               |
| ------------------------------------------------ | --------------------------------------------- |
| activities, stage_transitions, outcomes, sources | none (no UPDATE, no DELETE)                   |
| idea_revisions                                   | status, decided_by, decided_at, decision_note |
| evaluations, involvements                        | superseded_at                                 |
| stances                                          | retracted_at                                  |
| claims, comments                                 | hidden_at                                     |
| idea_claims                                      | removed_at, removed_by, position              |
| evidence                                         | withdrawn_at, withdrawn_reason, hidden_at     |
| arguments                                        | withdrawn_at, hidden_at                       |
| idea_relations                                   | retracted_at, retracted_by                    |
| idea_stewards                                    | revoked_at                                    |
| person_expertise                                 | revoked_at, verified_by                       |
| initiatives                                      | status, started_on, ended_on, hidden_at       |
| ideas                                            | no DELETE (projection columns are updatable)  |

The guard compares `to_jsonb(NEW) - allowed` with `to_jsonb(OLD) - allowed` in an AFTER trigger. New fact tables
must be added to a new custom migration.

## Recurring patterns

- **Current row via partial unique index.** `… WHERE superseded_at IS NULL` (or `retracted_at`, `removed_at`,
  `revoked_at`). Writing a new opinion = set the marker on the old row + insert a new row, in one transaction.
- **Exactly-one typed FK + generated polymorphic columns** (evaluations): integrity of real FKs, uniformity of
  `target_kind/target_id`.
- **Canonical symmetric edges** (`normalizeRelation`).
- **Vocabulary CHECKs generated from domain constants** (`inList` in `_columns.ts`). Evaluation `dimension` is the
  one deliberate exception.

## Answering the historical questions

These work because facts are append-only and timestamped. (Hidden content: decide per use case whether to include
it. Moderation hides, it does not erase.)

```sql
-- Who originally proposed this? (submitter + their first text; prior art is in content.sections.origins)
select i.proposed_by, r.content from ideas i
join idea_revisions r on r.idea_id = i.id and r.number = 1 where i.slug = $1;

-- How did the idea change, and who developed it?
select number, status, author_id, change_note, decided_by, decided_at, content
from idea_revisions where idea_id = $1 order by number;

-- What evidence existed at time T?
select e.* from evidence e
join idea_claims ic on ic.claim_id = e.claim_id and ic.idea_id = $1
where e.created_at <= $T and (e.withdrawn_at is null or e.withdrawn_at > $T)
  and ic.added_at <= $T and (ic.removed_at is null or ic.removed_at > $T);

-- When did the community's opinion change? (ratings in force at time T, per dimension)
select dimension, avg(value), stddev_pop(value), count(*) from evaluations
where idea_id = $1 and created_at <= $T and (superseded_at is null or superseded_at > $T)
group by dimension;

-- When did the idea move from speculation to experimental support?
select from_stage, to_stage, rationale, initiative_id, occurred_at
from stage_transitions where idea_id = $1 order by occurred_at;
-- …and the epistemic side: re-run deriveClaimStatus over claim evaluations in force at each moment.

-- Everything that happened to an idea, in order
select * from activities where $1 = any(idea_ids) order by occurred_at, id;
```

## Migrations workflow

1. Edit `apps/api/src/db/schema/*.ts`.
2. `npm run db:generate` → a new `drizzle/NNNN_*.sql`. Review it. Never edit an applied migration.
3. For triggers, functions or data backfills: `cd apps/api && npx drizzle-kit generate --custom --name=<name>`.
4. Tests apply all migrations to a fresh database, so a broken migration fails the suite.
5. Production: `npm run db:migrate` as a deploy step, before starting the new version.

## Known limitations

- `sources` cannot be corrected (typos in titles). Needs a correction model (new source + `supersedes`, or a
  versioned metadata table).
- Ideas have no `language` field yet (see open questions). Add it to `IdeaContent` (no migration) and a projection
  column if filtering is needed.
- Initiatives belong to exactly one idea. A multi-idea programme would need an `initiative_ideas` link.
- `idea_metrics` holds only the latest algorithm's values per key. Running algorithms side by side needs either
  distinct metric keys (`rating.impact@v1`) or an `algorithm` column in the primary key. Decide in the scoring work.
