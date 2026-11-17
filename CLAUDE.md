# CLAUDE.md

Guidance for AI agents working in this repository. It is loaded into every session, so it stays short and
points to the documents that hold the detail. If something here is no longer true, fix it in the same change.

## What this is

Ideaproxima is an open repository of humanity's possible futures: people propose ideas, and others develop,
evidence, challenge and evaluate them while the platform keeps the full history.
[`concept.txt`](concept.txt) is the product concept and the highest authority. When a document or the code
disagrees with it, the concept wins.

One deployable process and one PostgreSQL database, in an npm-workspaces monorepo:

```text
packages/domain      pure TypeScript: vocabulary, invariants, permission policy. No I/O
packages/contracts   zod request and response schemas, the endpoint catalogue, the OpenAPI builder
apps/api             Hono → module services → Drizzle → PostgreSQL (PGlite in development and tests)
apps/web             React 19 single-page app (Vite, TanStack Router and Query, SCSS modules), served by the API
```

## Read before changing anything

1. [`docs/agents/README.md`](docs/agents/README.md): the reading order, the
   [non-negotiables](docs/agents/README.md#non-negotiables-do-not-change-casually) and the
   [definition of done](docs/agents/README.md#definition-of-done-for-any-change).
2. [`docs/developer/developer-guide.md`](docs/developer/developer-guide.md): set-up, conventions and
   [step-by-step recipes](docs/developer/developer-guide.md#common-changes-step-by-step) (add an endpoint, change
   the schema, add a vocabulary value).
3. For work on the production-readiness program:
   [`docs/agents/production/README.md`](docs/agents/production/README.md).

## Commands

| Command                                   | Use                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run dev`                             | Web app on :3000 and API on :3001, `/v1` proxied; data in `apps/api/.data/pglite`                         |
| `npm run db:seed:demo`                    | Migrations, base topics and the demo dataset (once, for a fresh local database)                           |
| `npm run check`                           | **Definition of done**: typecheck, lint, format check, doc links, tests, build                            |
| `npm test`                                | All tests on PGlite, with contract and endpoint-coverage checks                                           |
| `npm test -- apps/api/test/ideas.test.ts` | One file (endpoint coverage is only enforced on full runs)                                                |
| `npm run test:pg`                         | The same suite on PostgreSQL 17 (`npm run db:up` first); needed after SQL, locking or transaction changes |
| `npm run test:e2e`                        | Build, then the browser audit; needed after interface changes                                             |
| `npm run docs:api`                        | Regenerate the API reference and OpenAPI after any contract change                                        |
| `npm run db:generate`                     | Generate a migration after editing `apps/api/src/db/schema`                                               |
| `npm run format`                          | Prettier, which also checks Markdown                                                                      |

PGlite runs on one connection, so races only show under `npm run test:pg`.

## Rules the tests and the database enforce

- **Recorded facts are append-only.** Database triggers reject `UPDATE` and `DELETE` on them. Supersede,
  withdraw, retract or hide instead. A new fact table gets a guard in a hand-written migration.
- **The contract leads.** Every route is declared once in `packages/contracts/src/endpoints.ts`. Responses must
  match their schemas exactly, every endpoint must be exercised by a test, and the generated reference must be
  fresh. Change the contract first, then the service, the route and the test.
- **A domain write follows one shape:** `authorize()` → `inTransaction()` → domain rules → the fact →
  `recordActivity()` → `refreshIdeaMetrics()` when signals change. A check followed by a write needs `lockKey()`.
- **Derived data has one writer and is rebuildable.** Only `modules/metrics` writes `idea_metrics`.
- **Popularity is not quality.** Stances never enter a quality metric. Missing data is `null`, never `0`.
- **One vocabulary, one permission policy, one error mapping**, all in `packages/domain` and
  `apps/api/src/http/errors.ts`. Services throw `DomainError`; routes never build error responses.

## How work is organised: one phase per session

The production-readiness program is thirteen plans, each split into phases. **A session implements one phase
of one plan**, then stops. The full protocol is
[How a session works](docs/agents/production/README.md#how-a-session-works); in short:

1. The owner names a prompt, for example `prompts/api/03-rate-limiting-prompt-sketch.md`, and optionally a
   phase. Without one, take the first phase the plan does not mark as done.
2. Read what the prompt lists, check on the
   [status board](docs/agents/production/README.md#status-board) that the dependencies are done, re-verify the
   facts the prompt states, and run `npm run check` for a baseline.
3. Stay inside the phase. Report work that belongs elsewhere instead of doing it.
4. Hand over in the repository, because the next session starts with no memory of this one: the plan's status
   line, the status board, measurements in the plan's tables, and deviations under `## Implementation notes`
   at the end of the plan.

Why a phase and not a whole plan: a phase is sized to fit one context window with room to read the code it
touches; most phases end at a gate that an agent cannot pass alone (the owner approving a mock-up or a policy,
a measurement, a soak period); and milestones are built from phases of several plans, not from whole plans.

## Working with the owner

- **Interface changes are previewed.** A larger change to the web app is first a static mock-up in `designs/`.
  Wait for approval before implementing it.
- **Decisions that belong to the owner are not made by an agent.** Build with the documented default and list
  the decision ([the open ones](docs/agents/production/README.md#decisions-for-the-owner)).
- **Keep the documents true.** Update the document that records a decision in the same change. Documentation
  is organised by audience: `docs/user/`, `docs/developer/`, `docs/agents/`.
- **Commit only when asked.** Then: directly on `main`, in logical commits with conventional messages
  (`feat(web): …`, `fix(api): …`, `docs(agents): …`), and never push.
- **Local folders stay local:** `prompts/`, `designs/`, `temp-reference-folder/` and `models/` are git-ignored.
  Never force-add or delete them. `prompts/` holds only prompt sketches.

## Things that will surprise you

- `npm run docs:check` verifies every relative link and `#anchor` in every Markdown file, this one included.
  In tracked documents, name files under `prompts/` as inline code, not as links: the folder is git-ignored and
  absent from a clean checkout, where a link to it would fail the check.
- Generated files are never edited by hand: `docs/developer/api-reference.md`, `docs/developer/api/openapi.json`
  and the migrations Drizzle generated. Applied migrations are never edited at all.
- In raw SQL, qualify every column with its table. Drizzle renders a single-table select's column bare, and
  inside a correlated subquery it silently binds to the inner table.
- Dependencies are pinned for reasons (TypeScript `~5.9`, PGlite `^0.3.16`, Playwright `1.63.0`, Node ≥ 22.18).
  Read the [dependency policy](docs/developer/developer-guide.md#dependency-policy) before adding or upgrading
  a package.
- The development server listens on `127.0.0.1`. `npm run dev` and `docker compose up` both want port 3000.
- For container smoke tests use a separate compose project and ports (`docker compose -p ipx-smoke …` with
  `APP_PORT` and `POSTGRES_PORT`), so a developer's running stack and its data are untouched.
- Write code that contains template literals or backslashes with the file-editing tools, not with shell
  heredocs, which mangle them.
- Do not append to files with PowerShell redirection (`>>`). Windows PowerShell 5.1 can write UTF-16, which
  corrupts a UTF-8 file: the root `README.md` once ended with such a line, and `npm run check` failed on it.
  Use the file-editing tools, or pass `-Encoding utf8`.
