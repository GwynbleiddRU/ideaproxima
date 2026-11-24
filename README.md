# Ideaproxima

A persistent, open repository of humanity's possible futures: a knowledge system where ideas are proposed,
developed, examined, tested, implemented and learned from, and where scientists, engineers and funders can find
ideas _and what they are connected to_.

- **Facts are never rewritten.** Revisions, ratings, evidence and stage changes are append-only, enforced by the
  database.
- **Popularity is not quality.** Attention and multi-dimensional evaluations are separate signals, never combined
  into one score.
- **Knowledge, not posts.** Ideas are made of shared claims, evidence with stated limitations, arguments, typed
  relations to other ideas, and recorded real-world initiatives and outcomes.

The product concept is in [concept.txt](concept.txt).

## Quick start

`http://localhost:3000` is the application: the web interface, with the API under `/v1` on the same origin.

**For development** (Node.js ≥ 22.18; no database server needed, the API runs [PGlite](https://pglite.dev),
PostgreSQL compiled to WASM, in-process):

```bash
npm install
npm run db:seed:demo   # migrations + base topics + an illustrative, clearly-labelled demo dataset
npm run dev            # → http://localhost:3000, with hot reload for the web app and the API
```

**With Docker only** (nothing else to install). PostgreSQL 17, then the migrations, then the app, from the production
image:

```bash
docker compose --profile demo up --build   # → http://localhost:3000, with the demo dataset
docker compose up --build                  # the same, without demo data
```

Demo login: `demo-mira@demo.ideaproxima.invalid` / `demo-password-123`. Other ways to run it (production build
locally, against a real PostgreSQL) are in the [developer guide](docs/developer/developer-guide.md#ways-to-run-it).

## Documentation

| Folder                                      | For                       | Contents                                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/user/](docs/user/README.md)           | Users                     | The [user guide](docs/user/user-guide.md): what everything is, the rules it follows, how to read the numbers.                                                                                                      |
| [docs/developer/](docs/developer/README.md) | Developers and operators  | The [developer guide](docs/developer/developer-guide.md), the [operations guide](docs/developer/operations.md), and the [API reference](docs/developer/api-reference.md) (generated; also `GET /v1/openapi.json`). |
| [docs/agents/](docs/agents/README.md)       | AI agents and maintainers | Reading order, non-negotiable rules, decision records (_why_ things are as they are), domain and data-model reasoning, open questions, roadmap.                                                                    |
| `prompts/`                                  | AI agents                 | Task briefs for agents: the production-readiness prompts, the scoring-system sketch and the brief the web app was built from. Named, not linked, from other documents.                                             |
| [audit/](audit/README.md)                   | Developers                | The browser audit: end-to-end flows, accessibility scans, performance budgets and a screenshot set.                                                                                                                |

## Repository layout

```
packages/domain      pure domain: vocabulary, invariants, permission policy, baseline metrics (no I/O)
packages/contracts   the API contract: request/response schemas, endpoint catalogue, OpenAPI builder
apps/api             the API: Hono HTTP layer → domain services → Drizzle → PostgreSQL / PGlite; serves the web app
apps/web             the web app: React + TypeScript + SCSS modules, Vite, TanStack Router and Query
audit/               browser audit with Playwright: e2e flows, axe accessibility, performance budgets, screenshots
scripts/             dev runner, test runner (with contract coverage), docs generator and link checker
docs/user/           documentation for users
docs/developer/      documentation for developers and operators (api-reference.md and api/ are generated)
docs/agents/         documentation for AI agents: decision records, domain reasoning, open questions, roadmap
Dockerfile           the production image (web app + API, one process)
docker-compose.yml   the whole stack in containers (or only PostgreSQL: npm run db:up)
prompts/             task briefs for agent work
```

## Commands

| Command                                                           | What it does                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                                                     | web app (Vite, :3000) + API (:3001, proxied at /v1), both reloading on change           |
| `npm run check`                                                   | typecheck + lint + format + doc links + unit/integration tests + build: done means this |
| `npm run test:e2e`                                                | build, then the browser audit: end-to-end flows, accessibility, performance budgets     |
| `npm run audit:screenshots`                                       | build, then screenshots of every page (desktop/mobile × light/dark)                     |
| `npm test` / `npm run test:pg`                                    | all tests on PGlite / on PostgreSQL (with contract and endpoint-coverage checks)        |
| `npm run build` / `npm start`                                     | production build / run it (one process on :3000)                                        |
| `docker compose up --build`                                       | the whole stack in containers (`--profile demo` adds demo data)                         |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:seed:demo` | migrations and seed data                                                                |
| `npm run docs:api`                                                | regenerate the API reference and OpenAPI document                                       |
| `npm run admin:set-role -- <handle> admin`                        | appoint the first admin of a new database                                               |

## Status

The foundation and the web interface are complete and tested: domain model, append-only persistence, 66
endpoints, abuse protection, a web app covering every part of the API (discovery lenses, ideas with claims,
evidence, arguments, connections, initiatives, history, evaluation, moderation), a browser audit, CI and a
container image. The reputation-weighted scoring system, email verification and OAuth are next. See the
[roadmap](docs/agents/roadmap.md).
