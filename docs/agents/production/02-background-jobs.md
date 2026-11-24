# 02 — Background jobs and asynchronous derivation

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/02-background-jobs-prompt.md`.

| Status     | Not started                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [01](01-operational-foundations.md) (metrics, configuration, graceful shutdown)                                              |
| Unblocks   | [04](04-accounts-and-trust.md) (e-mail), [07](07-moderation-core.md), [08](08-ai-moderation.md), [11](11-semantic-search.md) |
| Size       | 2 sessions (steps 4–5) · 5–7 engineer-days                                                                                   |

## Outcome

Work can happen outside a request, reliably: a job is recorded in the same transaction as the fact that caused
it, runs at least once, is retried with back-off, and is visible in metrics. Derived metrics can be refreshed
off the request path with a configuration switch ([audit](api-audit.md): OPS-5, PERF-1, PERF-7).

## Why a small queue of our own

The architecture notes already anticipate "a `jobs` table with `SKIP LOCKED` workers". Three constraints decide
between that and a library (pg-boss 12, graphile-worker 0.18):

1. **Enqueueing must join the caller's Drizzle transaction** (the outbox pattern). A job that exists without
   its fact, or a fact without its job, is a bug class we refuse to have.
2. **Tests run on PGlite** (ADR-2). Both libraries are built on the `pg` driver and on server features such as
   `LISTEN`; this codebase uses `postgres` (postgres.js) and a single-connection embedded engine in tests.
3. **The surface we need is small**: claim, complete, retry, schedule. That is about 300 lines we fully
   understand, written with the same Drizzle and SQL conventions as the rest.

_Revisit if_ we need workflows, per-queue rate limits or fan-out at a scale where a tuned library earns its
keep; pg-boss is then the candidate. The `enqueue()` signature below is deliberately library-shaped.

## Design

### Tables

Jobs are **operational state**, like sessions: mutable and deletable, never history. They get no history guard
and must never be the only record of anything that matters.

```sql
create table jobs (
  id           uuid primary key,              -- UUIDv7 from the application
  queue        text not null default 'default',
  kind         text not null,                 -- handler name, e.g. 'moderation.assess'
  payload      jsonb not null default '{}',
  dedupe_key   text,                          -- at most one PENDING job per (kind, dedupe_key)
  priority     smallint not null default 0,   -- higher runs first
  run_at       timestamptz not null default now(),
  state        text not null default 'pending',  -- pending | running | done | failed
  attempts     integer not null default 0,
  max_attempts integer not null default 8,
  locked_by    text,
  locked_until timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  check (state in ('pending', 'running', 'done', 'failed'))
);
create index jobs_claim_idx  on jobs (queue, priority desc, run_at, id) where state = 'pending';
create unique index jobs_dedupe_key on jobs (kind, dedupe_key) where state = 'pending' and dedupe_key is not null;
create index jobs_lease_idx  on jobs (locked_until) where state = 'running';
create index jobs_finished_idx on jobs (finished_at) where state in ('done', 'failed');

create table job_schedules (
  name        text primary key,               -- e.g. 'sessions.purge'
  next_run_at timestamptz not null,
  last_run_at timestamptz
);
```

Declare both in `src/db/schema/jobs.ts` and generate the migration as usual.

### Semantics

- **Enqueue** (`modules/jobs/queue.ts`): `enqueue(ctx, { kind, payload, queue?, dedupeKey?, runAt?, priority?,
maxAttempts? })` inserts through `ctx.db`, so inside `inTransaction()` it commits or rolls back with the
  caller. With a `dedupeKey` it uses `on conflict do nothing`: a second request while one is pending coalesces.
  A job that is already _running_ does not block a new pending one, which is what makes coalescing safe (the
  running job may have read stale data).
- **Claim** (one statement, safe under any number of workers):

  ```sql
  update jobs set state = 'running', attempts = attempts + 1, locked_by = $worker,
                  locked_until = now() + make_interval(secs => $lease)
  where id in (select id from jobs
               where state = 'pending' and queue = any($queues) and run_at <= now()
               order by priority desc, run_at, id
               limit $n
               for update skip locked)
  returning *;
  ```

- **Complete**: `state = 'done'`, `finished_at = now()`.
- **Fail**: below `max_attempts`, back to `pending` with `run_at = now() + min(5 s × 2^attempts, 1 h) ± 20 %`
  and `last_error` (truncated to 2,000 characters). At `max_attempts`: `state = 'failed'`. Failed jobs are the
  dead-letter queue.
- Fence completion, retry and extension with `id`, the claiming worker, the returned attempt number, running state and an unexpired lease. Zero affected rows means ownership was lost. Reclaim under the same ownership check. If a newer pending refresh already exists for the same dedupe key, atomically retire the superseded refresh and keep the pending one. Reclaiming the final attempt dead-letters it. Test both races on PostgreSQL.
- **Leases**: a handler that needs longer than the lease (default 60 s) extends it. Each worker tick returns
  `running` jobs whose lease expired to `pending` (the worker died).
- **Delivery is at least once.** Every handler must be idempotent: check current state before acting, use the
  job id or a content hash as an idempotency key for external effects such as e-mail.
- **Polling**: 250 ms after a tick that found work, backing off to 2 s when idle. No `LISTEN/NOTIFY` in the
  first version: it does not work through transaction-mode poolers or on PGlite, and two cheap index probes per
  second are not a cost worth optimising yet.

### Handlers and the worker

- `modules/jobs/registry.ts` maps `kind → handler(ctx, payload, job)`. Handlers live in the module that owns
  the work (`modules/metrics`, `modules/identity`, later `modules/moderation`) and are registered at start-up.
  Payloads are validated with a zod schema per kind.
- `src/worker.ts` is a new entry point (add `worker` to `tsup.config.ts`; the image gets
  `apps/api/dist/worker.js`). It opens the database with a longer statement timeout, runs
  `JOBS_CONCURRENCY` handlers at a time (default 4, with optional per-queue caps such as `moderation=2`),
  exposes the internal listener from plan 01, and drains on `SIGTERM`: stop claiming, let running handlers
  finish within the shutdown timeout, release what remains by clearing its lease.
- `JOBS_MODE`:
  - `inline` (default): the API process runs the worker loop too. `npm run dev` and a single-container
    deployment keep working with one process.
  - `worker`: the API only enqueues; dedicated worker processes execute. Production from the first
    multi-instance deployment on.
  - `off`: nothing is executed. Tests use this and call `drainJobs(ctx)` (run everything due, in order, in
    this process) so they stay deterministic.
- Compose: a `worker` service using the same image (`command: ["node", "apps/api/dist/worker.js"]`), started
  after `migrate`; `app` runs with `JOBS_MODE=worker`.

### Schedules

Recurring work is declared in code: `{ name, every, kind, payload? }`. On each tick a worker tries

```sql
update job_schedules set last_run_at = now(), next_run_at = $next
where name = $name and next_run_at <= now() returning name;
```

and, in that same transaction, enqueues the job only if the update returned a row: one winner per slot, however many workers run. Missing
rows are inserted at start-up with `on conflict do nothing`.

First schedules:

| Name                | Every | Does                                                                  |
| ------------------- | ----- | --------------------------------------------------------------------- |
| `sessions.purge`    | 1 h   | Deletes sessions expired or revoked more than 30 days ago, in batches |
| `jobs.purge`        | 1 h   | Deletes `done` jobs older than 7 days and `failed` jobs older than 30 |
| `metrics.reconcile` | 24 h  | Recomputes a random sample of ideas and reports any drift as a metric |

### Asynchronous metric refresh

`METRICS_REFRESH_MODE`:

- `sync` (default): today's behaviour, unchanged.
- `async`: `refreshIdeaMetrics(ctx, ids)` enqueues one `metrics.refresh` job per idea with
  `dedupeKey = ideaId` and returns. The handler runs the existing computation under the existing advisory
  lock. Many votes on one idea within a tick collapse into one recomputation.

Consequences of `async`, to document for clients: `signals` may lag a write by one tick (target p95 below 2 s);
`signals.computedAt` already tells them how fresh the values are. The write's own response is unaffected,
because stance and evaluation responses carry viewer state, not aggregates.

Switch to `async` when measurements say so: sustained more than ~5 signal writes per second on one idea, or
write p95 above 150 ms with lock waits visible in `pg_stat_activity`. Both modes must stay tested: the suite
runs once per mode for `signals.test.ts` and `concurrency.test.ts`, draining jobs before asserting in `async`.

While here, stop rewriting unchanged rows (PERF-1): replace "delete all, insert all" in
`computeAndStoreMetrics()` with an upsert that only touches rows whose value, sample size, dispersion or
details changed, plus a delete of metric keys no longer produced. The "rebuild equals incremental" test keeps
proving correctness.

### Observability

| Metric                        | Type      | Labels            |
| ----------------------------- | --------- | ----------------- |
| `jobs_enqueued_total`         | counter   | `kind`            |
| `jobs_finished_total`         | counter   | `kind`, `outcome` |
| `job_duration_seconds`        | histogram | `kind`            |
| `jobs_pending`                | gauge     | `queue`           |
| `jobs_oldest_pending_seconds` | gauge     | `queue`           |
| `jobs_failed`                 | gauge     | `queue`           |

Operator command `apps/api/scripts/jobs.ts` (bundled as `dist/jobs.js`): `list --state failed`, `retry <id>`,
`retry --kind <kind>`, `purge`.

Alerts to define in [10](10-deployment-and-operations.md): oldest pending job older than 5 minutes; any
`failed` job; a schedule that has not run for twice its interval.

## Phases

| Phase | Scope                                                                                              | Days |
| ----- | -------------------------------------------------------------------------------------------------- | ---- |
| A     | Tables, queue API, worker loop, leases, retries, schedules, `JOBS_MODE`, metrics, operator command | 3–4  |
| B     | Purge schedules, `METRICS_REFRESH_MODE=async`, upsert-on-change, compose `worker` service, docs    | 2–3  |

## Verification

- Unit: back-off schedule, payload validation, schedule slot arithmetic.
- Integration on both drivers: enqueue inside a transaction that rolls back leaves no job; dedupe coalesces;
  a failing handler is retried then dead-lettered; an expired lease is reclaimed; `drainJobs()` order.
- `npm run test:pg` only: 4 concurrent workers and 500 jobs, each executed exactly once (`SKIP LOCKED`); two
  workers and one schedule slot, one enqueue.
- Both refresh modes pass `signals.test.ts` and `concurrency.test.ts`; "rebuild equals incremental" holds.

## Documentation to update

`docs/agents/architecture.md` (new ADR: jobs and the outbox; amend ADR-15), `docs/agents/data-model.md` (a
fourth category, "operational state": sessions, jobs, rate limits), `docs/developer/developer-guide.md`
(recipe: "add a job"), `docs/developer/operations.md` (worker service, `JOBS_MODE`, the operator command),
`docs/agents/README.md` (non-negotiable 7 gains: "work that follows a write is enqueued in the same
transaction").

## Risks

- **A poisoned job blocks nothing but fills the dead-letter queue silently.** The `jobs_failed` metric is
  part of this plan's definition of done; the alert on it is written in [10](10-deployment-and-operations.md)
  and must not be dropped there.
- **Handlers that are not idempotent.** Review each new handler for this; add a test that runs it twice.
- **`inline` mode hides worker-only bugs.** CI's Docker stack job runs with a separate `worker` service.
