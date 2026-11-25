# Architecture

## Shape

A **modular monolith** in an npm-workspaces monorepo. One deployable process (the API, which also serves the built web
app), one PostgreSQL database, and packages with strict dependency direction:

```
packages/domain      pure TypeScript. Vocabulary, invariants, permission policy, provisional metrics.
      ▲              No I/O, no dependencies. Imported by the API, scripts and the web app (labels, limits).
      │
packages/i18n        → domain. Shared locale metadata, negotiation, and catalogue overlays.
packages/contracts   → domain. zod schemas, the endpoint catalogue, and the OpenAPI builder.
      ▲              The API boundary. The web app imports its types (not its runtime schemas).
      │
apps/api             Hono HTTP layer → module services → Drizzle → Postgres (or PGlite). Serves apps/web/dist.
apps/web             React SPA (Vite, TanStack Router + Query, SCSS modules). Uses i18n metadata and Lingui.
                     Talks to the API over /v1 only.
```

Around them: `scripts/` (dev runner, test runner with endpoint-coverage enforcement, API docs generator, doc link
checker), `audit/` (browser audit: Playwright e2e, axe accessibility, performance budgets, screenshots), `docs/` (`user/`, `developer/`
and `agents/` documentation; `developer/api-reference.md` and `developer/api/openapi.json` are generated from the
contract), `prompts/` (task briefs for agents), `docker-compose.yml` (the whole stack, or only PostgreSQL), `Dockerfile` (the product image), `.github/workflows/ci.yml`.

Inside `apps/api`:

```
src/http/            routes (thin: parse → call service → return DTO), input validation, error→status mapping
src/modules/<area>/  application services: authorization, invariants, transactions, ledger writes, DTO assembly
  shared/            context (Ctx), activity ledger, batch ref loaders, pagination, polymorphic target resolution
  metrics/           the ONLY writer of derived data
src/db/schema/       the relational model; src/db/client.ts opens PGlite or Postgres from a URL
drizzle/             SQL migrations (0000 generated from schema, 0001 hand-written history guards)
```

Modules: `identity` (accounts, sessions, profiles, expertise), `catalog` (topics, vocabulary), `ideas` (ideas,
revisions, stewardship, lifecycle, lenses), `knowledge` (claims, sources, evidence, arguments), `signals`
(evaluations, stances, involvements), `graph` (relations, traversal), `practice` (initiatives, outcomes),
`discussion` (comments), `moderation`, `history` (timelines, activity feed), `search`, `metrics`.

### Request flow

1. Middleware resolves the session (Bearer token or HttpOnly cookie) into an `Actor` and builds a `Ctx`
   (`{ db, actor, weights }`).
2. The route validates input with a `@ideaproxima/contracts` schema and calls one service function.
3. The service opens a transaction (`inTransaction`), checks `authorize(...)`, enforces domain rules from
   `@ideaproxima/domain`, writes the fact, writes any projection, appends to the activity ledger, refreshes derived
   metrics for affected ideas, and returns a DTO.
4. Errors are `DomainError`s with stable codes and reasons. `src/http/errors.ts` is the single place that maps codes to HTTP
   statuses. Postgres constraint violations that slip through (e.g. races) map to 409/422/400.

## Decision log (ADRs)

Each entry: the decision, why, and what would make us revisit it.

### ADR-1 PostgreSQL, replacing MongoDB

The domain is a **knowledge graph with strong integrity needs**: claims shared across ideas, evidence linked to
claims, typed idea-to-idea edges, evaluations that must reference real targets, append-only history. Postgres
gives us foreign keys, partial unique indexes (the "one current row" pattern), CHECK constraints generated from
the vocabulary, triggers that make history immutable, recursive CTEs for graph traversal, full-text search, and a
clear path to semantic search (pgvector). The MVP's MongoDB documents (mutable ideas with embedded history and
overwritten stats) could not provide these guarantees.
_Revisit if:_ never for the core. Add specialised stores (search index, graph analytics) beside it if needed.

### ADR-2 PGlite for local development and tests

PGlite is real Postgres compiled to WASM, running in-process. Local dev needs zero infrastructure
(`npm run dev` just works), and every integration test gets a fresh in-memory database running the **same SQL
migrations** as production. Production uses a real Postgres server; the driver is chosen by `DATABASE_URL`.
_Caveat:_ PGlite is single-connection, so concurrency behaviour (row locks, races) is only exercised on real
Postgres. That is why `npm run test:pg` and the CI `postgres` job run the whole suite on PostgreSQL 17. It is not
optional: it found real races that PGlite hid (ADR-16).

### ADR-3 Standalone HTTP API (Hono), not framework server actions

The MVP put logic behind Next.js server actions. The concept wants a public good: an open API for researchers and
integrations, and a UI that will be rebuilt. Hono exposes a standard `fetch` handler, so the same app can run as
a Node server, be mounted inside a frontend framework's route handler (TanStack Start, Next, …) for a single
deployable, or be tested with `app.request()` without opening a port.
_Revisit if:_ we need a different transport (GraphQL, gRPC). Add it beside, calling the same services.

### ADR-4 Drizzle ORM, no repository layer

Drizzle is a typed SQL builder. A repository abstraction over it would add indirection without value at this size.
Services use Drizzle directly. Complex reads (lenses, graph traversal, aggregates) are explicit SQL via
`sql` templates and `queryRows`. Migrations are generated SQL files committed to the repo; database guarantees
Drizzle cannot express live in hand-written migrations (`drizzle-kit generate --custom`).

### ADR-5 Three tiers of data: facts → projections → derived

- **Facts** (append-only): what happened. Authoritative forever.
- **Projections** (current state): `ideas.title/summary/tags/stage/current_revision_id`, `idea_topics`. Rewritten
  only by the service that appends the underlying fact, in the same transaction. They exist for querying.
- **Derived** (`idea_metrics`): computed by the metrics module, labelled with an algorithm, deletable and
  rebuildable.
  This is what lets the future scoring system evolve without a destructive redesign: it only ever replaces derived
  data.

### ADR-6 An activity ledger, not event sourcing

Every domain action appends an `activities` row (actor, action, subject, idea_ids, payload) in the same transaction
as the fact. It powers idea timelines, contribution histories, the public moderation log and future
notifications. State is _not_ rebuilt from the ledger. Facts live in their own well-typed tables, which keeps
queries simple and avoids event-sourcing complexity.

### ADR-7 Evaluations are long/narrow observations with exactly-one-FK targets

One row per (person, target, dimension, moment). Re-rating supersedes the previous row (`superseded_at`); a partial
unique index guarantees one _current_ row per (person, target, dimension). The target is exactly one of six typed
FK columns (real referential integrity) plus generated `target_kind`/`target_id` columns (uniform access for
scoring). Adding or retiring a dimension needs no migration.

### ADR-8 Claims are shared across ideas

A claim ("nanoscale devices can harvest energy from their medium") can underpin many ideas, and evidence attached
once informs all of them. This cross-idea sharing turns the archive into a knowledge graph a scientist can
navigate. The role a claim plays (premise, mechanism, prerequisite, consequence, risk) lives on the `idea_claims`
link, not on the claim.

### ADR-9 Lifecycle stage and epistemic maturity are different axes

Concept: imagined → developed → examined → tested → implemented → learned from (what has been _done_). The design's
"maturity" (speculative → research-supported → demonstrated) is what is _known_. The two are separate: the stage is
recorded through proof-backed transitions, and epistemic state is derived from claims and evidence.

### ADR-10 Stances are separate from evaluations

Stances are the concept's "community voting" (one signal: what people care about). Evaluations are deliberate
assessments. Separate tables make it structurally hard to let popularity leak into quality.

### ADR-11 Opaque cursors

Clients get `nextCursor` strings and never construct them. Metric-sorted lists use offsets internally (values shift
between requests anyway). Chronological streams use keyset positions (no skips or repeats as rows arrive). The
server can change strategy per endpoint without breaking clients.

### ADR-12 Server-side sessions, scrypt

Sessions are rows (only SHA-256 token hashes stored), so they are revocable (logout, moderation, compromise).
Passwords use Node's built-in scrypt with parameters stored in the hash. No native dependencies. Browser clients
use an HttpOnly SameSite=Lax cookie; other clients send `Authorization: Bearer`. JSON-only request bodies plus
SameSite cookies are the CSRF defence.

### ADR-13 UUIDv7 identifiers

Time-ordered (compact B-tree indexes, natural ledger ordering), globally unique across tables (polymorphic
references are unambiguous), generated in-process with a monotonic counter. Ideas also have human-readable slugs.
The API accepts either an id or a slug for `:idea`.

### ADR-14 The contract is executable: zod schemas for requests and responses, plus an endpoint catalogue

_(Revised 2026-11-15. Responses were TypeScript-only types at first.)_ Requests **and** responses are zod schemas
in `packages/contracts`, and `ENDPOINTS` declares every route once (method, path, access, query, body, response,
status). From that single source:

- the server validates requests;
- `buildOpenApiDocument()` produces OpenAPI 3.1, served at `/v1/openapi.json`;
- `npm run docs:api` generates `docs/developer/api-reference.md`;
- the test harness validates **every** successful response, exactly: the schema-parsed body must deep-equal the
  raw body, so undocumented extra fields fail too.

Tests also assert that catalogue and routes are identical and that the generated docs are fresh, and the runner
fails a full run if any catalogued endpoint is never exercised. Result: the API, its tests and its documentation
cannot drift apart. Client-side, schemas are non-strict (unknown fields ignored), so additive changes stay safe.
_Revisit if:_ the catalogue becomes a bottleneck. Generating routes from it would remove the remaining duplication
(path strings), at the cost of framework coupling.

### ADR-15 Metric refresh and consistency

By default, `refreshIdeaMetrics` recomputes the affected ideas inside the fact's transaction. In
`METRICS_REFRESH_MODE=async`, it enqueues one `metrics.refresh` per affected idea in that transaction
(ADR-23). A pending refresh covers subsequent writes. Writes during execution can enqueue a successor.
Both paths and the operator rebuild use the same computation and per-idea lock. It upserts changed values
and removes obsolete keys atomically. Unchanged rows keep their timestamps.

Async stance and evaluation responses still include the writer's current state. Idea signals and lens
rankings can lag until the worker catches up. `signals.computedAt` is the latest change timestamp among the
stored keys, or null before the first refresh. The rebuild command completes its work in either mode.

### ADR-16 Concurrency: advisory locks per logical key

Discovered by running the suite on real PostgreSQL (PGlite serialises everything and hid it): concurrent writes
failed with 409s. Two people voting at once collided in the metrics refresh (delete/insert of the same
`idea_metrics` rows), and a double-submitted idempotent PUT raced its own check-then-insert. Fix:
transaction-scoped advisory locks (`modules/shared/locks.ts`, `pg_advisory_xact_lock(hashtextextended(key))`):

- per (person, target) for evaluations, stances and involvements;
- per DOI/URL for "find or create" sources;
- per slug base for idea proposals;
- per idea for metric refreshes, acquired in sorted order to rule out deadlocks.

A refresh that waits then reads everything committed before it (READ COMMITTED takes a new snapshot per
statement), so the last refresh always sees all facts. The idea row lock for revisions and transitions is
`FOR NO KEY UPDATE`, so it no longer blocks inserts that merely reference the idea.
`apps/api/test/concurrency.test.ts` proves all of this under `npm run test:pg`.
_Revisit if:_ lock contention on very hot ideas becomes measurable. Move metric refresh to a queue (scaling notes).

### ADR-17 Abuse protection in the API process

Fixed-window, in-memory rate limits:

- authentication attempts per client address (default 10/min);
- writes per account, or per address when anonymous (default 120/min).

Also a request body limit (1 MiB) and JSON-only writes. Limits are per process. Multiple instances need a
shared limiter (proxy/WAF/Redis).

**2026-11-25 addendum.** After body validation and before session resolution, a network budget covers reads
and writes (600/min). Only tokens with the issued 43-character base64url shape trigger a lookup. Auth and
write budgets run next. Network keys use IPv4 addresses or IPv6 prefixes (default /64), with one fallback
bucket for invalid addresses. The socket peer is the default. Isolated origins may use a fixed trusted hop
count from the right or a single header their edge overwrites. Login verifies one hash even for missing or
deactivated accounts. Registration, login and password changes share three active scrypt slots and 32 waiting
slots by default. See the [configuration and proxy checklist](../developer/operations.md#configuration).

Plan 03 phase A adds a GCRA engine with named policies and bounded memory and shared PostgreSQL stores.
Session resolution computes trust in its existing query. Trust gates rate limits and pre-moderation only.
The PostgreSQL store charges a key atomically on the application pool so a rolled-back domain write still
spends its budget. Phase B connects the new engine to HTTP. The [policy table and measurements](production/03-rate-limiting.md#policies)
record the defaults and the store contract.

### ADR-18 Operator commands and explicit migrations

The production build bundles operator commands next to the server (`dist/migrate.js`, `seed.js`, `set-role.js`,
`rebuild-metrics.js`). A real PostgreSQL database is never migrated by an API instance at startup; migrating is a
release step, so instances cannot race. The first admin is appointed with `set-role.js`, a deliberate operator act
recorded in the public ledger with no actor, because no one exists yet who could do it through the API.

### ADR-19 Run the stack in containers; develop on the host

`docker compose up` runs every component from the production image: PostgreSQL, the one-off `migrate` job (ADR-18)
and the API. Anyone with only Docker can run the product, and "does it run" is answered by the artifact that is
deployed. CI starts that stack and smoke-tests it. The inner development loop stays on the host (`npm run dev` on
PGlite, or against the compose PostgreSQL): file watching across Windows and macOS bind mounts is slow and
unreliable, `node_modules` holds platform-specific binaries (esbuild) that differ between the host and a Linux
container, and debuggers and editors work best against local processes. A new component gets its own compose
service when it is a separate process; the web app is not (ADR-20), so the image and service stay single. A dev
container can be added if contributors ever need a fully reproducible toolchain; nothing requires one now.

### ADR-20 The web app: a SPA served by the API process

`apps/web` is a single-page application (React 19, TypeScript, SCSS modules, Vite). In production the API process
serves its build on the public listener outside `/v1` (`src/http/web.ts`): files are loaded into memory at startup,
compressed in the background (brotli/gzip, fast fallback on the first request), hashed assets are cached for a
year, and the HTML shell carries a CSP that allows its one inline script by hash. In development Vite serves the
app and proxies `/v1` to the API (`scripts/dev.ts` starts both). Consequences: one origin everywhere (no CORS, a
first-party HttpOnly session cookie, no token in JavaScript), one image, one public port.

Why a SPA and not SSR (Next, TanStack Start): the product is an interactive research tool whose pages are mostly
read-then-act; a SPA with per-route code splitting and data preloading on intent renders from cache on most
navigations, keeps the backend a plain HTTP API, and avoids a second server runtime. The cost is SEO and link
previews for idea pages; when that matters, prerender or server-render only `/ideas/:slug` (open question).

Inside: TanStack Query is the only state store (server state); TanStack Router gives type-checked links and search
parameters; every page is a lazy chunk and React/TanStack live in stable vendor chunks. The UI imports only _types_
from `@ideaproxima/contracts` and vocabularies from `@ideaproxima/domain`, so no zod reaches the browser and labels
never drift from the API. Forms rely on native constraints (limits from `LIMITS`) plus the API's field-level
validation errors. Narrative Markdown is rendered by micromark, which escapes raw HTML and drops dangerous URL
protocols. Quality gates: `apps/web/test` (pure logic) and `audit/` (Playwright flows, axe WCAG 2.1 AA in both
themes, first-visit budgets: JS ≤ 160 KB compressed, LCP ≤ 2.5 s, CLS ≤ 0.05).

### ADR-21 Request observability and the internal listener

One Zod configuration schema validates startup settings before opening the database or listeners. It
groups settings by owner and requires explicit production overrides for PGlite and insecure cookies.

The public app uses Pino events with an allowlist of fields. An inbound ID that matches
`^[A-Za-z0-9_-]{8,64}$` is echoed, and other requests receive a UUIDv7. The header, error envelope and logs
carry the same ID. Error events omit the exception object to avoid leaking credentials or query parameters.

One `prom-client` registry collects process metrics and application counters. Public HTTP labels are
bounded by the route definitions and a fixed set of methods. The optional `INTERNAL_PORT` listener
serves the registry separately from the public API and SPA, without publishing a Compose port.

### ADR-22 Readiness, process drain and database deadlines

Liveness checks that the process can answer HTTP. Readiness reads the newest Drizzle ledger entry and compares
its timestamp and hash with the bundled migration. It fails while draining, and concurrent probes share one
database check. This keeps the load balancer away from an unready process while the public `/v1/health` endpoint
continues to report database connectivity.

On termination the API fails readiness before closing its listeners. It lets active requests finish up to the
configured deadline before closing the database. The API passes database deadlines to `openDatabase()`.
Operator commands keep their existing driver defaults. The outermost transaction can retry a deadlock or
serialisation failure once after rollback, while savepoints leave the retry to the outer transaction.

The error reporter logs unexpected HTTP errors and fatal process errors using safe fields. An explicitly configured
Sentry destination can receive those fields through a bounded transport loaded at startup.

### ADR-23 Transactional background jobs

A service enqueues through its transaction's database handle. A rollback discards the job with its fact.
PostgreSQL and PGlite share the implementation. An atomic `FOR UPDATE SKIP LOCKED` claim gives a worker
a 60-second lease. Settlement and extension require the same worker, attempt and a live lease. Handlers
must tolerate redelivery after a crash between their side effect and completion.

A partial unique index coalesces pending work per kind and key. A running job can have a pending successor.
Enqueue, retry and recovery serialize entry into that index per key. An expired or unsuccessful attempt
can retire in favour of pending work. A schedule advances its database slot and enqueues in one transaction.
The API runs the poller inline by default. A dedicated worker uses the same registry and queue functions.
These tables hold disposable operational state. The domain fact and its history survive job retention.

### ADR-24 Product language is negotiated at the API boundary

English vocabulary and error source messages live in the domain. The i18n workspace overlays vocabulary strings
by stable key and formats precompiled ICU messages with Lingui. The contract depends only on the domain and
describes locale tags and coded errors. The API validates saved preferences against the supported locale list.

Catalogue reads and error messages resolve a supported query override, the signed-in account's preference,
then `Accept-Language` and English. Localised reads vary on `Accept-Language`, `Cookie` and `Authorization`.
Signed-in catalogue reads and all error responses are excluded from shared caches. Topic translations are
mutable catalogue rows. Idea references keep canonical topic names. An administrator's translation change
records its topic and locale in the ledger. [Localisation plan](production/05-localization.md)

The web app resolves the page's `?hl=` override, the local device preference, the account preference, the
browser languages and English. Vite compiles explicit ICU IDs and vocabulary overrides into one lazy chunk
per locale. English fallback messages use English plural rules. The document language and direction follow
the selected locale, and the content wrappers use bidirectional isolation until authored language metadata
is available. Topic reads use explicit locale parameters and locale-specific cache keys.

## How to extend safely

- **New vocabulary value** (stage, relation type, stance kind, …): add it in `packages/domain/src/vocabulary/*`,
  run `npm run db:generate` (the CHECK constraint changes), update tests and the relevant document in `docs/`.
- **New evaluation dimension:** add it to `DIMENSIONS` with `appliesTo` and a scale. No migration. If it applies to
  ideas, it automatically appears in `idea_metrics` as `rating.<key>` after a rebuild.
- **New endpoint:** add request/response schemas and an `ENDPOINTS` entry in `packages/contracts`, a service
  function in the owning module (authorize → transaction → `lockKey` if you check before writing → fact →
  projection → `recordActivity` → `refreshIdeaMetrics` if signals change), then a thin route. Add an integration
  test in `apps/api/test`, run `npm run docs:api`. Full recipe: `docs/developer/developer-guide.md`.
- **New table:** add it under `src/db/schema/`, export it from `index.ts`, `npm run db:generate`, and decide its
  category (fact / projection / derived / operational). If it is a fact, add it to the history guards in a new custom migration.
- **New derived metric or lens:** compute it in `modules/metrics/service.ts` (new metric key, same algorithm label,
  or a new algorithm label), and add a lens plan in `modules/ideas/queries.ts` plus `LENS_INFO` in the domain.
  Every lens must state honestly what it measures.
- **Never:** write derived values outside `modules/metrics`; add an UPDATE that rewrites a recorded fact; read
  popularity inside a quality metric; skip `recordActivity` on a domain write.

## Scaling notes (apply when needed, not before)

- Consider async refresh at sustained rates above five signal writes per second on one idea, or when write
  p95 exceeds 150 ms and PostgreSQL shows metric lock waits. Measure write-to-visible lag against the 2 s p95 target.
- Lens pagination is offset-based on materialised metrics. Switch hot lenses to keyset on `(value, idea_id)`.
- Evidence counts per idea are subqueries over `idea_claims` → `evidence`. Materialise them if idea pages slow down.
- Graph traversal is a recursive CTE capped at depth 4. Add a closure table or a graph-analytics sidecar only if
  deeper or global graph analytics are needed.
- Full-text search uses generated `tsvector` columns with GIN indexes. Semantic search plugs in as an additional
  query in `modules/search` (pgvector).
- Split a module into its own service only if a team boundary or scaling profile demands it. The module
  boundaries are already the seams.

## Security posture and known gaps

In place:

- sessions: hashed session tokens, revocable server-side sessions, password change revoking other sessions;
- credentials: scrypt passwords, uniform login error;
- requests: JSON-only bodies, body size limit, rate limits on authentication and writes, SameSite cookies,
  `secureHeaders`, optional CORS allow-list;
- authorization: one policy (including account moderation rules: moderators act on members, admins on anyone,
  nobody on themselves);
- moderation: hidden content excluded from public reads and the public feed, account deactivation.

Missing before public launch (see roadmap): email verification, password reset, OAuth/ORCID, a distributed rate
limiter for multi-instance deployments, and abuse heuristics. (Markdown is rendered safely in the web app: raw HTML is
escaped, dangerous protocols dropped; the HTML shell carries a strict CSP.)

## Verification

`npm run check` = typecheck (all packages, tests and scripts) + ESLint + Prettier check + documentation links +
tests + production build.
The tests are domain unit tests, API integration tests on in-memory Postgres (contract checks on every response,
enforced endpoint coverage) and web-app unit tests. `npm run test:e2e` runs the browser audit (ADR-20). `npm run test:pg` runs the same suite on PostgreSQL 17 (docker compose);
CI runs both, the browser audit, and the full Docker stack (ADR-19) with a smoke test. `npx drizzle-kit generate` in `apps/api` must report "No schema changes" on
a clean tree.
