# Developer guide

How to set up, understand, change and test Ideaproxima. The decisions behind the architecture, and the reasons
for them, are recorded in [`docs/agents/architecture.md`](../agents/architecture.md). This guide is the practical
companion.

## Contents

1. [Prerequisites and setup](#prerequisites-and-setup)
2. [Repository map](#repository-map)
3. [Architecture in brief](#architecture-in-brief)
4. [The web app](#the-web-app)
5. [API conventions](#api-conventions)
6. [Everyday commands](#everyday-commands)
7. [Common changes, step by step](#common-changes-step-by-step)
8. [Testing](#testing)
9. [Database and migrations](#database-and-migrations)
10. [Code conventions](#code-conventions)
11. [Troubleshooting](#troubleshooting)

## Prerequisites and setup

- **Node.js ≥ 22.18** (CI runs 22 and 24) and npm.
- **Docker** (optional): to run the whole stack in containers, to develop or test against a real PostgreSQL
  server, or to build the production image. Local development needs no database server: it uses
  [PGlite](https://pglite.dev), which is real Postgres compiled to WASM, running in-process.

```bash
npm install
npm run db:seed:demo   # migrations + base topics + an illustrative demo dataset (labelled fictional)
npm run dev            # → http://localhost:3000: the web app, with the API at /v1
```

`npm run dev` (`scripts/dev.ts`) runs two processes with prefixed output: the API on :3001 (`tsx watch`,
restarts on change) and, once the API is healthy, Vite on :3000 (hot module reload), which proxies `/v1` to the
API. The browser sees one origin, exactly as in production. Ctrl+C stops both. The API itself is documented at
`/v1` (its index), `/v1/openapi.json` and in the [API reference](api-reference.md).

Demo accounts: `demo-mira@demo.ideaproxima.invalid` (or any other `demo-*` handle) with password
`demo-password-123`. Local data lives in `apps/api/.data/pglite`. Delete that directory to start fresh.

Copy `apps/api/.env.example` to `apps/api/.env` to override configuration. The server and every script read it
when it exists (`src/load-env.ts`); variables already set in your shell take precedence. All variables are
documented in [operations.md](operations.md#configuration).

### Ways to run it

| Goal                                    | Command                                                                       | Database                                    |
| --------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| Develop (fastest loop)                  | `npm run dev`                                                                 | PGlite in `apps/api/.data/pglite`           |
| Try the production build locally        | `npm run build`, then `npm start` (one process on :3000)                      | PGlite in `apps/api/.data/pglite`           |
| Develop against real PostgreSQL         | `npm run db:up`, set `DATABASE_URL` in `apps/api/.env` (below), `npm run dev` | compose PostgreSQL, host port 5433          |
| Run the tests on real PostgreSQL        | `npm run db:up`, then `npm run test:pg`                                       | a throwaway database per test file          |
| Run the whole product as it is deployed | `docker compose up --build` (`--profile demo` adds demo data)                 | compose PostgreSQL (`postgres-data` volume) |

For the second row: `DATABASE_URL=postgres://ideaproxima:ideaproxima@localhost:5433/ideaproxima`, then
`npm run db:migrate` once (a real PostgreSQL server is never migrated on startup).

Code runs on the host during development and in containers for everything else
([ADR-19](../agents/architecture.md#adr-19-run-the-stack-in-containers-develop-on-the-host)). Containers mounting
the source tree make file watching slow on Windows and macOS, and esbuild's binaries differ between the host and
Linux. `docker compose up` and `npm run dev` both use port 3000: stop one, or move the container with
`APP_PORT=3001 docker compose up`.

### Dependency policy

- **Install scripts** are denied explicitly in the root `package.json` (`allowScripts`, npm ≥ 11): esbuild and
  `@parcel/watcher` (via sass) get their platform binaries through optional dependencies, and Vite never uses the
  watcher. The Docker build uses `--ignore-scripts` for the same reason. Approve a new entry only for a package that genuinely
  cannot work without its script.
- **The web app's packages are all `devDependencies`**: it is bundled at build time, so the production image
  installs none of them.
- **`overrides`** pin fixed versions of two vulnerable transitive dev tools until their parents update: esbuild
  under drizzle-kit's `@esbuild-kit/core-utils`, and minimatch under typescript-eslint. When `npm audit` stays
  clean without an entry (and `npm run check` plus `npm run db:generate` still pass), remove it.

## Repository map

```
concept.txt                    product concept — the highest authority for direction
packages/domain/               pure domain: vocabulary, invariants, permission policy, baseline metrics (no I/O)
  src/vocabulary/              stages, sections, claim roles/statuses, dimensions, stances, relation types, lenses…
  src/rules/                   content rules, lifecycle rules, relation rules, rating rules, permissions
  src/metrics/baseline.ts      provisional derived metrics ("baseline-v0") and the WeightPolicy seam
packages/contracts/            the API boundary
  src/requests.ts              zod request schemas (validated by the server, reusable by clients)
  src/responses.ts             zod response schemas (+ inferred types)
  src/endpoints.ts             the endpoint catalogue — every route, declared once
  src/openapi.ts               builds the OpenAPI 3.1 document from the above
apps/api/                      the HTTP API (also serves the built web app: src/http/web.ts)
  src/app.ts                   createApp(): middleware stack and route mounting
  src/main.ts                  Node server entry point
  src/config.ts                environment configuration
  src/db/schema/               the relational model (start at index.ts)
  src/db/client.ts             opens PGlite or PostgreSQL from a URL
  src/http/                    routes, input validation, error mapping, rate limiting
  src/modules/<area>/          application services, one folder per domain area
  drizzle/                     SQL migrations (0000 generated, 0001 hand-written history guards)
  scripts/                     migrate, seed, set-role, rebuild-metrics
  test/                        integration tests (real Postgres, real HTTP app)
apps/web/                      the web app (see "The web app" below)
audit/                         browser audit: Playwright e2e, axe accessibility, performance budgets, screenshots
scripts/                       repo tooling: dev runner, test runner, API docs generator, doc link checker
docs/user/                     documentation for users
docs/developer/                documentation for developers (this folder); api-reference.md and api/ are generated
docs/agents/                   documentation for AI agents: decisions, domain reasoning, open questions, roadmap
prompts/                       task briefs for agent work
Dockerfile                     the production image: web app + API in one process
docker-compose.yml             the whole stack (PostgreSQL → migrate job → app), or only PostgreSQL
.github/workflows/ci.yml       CI: check on Node 22/24, tests on PostgreSQL 17, browser audit, Docker stack smoke test
```

## Architecture in brief

A **modular monolith**: one API process, one PostgreSQL database. Dependencies point inward:

```
packages/domain  ←  packages/contracts  ←  apps/api (http → modules → drizzle → Postgres)
```

**Request flow.** Middleware resolves the session (Bearer token or HttpOnly cookie) into an `Actor` and builds a
`Ctx` (`{ db, actor, weights }`). A thin route validates input with a contract schema and calls one service
function. The service then, in order:

1. opens a transaction (`inTransaction`);
2. checks permissions (`authorize`);
3. enforces domain rules from `@ideaproxima/domain`;
4. writes the fact, and any projection;
5. appends to the activity ledger (`recordActivity`);
6. refreshes derived metrics for the affected ideas (`refreshIdeaMetrics`);
7. returns a DTO.

`DomainError` codes are mapped to HTTP statuses in one place (`src/http/errors.ts`).

**Data categories**

| Tier        | Examples                                                                                    | Rule                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Facts       | revisions, evaluations, stances, evidence, stage transitions, outcomes, the activity ledger | Append-only. Postgres triggers reject UPDATE/DELETE except supersession, withdrawal and moderation markers.          |
| Projections | `ideas.title/summary/stage/…`, `idea_topics`                                                | Current state for querying, rewritten only by the service that appends the underlying fact, in the same transaction. |
| Derived     | `idea_metrics`                                                                              | Written only by `modules/metrics`, labelled with an algorithm, disposable (`npm run metrics:rebuild`).               |
| Operational | sessions, jobs, schedule slots                                                              | Mutable service state. Keep durable domain history in facts and the ledger.                                          |

**Concurrency.** Writes that check before they insert (idempotent stances, ratings and involvements; "find or
create" sources; slugs) and metric refreshes take **transaction-scoped advisory locks** per logical key
(`modules/shared/locks.ts`). Revision publishing and stage transitions lock the idea row (`FOR NO KEY UPDATE`).
`apps/api/test/concurrency.test.ts` proves these under real parallelism on PostgreSQL.

More depth: [data model](../agents/data-model.md), [domain model](../agents/domain-model.md), [ADRs](../agents/architecture.md#decision-log-adrs).

## The web app

`apps/web` is a single-page application: React 19 and TypeScript, SCSS modules, built by Vite. In development
Vite serves it and proxies `/v1`; in production the API process serves the built files (`apps/web/dist`) from
memory, precompressed, with long-lived caching for hashed assets and a Content-Security-Policy. Either way the
browser sees one origin: no CORS, and a first-party session cookie
([ADR-20](../agents/architecture.md#adr-20-the-web-app-a-spa-served-by-the-api-process)).

```
apps/web/src/
  main.tsx          bootstrap: fonts, global styles, query client, router
  app/              route tree (lazy pages, loaders, search-param parsers), Shell (header, nav, footer), errors
  api/              data layer: http.ts (fetch + ApiError), keys.ts (query keys), one module per API area —
                    ideas, knowledge, signals, graph, practice, discussion, people, catalog, session — exporting
                    query options and mutation hooks
  ui/               design-system primitives with no domain knowledge: Button, Chip, Badge, Field, Dialog, Meter,
                    Dropdown, InfoTip, Segmented, Toast, Avatar, Logo, Feedback (skeleton, empty, error)
  components/       domain components shared by pages: IdeaCard (tile and row), Stage (badge, progress), Ratings,
                    status badges, Markdown, RelationGraph, EvaluateDialog, ModerateButton, ActivityFeed (icons,
                    day headings, folded repeats), PageHeader, knowledge/ (claims, evidence, arguments)
  pages/<area>/     one folder per route, each a lazy-loaded chunk: home, explore, idea (layout + six tabs), editor,
                    topics, knowledge (claim, source), people, search, activity, about, auth
  lib/              pure helpers: format, vocabulary, diff, markdown, graph-layout, activity (folding), topic-icons,
                    theme, hooks
  styles/           _tokens.scss (palettes, type and spacing scales), _mixins.scss, global.scss
apps/web/test/      unit tests of the pure helpers (part of npm test)
```

Dependencies point one way: `pages → components → ui → lib`, and anything may use `api/`. `ui/` never imports
`api/` or `components/`.

**Data.** Server state lives in TanStack Query; there is no other global store. Each API module exports query
options (`ideaQueries.detail(slug)`) and mutation hooks built on `useApiMutation(fn, invalidates, meta)`, which
refreshes the query keys it lists. Keys are hierarchical (`["idea", slug, "claims"]`), so invalidating
`keys.idea(slug)` refreshes an idea and everything under it. Error and success toasts are global; a form that shows
field errors passes `meta: { inlineErrors: true }` and reads `ApiError.fieldErrors`. Only _types_ are imported from
`@ideaproxima/contracts`, so no zod reaches the bundle; labels, limits and vocabularies come from
`@ideaproxima/domain`.

**Routing.** TanStack Router with a code-based tree (`app/router.tsx`). Every page is `lazyRouteComponent(...)`;
loaders `ensureQueryData` what a page needs and also run on link hover or focus (`defaultPreload: "intent"`), so
most navigations render from cache. Search parameters go through small parsers in `app/search-params.ts` that keep
only known values (and accept only same-site post-login redirects). Components read parameters with
`getRouteApi("/ideas/$idea")` or `useSearch({ from })`. Pages that need an account use `beforeLoad:
requireSession`; actions that need one go through `useAuthGate()`, which sends visitors to sign in and back.

**Styling.** One SCSS module per component. Colours are CSS custom properties from `_tokens.scss`, with light and
dark palettes tuned separately; `html[data-theme]` overrides the OS preference. Use tokens, never raw colours, and
`@use "mixins" as *;` for breakpoints (`up(md)`), `focus-ring`, `serif`, `eyebrow` and `card`. Status colours
(`--status-*`) always come with a label and an icon. Text colours meet WCAG AA in both themes; the browser audit
checks this.

**UI conventions** (from the audit-driven redesign of 2026-11-16):

- One display size — the home hero and an idea's title. Every other page uses `PageHeader` (the index size), so
  content starts on the first screen.
- Below `MIN_RATINGS_FOR_CONFIDENCE` evaluations a measure shows "too early" with dots (`Dots`, ●○○ = 1 of 3), never
  a bar: absence of data must not look like a low score, and the dots say what would change it.
- Show only the facts that exist: no "0 claims" or "☆ 0"; empty states say what would fill them and link there.
- One idea component (`IdeaCard`, `layout="card" | "row"`) everywhere; attention (★) stays apart from quality.
- Feeds go through `ActivityFeed`: an icon per kind of action, day headings for long feeds, and consecutive
  identical actions folded (`lib/activity.ts`) — presentation only, the ledger is unchanged.

**What the UI must never do** (from the concept): compute rankings, statuses or scores itself; show a rating without
its number of raters and its spread; show "too early to tell" as anything else; combine attention (counts) and
assessed quality (meters) or make them look alike; show missing data as zero.

**Adding a page.** Create `pages/<area>/XPage.tsx` and its `.module.scss`, add a route in `app/router.tsx` with
`lazyRouteComponent` and a loader for its main query, and link to it with `<Link to="/x">` (checked by the type
system). Add it to `audit/e2e/screenshots.spec.ts` and, for a main page, to `accessibility.spec.ts`.

## API conventions

The complete, generated list of endpoints and shapes is the [API reference](api-reference.md). The OpenAPI document
is [`api/openapi.json`](api/openapi.json) and is also served live at `GET /v1/openapi.json`.

- **Base path `/v1`.** JSON in and out. Write requests must send `Content-Type: application/json`; this is also a
  CSRF defence. Request bodies are limited to 1 MiB by default.
- **Authentication.** `POST /v1/auth/register` and `/auth/login` return `{ person, token, expiresAt }` and set an
  HttpOnly, SameSite=Lax cookie `ip_session`. Browsers rely on the cookie; other clients send
  `Authorization: Bearer <token>`. Sessions are server-side and revocable.
- **Resources and actions.** Reads are resource-oriented. Writes are named domain operations (propose a revision,
  decide on it, transition a stage, withdraw evidence, retract a relation). There is no generic update of an idea:
  content changes are revisions, and stage changes are transitions.
- **Identifiers.** Resources are identified by UUIDs. Path parameters named after a resource (`:claim`,
  `:revision`, `:evidence`, …) must be UUIDs; anything else is a 404. `:idea` accepts an id or a slug, people are
  addressed by `:handle`, topics by `:slug`, and stances/involvements by their vocabulary key (`:kind`,
  `:capacity`).
- **Errors** use `{ "error": { "code", "message", "details"?, "requestId"? } }`. The API echoes a valid
  `X-Request-Id` or generates a UUIDv7 and sends it in the response header and error envelope.

  | Status | `code`               | Meaning                                                                                   |
  | ------ | -------------------- | ----------------------------------------------------------------------------------------- |
  | 400    | `validation_failed`  | Malformed input. `details.issues[{ path, message }]` lists problems.                      |
  | 401    | `unauthenticated`    | No valid session (or wrong credentials on login).                                         |
  | 403    | `forbidden`          | Signed in, but not allowed.                                                               |
  | 404    | `not_found`          | No such resource, or hidden by moderation.                                                |
  | 405    | `validation_failed`  | A Hono handler rejected the HTTP method.                                                  |
  | 409    | `conflict`           | Duplicate, or concurrent modification (revisions return `details.currentRevisionId`).     |
  | 413    | `payload_too_large`  | Request body over the limit.                                                              |
  | 422    | `invariant_violated` | Well-formed but breaks a domain rule (e.g. a stage without proof; `details.requirement`). |
  | 429    | `rate_limited`       | Too many requests. `Retry-After` header and `details.retryAfterSeconds`.                  |
  | 500    | `internal_error`     | Unexpected failure, correlated with the request ID in the logs.                           |
  | 503    | `unavailable`        | Hash queue full, database timeout or retry exhausted. Retry after `Retry-After` (1 s).    |

- **Pagination.** Lists return `{ items, nextCursor }`. Pass `cursor` back unchanged; `limit` is 1–100 (default
  20). Cursors are opaque: metric-sorted lists use offsets internally, chronological streams use keysets, and
  this can change per endpoint without breaking clients. Offsets above 10,000 return 400
  `validation_failed`. Narrow the list with a filter and start a new page sequence.
- **Idempotency.** `PUT`/`DELETE` of stances and involvements are idempotent, even under concurrent double
  submission. Repeating an identical evaluation is a no-op (`changed: []`). Registering a source whose DOI/URL
  already exists returns it (200 rather than 201).
- **Optimistic concurrency.** Publishing a revision requires `baseRevisionId` to be the current revision.
  Otherwise the response is 409.
- **Derived values** live under `signals` / `derived`, carry `algorithm`, and are `null`/absent when there is no
  data. Never present them as recorded facts.
- **Versioning.** Additive changes (new fields, endpoints) stay in v1, and clients must ignore unknown fields.
  Breaking changes would be served as `/v2` alongside v1.

### Logging

Use the process logger in `apps/api/src/observability/logger.ts`. Request events use the matched route pattern
and an authenticated actor's ID. Keep raw paths, headers, cookies, bodies, search terms, e-mail addresses and
client network keys out of logs. Unexpected errors use a fixed message, the request ID and any SQLSTATE.
Keep exception objects, error strings, stacks, SQL and database parameters out of those events.
Report unexpected 500s and fatal process errors through `ErrorReporter`. The optional transport receives
the same redacted fields.

### Transaction retries

`inTransaction()` replays the entire outer transaction once after a deadlock or a serialisation failure,
with 20–50 ms of jitter. Nested calls create savepoints. Keep irreversible I/O outside transaction callbacks
so replaying a callback only repeats work that PostgreSQL rolled back.

## Everyday commands

| Command                                                 | Purpose                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`                                           | Web app on :3000 (Vite, hot reload) + API on :3001 (restarts), `/v1` proxied        |
| `npm run check`                                         | **Definition of done:** typecheck + lint + format check + doc links + tests + build |
| `npm test`                                              | All tests on PGlite, with contract and endpoint-coverage checks                     |
| `npm run test:pg`                                       | All tests on PostgreSQL (`npm run db:up` first)                                     |
| `npm run test:watch`                                    | Vitest watch mode (no coverage enforcement)                                         |
| `npm run test:e2e`                                      | Build, then the browser audit: e2e flows, accessibility, performance budgets        |
| `npm run audit:screenshots`                             | Build, then every page in desktop/mobile × light/dark (`audit/artifacts`)           |
| `npm test -- apps/api/test/ideas.test.ts`               | A subset                                                                            |
| `npm run typecheck` / `npm run lint` / `npm run format` | Static checks / auto-format                                                         |
| `npm run docs:api`                                      | Regenerate `docs/developer/api-reference.md` and `docs/developer/api/openapi.json`  |
| `npm run docs:check`                                    | Verify every relative link and `#anchor` in the Markdown documentation              |
| `npm run db:generate`                                   | Generate a migration after changing `apps/api/src/db/schema`                        |
| `npm run db:migrate`                                    | Apply migrations to `DATABASE_URL`                                                  |
| `npm run db:seed` / `db:seed:demo`                      | Base topics / plus demo data                                                        |
| `npm run metrics:rebuild`                               | Recompute all derived metrics from facts                                            |
| `npm run admin:set-role -- <handle> <role>`             | Operator: set a person's role (e.g. appoint the first admin)                        |
| `npm run db:up`                                         | Start the docker-compose PostgreSQL (port 5433)                                     |
| `docker compose up --build`                             | The whole stack in containers on port 3000 (`--profile demo` adds demo data)        |
| `npm run build` / `npm start`                           | Build `apps/web/dist` + `apps/api/dist` / run them: one process on :3000            |

## Common changes, step by step

### Add a job

1. Define the payload schema with zod and the handler in the module that owns the work. Register it once
   with `jobRegistry.register(kind, schema, handler)` in `modules/jobs/registry.ts` for both the inline and dedicated worker.
   The handler receives `(ctx, parsedPayload, claim)`. Use fixed kind and queue names for metric labels.
2. Call `await enqueue(tx, { kind, payload, dedupeKey })` inside the fact's existing transaction.
   Supply a dedupe key when one pending execution can cover every write for that key. The return value is
   the inserted UUID or `null` when coalesced. Set `queue`, `priority`, `runAt` or `maxAttempts` as needed.
3. Make the effect idempotent across retries. For work lasting over 60 seconds, call
   `await extendLease(ctx, claim)` before expiry and stop if ownership is lost. For a recurring kind,
   add a schedule with a unique name and a positive interval in milliseconds to `modules/jobs/schedules.ts`.
4. Test the write rolling back, run the handler twice against the same effect, and call `await drainJobs(ctx)`
   before asserting results. Named queues can be passed as the third argument. Use PostgreSQL to prove races.

### Add an endpoint

1. **Contract** (`packages/contracts`): a request schema in `requests.ts` (register body schemas in
   `requestRegistry` at the bottom). Reuse or add a response schema in `responses.ts` (wrap it in `named(...)` if
   it should be a named component).
2. **Catalogue**: an entry in `ENDPOINTS` (`endpoints.ts`) with method, path, tag, summary, `auth`, `who`, query,
   body, response, status and notable errors.
3. **Service** in the owning module: `authorize` → `inTransaction` → domain rules (and `lockKey` if you check
   before writing) → write the fact → projections → `recordActivity` → `refreshIdeaMetrics` if an idea's signals
   change → return the DTO.
4. **Route** in `apps/api/src/http/routes/*`: parse with `jsonBody`/`queryOf`/`uuidParam`, call the service,
   return the DTO with the documented status.
5. **Test** in `apps/api/test` through `createHarness()`. Responses are contract-checked automatically.
6. `npm run docs:api`, then `npm run check`.

The suite fails if a route is missing from the catalogue (or vice versa), if a response does not match its schema
exactly, if the generated docs are stale, or if a catalogued endpoint is never exercised.

### Change the database schema

1. Edit `apps/api/src/db/schema/*.ts`. Decide the tier of anything new: fact, projection or derived.
2. `npm run db:generate` creates `apps/api/drizzle/NNNN_*.sql`. Review it. **Never edit an applied migration.**
3. For a new **fact** table, protect it: `cd apps/api && npx drizzle-kit generate --custom --name=<name>`, then add
   `ip_forbid_change` / `ip_guard_columns(...)` triggers as in `0001_history_guards.sql`.
4. Tests apply all migrations to fresh databases, so a broken migration fails the suite.

### Add a vocabulary value (stage, relation type, stance kind, …)

Edit `packages/domain/src/vocabulary/*`. Database CHECK constraints are generated from the same constants, so run
`npm run db:generate` and commit the migration. Update tests, `npm run docs:api`, and the user guide if the
meaning changed.

### Add an evaluation dimension

Add it to `DIMENSIONS` (`packages/domain/src/vocabulary/signals.ts`) with `appliesTo`, a question and a scale. No
migration is needed. Dimensions applying to ideas appear in `idea_metrics` as `rating.<key>`.

### Add a derived metric or a lens

Compute metrics only in `apps/api/src/modules/metrics/service.ts`, under the algorithm label. Add the lens to
`LENS_KEYS`/`LENS_INFO` (with an honest description of what it measures) and its query plan in
`apps/api/src/modules/ideas/queries.ts`. Never read stances (popularity) inside a quality metric.

## Testing

| Layer                 | Where                            | What it protects                                                                                                            |
| --------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Domain unit tests     | `packages/domain/test`           | Vocabulary integrity, lifecycle and relation rules, rating validation, the permission matrix, baseline metrics, text rules. |
| API integration tests | `apps/api/test`                  | Real HTTP app + real Postgres: validation, authorization, services, SQL, constraints, history triggers, concurrency.        |
| Contract checks       | `apps/api/test/harness.ts`       | Every successful response equals its schema-parsed form; every call hits a catalogued endpoint; errors use the envelope.    |
| Catalogue and docs    | `apps/api/test/contract.test.ts` | Catalogue ↔ routes identical; OpenAPI references resolve; generated docs are current.                                       |
| Endpoint coverage     | `scripts/run-tests.ts`           | A full run fails if any catalogued endpoint was never exercised.                                                            |
| Web unit tests        | `apps/web/test`                  | The web app's pure logic: line diff, Markdown safety and claim anchors, graph layering, URL parsing, error messages.        |
| Browser audit         | `audit/e2e`                      | Real Chromium against the production build: reading and contribution flows, axe WCAG 2.1 AA in both themes, budgets.        |

**Two databases.** By default each test file boots an in-memory PGlite and runs every migration (fast, no
infrastructure). `npm run test:pg` runs the same suite against PostgreSQL 17 (docker compose): each test file
creates and drops its own database there. Only real Postgres exercises multiple connections, row locks, advisory
locks and real races, so run both before changing transactions or locking. Point at another server with
`TEST_DATABASE_URL=postgres://user:pass@host:port/postgres` (the user needs `CREATEDB`).

**Writing a test:**

```ts
import { afterAll, beforeAll, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

it("does the thing", async () => {
  const alice = await h.user("alice"); // registers; returns { token, id, handle }
  const idea = await h.idea(alice.token, { title: "An idea title" });
  const res = await h.call("PUT", `/ideas/${idea.id}/stances/important`, { token: alice.token });
  expect(res.status).toBe(200); // the body was already contract-checked
});
```

`h.user(handle, "moderator" | "admin")` creates privileged users. `createHarness({ rateLimits: … })` overrides
configuration. `h.db` gives direct database access for asserting on facts and triggers.

**The browser audit** (`npm run test:e2e`) is separate from `npm test` because it needs a build and a browser.
Run it before finishing UI work; [`audit/README.md`](../../audit/README.md) explains the specs and how to write
one.

## Database and migrations

- **Local:** PGlite files in `apps/api/.data/pglite`, migrated automatically on `npm run dev`. Reset by deleting
  the directory.
- **Local PostgreSQL:** `npm run db:up`, then in `apps/api/.env`:
  `DATABASE_URL=postgres://ideaproxima:ideaproxima@localhost:5433/ideaproxima`, followed by `npm run db:migrate`
  and `npm run db:seed:demo`. A real server is **not** migrated on startup; migrating is an explicit step.
- **Inspect:** `docker compose exec postgres psql -U ideaproxima`.
- **Drift check:** `cd apps/api && npx drizzle-kit generate` must report "No schema changes" on a clean tree (CI
  enforces this).

## Code conventions

- TypeScript strict mode with `noUncheckedIndexedAccess`; type-only imports (`import type`) are enforced by ESLint.
- **Vocabulary lives in `@ideaproxima/domain`.** Never duplicate stage names, dimensions etc. elsewhere.
- **Every permission decision goes through `authorize()`** (`packages/domain/src/rules/permissions.ts`).
- **Every domain write records an activity** in the same transaction. Every write that changes an idea's signals
  calls `refreshIdeaMetrics`.
- **Never** update or delete recorded facts (the triggers will refuse anyway), write derived values outside
  `modules/metrics`, or fold popularity into quality.
- Services throw `DomainError(code, message, details?)`. Routes never build error responses themselves.
- No repository layer: services use Drizzle directly. Complex reads are explicit SQL (`sql` + `queryRows`).
- Comments explain _why_. The documents in `docs/agents/` record decisions; update them when you change one.

## Troubleshooting

| Symptom                                                  | Cause / fix                                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `docs/developer/api-reference.md is stale`               | You changed a schema or the catalogue: `npm run docs:api`.                                                |
| `X answered 200 but is not in the endpoint catalogue`    | Add the route to `ENDPOINTS`.                                                                             |
| `response contains fields that are not in its contract`  | Add the field to the response schema (and regenerate docs), or stop returning it.                         |
| `Endpoint coverage: … never exercised`                   | Add a test calling that endpoint.                                                                         |
| `restrict_violation … append-only`                       | Code tried to rewrite a recorded fact. Supersede, withdraw or hide instead.                               |
| `npm run test:pg` cannot connect                         | `npm run db:up` and wait for the container to be healthy (`docker compose ps`).                           |
| PGlite error about its data directory                    | Another process (e.g. a running `npm run dev`) holds `apps/api/.data/pglite`; stop it.                    |
| Formatting fails on Windows                              | Line endings: the repo enforces LF via `.gitattributes`; run `npm run format`.                            |
| `npm warn install-scripts` during install                | A new dependency ships an install script. Decide it explicitly ([dependency policy](#dependency-policy)). |
| `port is already allocated` / `EADDRINUSE :3000`         | `npm run dev` and the compose app both want 3000. Stop one, or `APP_PORT=3001 docker compose up`.         |
| `localhost:3000` refuses to connect during `npm run dev` | Vite listens on 127.0.0.1. Open `http://127.0.0.1:3000` if your system resolves localhost to IPv6 only.   |
| `npm start` shows an old interface                       | The server reads `apps/web/dist` at startup: `npm run build`, then restart it.                            |
| Playwright asks for a browser                            | `npx playwright install chromium` (once).                                                                 |
