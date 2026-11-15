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

## P0 — before anyone outside the team uses it

1. **Auth completion.** Email verification and password reset (an expiring token table plus an email sender
   abstraction), session listing and revocation. Then OAuth + ORCID (ORCID also feeds verified expertise).
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

| FOLLOWUP item                                                                    | Status                                                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 0.1 run against a real DB                                                        | Done for PGlite (real Postgres engine). Real-server CI is P0-1                                |
| 0.2 automated tests                                                              | Done: domain unit tests + API integration tests                                               |
| 0.3 CI                                                                           | Done (CI workflow, PGlite + PostgreSQL jobs)                                                  |
| 1.1 auth hardening, 1.2 abuse protection                                         | Rate limits, password change, deactivation done. Email verification, reset, OAuth: P0-1       |
| 1.3 moderation                                                                   | Roles, hide/restore, account deactivation, public log done. Reports and queue: P0-2           |
| 1.4 Markdown + sanitisation                                                      | Done in the web app: micromark (raw HTML escaped, unsafe protocols dropped) + CSP             |
| 1.5 error and empty states                                                       | Done in the web app: skeletons, empty states, field-level errors, retry, not-found page       |
| 1.6 deploy                                                                       | Dockerfile, release commands, health check, operations guide done. Production rollout: P0-3   |
| 2.1 idea versioning                                                              | Done: immutable revision snapshots                                                            |
| 2.2 co-development                                                               | Done: proposals, stewards decide, co-stewards                                                 |
| 2.3 structured evidence                                                          | Done: sources, evidence on claims, stance, limitations                                        |
| 2.4 idea graph                                                                   | Done: typed relations + traversal                                                             |
| 2.5 threaded discussion                                                          | Done: comments + argument rebuttal chains                                                     |
| 2.6 stage transitions by community                                               | Open question 6                                                                               |
| 2.7 notifications                                                                | P1-8                                                                                          |
| 3.1–3.5 reputation, weighting, calibration, verified expertise, sybil resistance | P2 (seams in place)                                                                           |
| 4.1 roles and intents                                                            | Done: capacities on profiles + involvements                                                   |
| 4.2 matching                                                                     | P1-11 / P2                                                                                    |
| 4.3 implementation tracking                                                      | Done: initiatives + outcomes + lessons                                                        |
| 4.4 organisation accounts                                                        | P3-19                                                                                         |
| 5.x search, duplicates, AI, lenses, public API                                   | Lenses and OpenAPI done. Search upgrades, duplicates, AI: P1/P3                               |
| 6.x i18n, accessibility, durability, governance transparency                     | i18n: P1-10. Accessibility: WCAG 2.1 AA audited in CI. Durability: P3-18. Moderation log done |
