# Documentation for agents

The knowledge base for AI agents (and maintainers) working on Ideaproxima.

These documents record what was discovered, what was decided and **why**, what is still uncertain, and what to
do next. Read them before changing anything structural. Keep them true: if you change a decision, update the
document that records it in the same change.

Where the rest lives:

- [`../user/`](../user/README.md): the user guide. The exact product rules, as users experience them.
- [`../developer/`](../developer/README.md): the developer guide (setup, conventions, recipes, testing), the
  operations guide, and the **generated** API reference. Prefer linking there over restating facts here, so
  nothing drifts.
- `prompts/` at the repository root: task briefs for the next major pieces of agent work. A `*-prompt.md` has
  been checked against the code and is ready to hand over; a `*-prompt-sketch.md` is a draft to adapt.
  Documents outside the folder name its files in code style instead of linking to them, so links never depend
  on whether the folder is published.

## Reading order

1. [`../../concept.txt`](../../concept.txt) — the product concept. Highest authority.
2. [`architecture.md`](architecture.md) — system shape, layers, the decision log (ADRs), how to extend safely.
3. [`domain-model.md`](domain-model.md) — the concepts, which are first-class and which are derived, and how
   conflicts between the concept, the MVP and the design were resolved.
4. [`data-model.md`](data-model.md) — tables, history guarantees, facts vs projections vs derived values, and how to
   answer historical questions in SQL.
5. [`api-architecture.md`](api-architecture.md) — API design rules and how the contract is enforced (the endpoint
   list itself is generated: [`../developer/api-reference.md`](../developer/api-reference.md)).
6. Reference briefs outside the production sequence, in `prompts/`:
   - `prompts/front-rebuild-prompt-sketch.md` — design history for the implemented web app.
   - `prompts/scoring-system-prompt-sketch.md` — for the agent designing evaluation scoring and contribution
     influence.
7. [`open-questions.md`](open-questions.md) — known uncertainties, with the current default for each.
8. [`roadmap.md`](roadmap.md) — the next major tasks, in priority order.
9. [`production/README.md`](production/README.md) — the production-readiness program: an
   [audit](production/api-audit.md) and fifteen plans (rate limiting, twelve languages, AI-assisted
   moderation, scaling, the public web, deployment, launch readiness), run as one numbered sequence of steps.
   Each plan has a prompt of the same number in `prompts/api/`. Read the program's rules before working on
   any step.
10. [`source-review.md`](source-review.md) — what was learned from the original prototypes (the seedbank MVP and the
    Lovable design exploration, both since removed from this repository), what was kept and what was replaced.

## Non-negotiables (do not change casually)

These are the load-bearing decisions. Each is enforced in code or the database and covered by tests. Changing one
is a product decision, not a refactor. Discuss it, then update the docs.

1. **Recorded facts are append-only.** Revisions, evaluations, stances, involvements, evidence, arguments, claims,
   relations, stage transitions, outcomes, sources and the activity ledger are never edited in place or deleted.
   They are superseded, withdrawn, retracted or hidden, and that is recorded too. Postgres triggers enforce this
   (`apps/api/drizzle/0001_history_guards.sql`).
2. **Popularity is not quality.** Stances (`important` is the "vote") and evaluations (multi-dimensional
   assessments) are different tables, feed different metrics and different lenses. Nothing may fold attention into
   a quality score. A test asserts this (`apps/api/test/signals.test.ts`, "popularity is not quality").
3. **Derived values are disposable.** Only `apps/api/src/modules/metrics` writes derived data (`idea_metrics`).
   Every derived value names the algorithm that produced it and can be rebuilt from facts with
   `npm run metrics:rebuild`. A test proves rebuild = incremental.
4. **No single score.** Evaluations are per dimension. Summaries carry `n` and dispersion. "No data" is `null`,
   never `0`.
5. **Claim status is derived, never typed in.** Not even by the claim's author, whose assessment is one evaluation
   among others. "Contested" only exists as a derivation from disagreement.
6. **Lifecycle stages need proof.** The stage changes only through a recorded transition with a rationale. `tested`,
   `implemented` and `learned_from` require initiatives and outcomes on record (`assertStageTransition`).
7. **Every write goes through a service that records an activity in the same transaction.** The ledger is how
   history, contribution and moderation stay visible.
8. **One vocabulary.** Stages, dimensions, stance kinds, relation types etc. live in `packages/domain`. Database CHECK
   constraints are generated from the same constants. Do not duplicate vocabularies in the frontend; read them
   from `/v1/vocabulary` or import `@ideaproxima/domain`.
9. **One permission policy.** Every authorization decision goes through `authorize()` in
   `packages/domain/src/rules/permissions.ts`.
10. **The contract is executable.** Every route is declared in `packages/contracts/src/endpoints.ts` with its request
    and response schemas. Tests reject any response that does not exactly match its schema, any route missing from
    the catalogue, stale generated docs, and any catalogued endpoint left untested. Change the contract first.
11. **Check-then-write needs a lock.** Any write that reads before it inserts (idempotent operations, find-or-create,
    derived refreshes) takes an advisory lock per logical key (`lockKey`/`lockKeys`). Verify with `npm run test:pg`:
    PGlite cannot reveal races.

## Definition of done for any change

`npm run check` passes (typecheck, lint, formatting, tests with contract and endpoint-coverage checks, build). If you
touched transactions, locking or SQL, `npm run test:pg` passes too. If the contract changed, `npm run docs:api` was
run. If the schema changed, a migration was generated (`npm run db:generate`) and committed. If a decision changed,
the relevant document in `docs/agents/` was updated.
