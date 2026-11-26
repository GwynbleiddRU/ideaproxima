# Roadmap

Ordered by priority. Each item is sized for one focused agent session unless marked otherwise. Run `npm run check`
before finishing any item, and update the docs you touch.

## Done in the hardening pass (2026-11-15)

- **CI** (`.github/workflows/ci.yml`): `npm run check` on Node 22 and 24, the full suite on PostgreSQL 17, the full Docker
  stack with a smoke test, and a migrations-match-schema check.
- **Real-Postgres testing** (`npm run test:pg`), which found and fixed concurrency races (ADR-16).
- **Abuse protection:** rate limits on authentication and writes, a body size limit, account deactivation and
  reactivation by moderators, role management, password change (signs out other sessions).
- **Executable contract:** response schemas, the endpoint catalogue, contract checks on every response, enforced
  endpoint coverage, the OpenAPI document (`/v1/openapi.json`) and the generated API reference (ADR-14).
- **Deployability:** Dockerfile, docker-compose, bundled operator commands (`migrate`, `seed`, `set-role`,
  `rebuild-metrics`), a database-backed health check, and an operations guide including the erasure procedure.
- **Launch:** `docker compose up` runs the whole stack (ADR-19); `GET /v1` is an API index; quiet
  `apps/api/.env` loading; `npm audit` clean; install scripts decided explicitly (`allowScripts`).
- **Repository hygiene:** legacy prototypes removed, `.gitattributes` (LF), `.editorconfig`, and human documentation
  in `docs/user/` and `docs/developer/`, agent documentation in `docs/agents/`.

## Done: the web app (2026-11-15)

- **`apps/web`** (ADR-20): every API capability has a UI — discovery lenses with honest descriptions, topics,
  search, the activity ledger and moderation log; the idea page with narrative, separate quality meters (n and
  spread), community perspectives, lifecycle track, claims and evidence (with limitations), arguments and threaded
  comments, the connection graph (upstream/downstream), initiatives and outcomes, revision history with diffs and
  steward decisions; propose/edit with a progressive editor and conflict handling; evaluation, stances,
  involvement, stage changes, stewardship; profiles, account settings, moderation (hide/restore, deactivate, roles).
- **One origin:** the API serves the build (`src/http/web.ts`); `npm run dev` runs Vite + API with a proxy.
- **Audit** (`audit/`): Playwright end-to-end flows, axe WCAG 2.1 AA in both themes, first-visit performance
  budgets, screenshot set; in CI.
- **API additions for the UI:** `GET /v1` index, `ActivityDto.idea` (the idea's ref, so feeds need no extra calls).

## Done: production polish of the web app (2026-11-16)

- **Audit-driven redesign** of every main page, each previewed as a mock-up and approved by the owner first: a
  tabbed lens showcase, domain tiles and a contribution ladder on home; a filter toolbar and a phone filter sheet on
  Explore; a compact idea header (one primary action, attention set apart, an "at a glance"
  strip on phones, sticky tabs that keep the title), a half-height sidebar, a claims overview, for/against
  arguments, a labelled connection map, a day-grouped timeline and a compact evaluation dialog; topics with icons
  and their newest ideas; typed search results; a grouped activity feed with folded repeats; tabbed profiles; an
  editor with section states and a live preview.
- **Shared conventions** (documented in the developer guide): "too early" as ●○○ instead of empty bars, only
  non-zero facts, one idea component, one activity feed.
- **Bugs fixed:** topic counts were always 0 and searched claims "underpinned 0 ideas" (a Drizzle column rendered
  unqualified inside a correlated subquery; regression tests in `apps/api/test/catalog.test.ts`); editor prompts
  repeated their section titles; the browser's own clear button on search fields.
- **API additions:** `TopicDto.latestIdeas` (two newest per topic) and each claim's derived `status` in search results.

## The production-readiness program (planned 2026-11-17)

The path from this foundation to a worldwide, production-ready platform is designed in
[`production/`](production/README.md): an [audit](production/api-audit.md) (58 findings) and fifteen plans
with estimates, milestones and one sequence of 49 steps (41 before the launch). Each plan has a prompt in
`prompts/api/`. The program is the detailed form of the items below that it covers; where they differ, the
program is newer.

| Roadmap item                                                                                | Program plan                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 Auth completion                                                                        | [04 — Accounts, e-mail and trust](production/04-accounts-and-trust.md)                                                                       |
| P0-2 Content policy and reporting                                                           | [07 — Moderation core](production/07-moderation-core.md), [08 — AI moderation](production/08-ai-moderation.md)                               |
| P0-3 Production deployment, shared rate limiter                                             | [10 — Deployment and operations](production/10-deployment-and-operations.md), [03 — Rate limiting](production/03-rate-limiting.md)           |
| P0-4 Licences                                                                               | Owner decision; the acceptance mechanism is in plan 04                                                                                       |
| P1-7 Typed API client; P3-17 open data and API keys                                         | [12 — Public API](production/12-public-api.md)                                                                                               |
| P1-9 Duplicate handling; P3-16 semantic search                                              | [11 — Semantic search](production/11-semantic-search.md)                                                                                     |
| P1-10 Idea language and i18n (phase A API foundation complete, twelve beta locale defaults) | [05 — Localisation](production/05-localization.md), [06 — Multilingual content and search](production/06-multilingual-content-and-search.md) |
| Scaling notes in the architecture document                                                  | [02 — Background jobs](production/02-background-jobs.md), [09 — Read scalability](production/09-read-scalability.md)                         |
| New: defects found by the audit                                                             | [00 — Immediate hardening](production/00-immediate-hardening.md), [01 — Operational foundations](production/01-operational-foundations.md)   |
| P1-6, first part: pages for search engines and link previews; policy pages                  | [13 — The public web](production/13-public-web.md)                                                                                           |
| New: proof that the platform can launch                                                     | [14 — Launch readiness](production/14-launch-readiness.md)                                                                                   |

Start with step 1 of the program's sequence. Items not covered by the program (the rest of the web follow-ups,
follows and notifications, lenses for funders, scoring, predictions, organisation accounts) keep their place
below.

## P0 — before anyone outside the team uses it

1. **Auth completion.** Phase A delivered email verification, password recovery and confirmed email changes. Session listing and revocation follow in phase B, then OAuth and ORCID in phase C.
2. **Content policy + reporting.** A report endpoint (`reports` table, a fact), a moderator queue, and a written
   policy (what is not preserved: harm instructions, harassment).
3. **Production deployment.** Managed Postgres, release steps as documented in `docs/developer/operations.md`, error
   tracking, scheduled backups with tested restores, and a shared rate limiter if running more than one instance.
4. **Licences.** The code licence (no LICENSE file yet) and the contribution licence (open question 12), shown at
   registration. Both are owner decisions.

## P1 — the product people will see

6. **Web app follow-ups.** Prerender or server-render `/ideas/:slug` for search engines and link previews (ADR-20);
   a global "Future Atlas" (needs a whole-graph endpoint, e.g. `GET /v1/graph?topic=`); a steward inbox across
   ideas (needs `GET /v1/me/pending`); a moderator queue (with item 2); "useful" state per viewer for comments and
   arguments (needs viewer state on those DTOs).
7. **Typed API client** generated from `ENDPOINTS` (the web app's `src/api/*` modules are hand-written today, typed
   by `@ideaproxima/contracts`; generation would remove that duplication of paths).
8. **Follows, bookmarks, notifications** (personal state: `follows`, `bookmarks` tables; digest jobs from the
   ledger).
9. **Duplicate handling** — similar-idea and similar-claim suggestions at creation, and moderator merges (open
   question 3).
10. **Idea language** + basic i18n of the UI (English, Russian first).
11. **Funder/scientist lenses** (e.g. "ready to test": examined+, feasible, evidenced, active involvement).

## P2 — judgement and influence (multi-session, design first)

12. **Scoring system** — see `scoring-system-prompt-sketch.md`. Weighted summaries beside raw, an evidence-graph
    score, epistemic state, `person_metrics`, a weight policy.
13. **Predictions** (`forecast_questions`, `forecasts`) and calibration scoring.
14. **Verified expertise** workflow (moderator verification, ORCID evidence).
15. **AI-assistance provenance** fields before any AI feature ships.

## P3 — the archive as a public good

16. **Semantic search** (pgvector) across ideas, claims and sources.
17. **Open data:** periodic dumps of facts (not derived data) under the chosen licence; API keys and quotas.
18. **Durability:** yearly archival snapshots (e.g. Zenodo DOIs) so the collective memory outlives the platform.
19. **Organisation accounts.**

## Status of the MVP-era FOLLOWUP.md items

The original `FOLLOWUP.md` was removed from the repository with the seedbank prototype. Its items map as follows.

| FOLLOWUP item                                                                    | Status                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0.1 run against a real DB                                                        | Done for PGlite (real Postgres engine). Real-server CI is P0-1                                    |
| 0.2 automated tests                                                              | Done: domain unit tests + API integration tests                                                   |
| 0.3 CI                                                                           | Done (CI workflow, PGlite + PostgreSQL jobs)                                                      |
| 1.1 auth hardening, 1.2 abuse protection                                         | Rate limits, verification, reset, email change and deactivation done. Federation remains in P0-1. |
| 1.3 moderation                                                                   | Roles, hide/restore, account deactivation, public log done. Reports and queue: P0-2               |
| 1.4 Markdown + sanitisation                                                      | Done in the web app: micromark (raw HTML escaped, unsafe protocols dropped) + CSP                 |
| 1.5 error and empty states                                                       | Done in the web app: skeletons, empty states, field-level errors, retry, not-found page           |
| 1.6 deploy                                                                       | Dockerfile, release commands, health check, operations guide done. Production rollout: P0-3       |
| 2.1 idea versioning                                                              | Done: immutable revision snapshots                                                                |
| 2.2 co-development                                                               | Done: proposals, stewards decide, co-stewards                                                     |
| 2.3 structured evidence                                                          | Done: sources, evidence on claims, stance, limitations                                            |
| 2.4 idea graph                                                                   | Done: typed relations + traversal                                                                 |
| 2.5 threaded discussion                                                          | Done: comments + argument rebuttal chains                                                         |
| 2.6 stage transitions by community                                               | Open question 6                                                                                   |
| 2.7 notifications                                                                | P1-8                                                                                              |
| 3.1–3.5 reputation, weighting, calibration, verified expertise, sybil resistance | P2 (seams in place)                                                                               |
| 4.1 roles and intents                                                            | Done: capacities on profiles + involvements                                                       |
| 4.2 matching                                                                     | P1-11 / P2                                                                                        |
| 4.3 implementation tracking                                                      | Done: initiatives + outcomes + lessons                                                            |
| 4.4 organisation accounts                                                        | P3-19                                                                                             |
| 5.x search, duplicates, AI, lenses, public API                                   | Lenses and OpenAPI done. Search upgrades, duplicates, AI: P1/P3                                   |
| 6.x i18n, accessibility, durability, governance transparency                     | i18n: P1-10. Accessibility: WCAG 2.1 AA audited in CI. Durability: P3-18. Moderation log done     |
