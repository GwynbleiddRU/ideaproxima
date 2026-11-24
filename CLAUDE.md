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

## Code quality

- Make the change easy for the next maintainer to trace from the entry point to the result. Use domain names,
  explicit control flow and the existing service or helper that owns the behaviour.
- Keep work proportional to the input. Look for repeated queries, unbounded reads and blocking work on the
  request path. For a performance claim, record the before-and-after measurement on the same workload.
- Preserve supported callers and existing data. Test the normal path and the failure most likely to break
  the invariant, including rollback, retry or concurrency where applicable. Review the final diff for
  unnecessary complexity and missing checks.

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

## How work is organised: one step per session

The production-readiness program is fifteen plans (`00`–`14`), each split into phases, and run as **one
sequence of steps**: one step is one phase of one plan, and steps run strictly one after another. **A session
implements one step**, then stops. The full protocol is
[How a session works](docs/agents/production/README.md#how-a-session-works); in short:

For Codex, use the [kickoff and model guide](docs/agents/production/codex-handoff.md).

1. "Do the next step" means the first numbered row of the
   [sequence](docs/agents/production/README.md#sequence-and-status) that is not "Done". Its prompt is
   `prompts/api/NN-<name>-prompt.md` for its plan `NN`.
2. Verify the preceding numbered steps (or the documented post-launch trigger for T1/T2), read what the prompt lists (including the plan's
   `## Implementation notes` left by earlier steps), re-verify the facts the prompt states, and run
   `npm run check` for a baseline.
3. Stay inside the step. Report work that belongs elsewhere instead of doing it.
4. Hand over in the repository, because the next session starts with no memory of this one: the step's row in
   the sequence, the plan's status line, measurements in the plan's tables, and deviations under
   `## Implementation notes` at the end of the plan. Commit the step and its evidence together. End the
   reply with the [next-chat handoff](docs/agents/production/codex-handoff.md#hand-off-to-the-next-chat).

Why a phase and not a whole plan: a phase is sized to fit one context window with room to read the code it
touches; most phases end at a gate that an agent cannot pass alone (the owner approving a mock-up or a policy,
a measurement, a soak period); and the sequence interleaves phases of different plans so that each finds what
it depends on already in place. Never run two steps at once.

## Working with the owner

- **Interface changes are previewed.** A larger change to the web app is first a static mock-up in `designs/`.
  Wait for approval before implementing it.
- **Decisions that belong to the owner are not made by an agent.** Build with the documented default and list
  the decision ([the open ones](docs/agents/production/README.md#decisions-for-the-owner)).
- **Keep the documents true.** Update the document that records a decision in the same change. Documentation
  is organised by audience: `docs/user/`, `docs/developer/`, `docs/agents/`.
- **Each production-program session has standing approval to commit its own work** locally on `main`. Use
  a conventional message and preserve unrelated changes, including staged ones. Other tasks require an
  explicit commit request. Pushing and production actions require separate owner authorization.
- **Local folders stay local:** `designs/`, `temp-reference-folder/` and `models/` (all but its
  `manifest.json`) are git-ignored. Never force-add or delete them.
- **`prompts/` holds only task briefs for agents:** a `*-prompt.md` has been checked against the code and is
  ready to hand over; a `*-prompt-sketch.md` is still a draft or a record. Whether the folder is published is
  the owner's choice; do not change its line in `.gitignore`.

## Things that will surprise you

- `npm run docs:check` verifies every relative link and `#anchor` in every Markdown file, this one included.
  In documents outside `prompts/`, name files under `prompts/` as inline code, not as links, so the check
  passes whether or not the folder is published.
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
