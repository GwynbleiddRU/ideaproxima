# 01 — Operational foundations

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/01-operational-foundations-prompt.md`.

| Status     | Phase A done 2026-11-25 (step 2). Phase B pending (step 3).                          |
| ---------- | ------------------------------------------------------------------------------------ |
| Depends on | [00](00-immediate-hardening.md) (shares the error code `unavailable`)                |
| Unblocks   | Every later plan: they all emit metrics and logs and rely on validated configuration |
| Size       | 2 sessions (steps 2–3) · 3–5 engineer-days                                           |

## Outcome

An operator can answer "is it healthy, how fast is it, what failed and why" without reading stderr, and a
misconfigured or half-migrated instance refuses to serve instead of failing requests
([audit](api-audit.md): OPS-1 to OPS-4, PERF-9, SEC-11).

## Design decisions

- **Configuration:** one zod schema in `config.ts`; start-up fails with every problem listed. zod is already a
  dependency, and today's `int()`/`bool()` silently accept typos.
- **Logs:** `pino`, JSON lines on stdout. It is the de-facto Node logger, and structured output is what every
  log platform ingests.
- **Request identity:** `hono/request-id`, which ships with the installed Hono 4.13. No new dependency.
- **Metrics:** `prom-client`, exposed on a separate internal listener. It is small and stable, and every
  metrics backend reads the Prometheus text format. No OpenTelemetry SDK until tracing is actually needed: it
  would add dozens of packages.
- **Error tracking:** an `ErrorReporter` interface whose default writes a log line. Sentry or GlitchTip stays
  an optional adapter behind `SENTRY_DSN`.
- **Internal endpoints:** `/livez` and `/readyz` on the main port, `/metrics` only on `INTERNAL_PORT`. Probes
  must work through a load balancer; metrics must never be public. None of them lives under `/v1`, so the
  contract test, which enumerates `/v1` routes, is unaffected.

## Work

### 1. Validated configuration

- Rewrite `loadConfig()` around a zod schema. Group settings: `http`, `db`, `rateLimits`, `log`, and leave named
  slots for the groups later plans add (`jobs`, `mail`, `i18n`, `moderation`). Collect all issues and throw one
  `ConfigError` whose message lists them (`RATE_LIMIT_AUTH_PER_MINUTE: expected an integer, received "1O"`).
- Production guards (`NODE_ENV=production`): refuse a `pglite:` URL unless `ALLOW_PGLITE_IN_PRODUCTION=true`;
  refuse `COOKIE_SECURE=false` unless `ALLOW_INSECURE_COOKIES=true`; warn when `TRUST_PROXY_HOPS=0` and no
  `CLIENT_IP_HEADER` is set (every client would share the proxy's address).
- A test asserts that every variable the schema reads appears in `apps/api/.env.example` and in the
  configuration table of `docs/developer/operations.md`, so the documentation cannot fall behind.

### 2. Structured logs and request ids

- `src/observability/logger.ts`: a pino root logger. `LOG_LEVEL` (default `info`), `LOG_FORMAT` (`json` in
  production, `pretty` otherwise; `pino-pretty` is a dev dependency).
- Replace `hono/logger`. One line per request when it finishes: `requestId`, `method`, `route` (the matched
  pattern, e.g. `/v1/ideas/:idea`), `status`, `durationMs`, `actorId`,
  `bytesOut`. Never log request bodies, `authorization`, `cookie`, e-mail addresses or the value of `q`.
  Omit the limiter's network key from logs. Its IPv4 representation contains the full address. Verify log
  samples for both address families. Requests for static assets log at `debug`.
- Request id: accept an inbound `X-Request-Id` only if it matches `^[A-Za-z0-9_-]{8,64}$`; otherwise generate
  a UUIDv7 (`lib/ids.ts`). Echo it on every response.
- The error envelope gains an optional `requestId` (`ErrorResponse` in `packages/contracts`). The web app's
  error toast shows it for 5xx responses ("Quote this id if you report the problem").
- `handleError()` logs unexpected errors through the logger with the request id and the Postgres error code,
  never with bound parameters. Map `HTTPException` to the documented codes instead of `http_error`
  (404 → `not_found`, 405 and others → `validation_failed`).

### 3. Metrics

`src/observability/metrics.ts` owns the registry; modules import counters from it and never create their own.

| Metric                                        | Type      | Labels                            |
| --------------------------------------------- | --------- | --------------------------------- |
| `http_requests_total`                         | counter   | `method`, `route`, `status`       |
| `http_request_duration_seconds`               | histogram | `method`, `route`, `status_class` |
| `http_requests_in_flight`                     | gauge     | —                                 |
| `db_errors_total`                             | counter   | `code` (SQLSTATE class)           |
| `rate_limit_decisions_total`                  | counter   | `policy`, `outcome`               |
| `password_hash_queue_depth`                   | gauge     | —                                 |
| Node defaults (event-loop lag, heap, GC, fds) | —         | from `collectDefaultMetrics()`    |

Histogram buckets: 5, 10, 25, 50, 100, 250, 500 ms, 1, 2.5, 5, 10 s. The `route` label is the matched pattern
or `unmatched`; never a raw path (unbounded cardinality).

`INTERNAL_PORT` (unset = disabled) starts a second listener bound to all interfaces of the container that
serves `GET /metrics`. The compose file and the deployment guide must not publish it.

### 4. Liveness, readiness, drain

- `GET /livez`: 200 while the process runs. No database call.
- `GET /readyz`: 200 only when (a) the database answers, (b) the newest applied migration in
  `drizzle.__drizzle_migrations` is the newest one in the bundled journal, and (c) the instance is not
  draining. The body names the failing check. `GET /v1/health` keeps its contract and its meaning.
- Start-up logs one line with version, commit (`APP_COMMIT`, baked in by the Dockerfile from a build argument),
  driver, and the resolved configuration with secrets masked.
- Shutdown on `SIGTERM`/`SIGINT`: mark draining (readiness turns 503) → wait `SHUTDOWN_DELAY_MS` (default
  5,000; lets the load balancer stop routing) → stop accepting connections and wait for in-flight requests up
  to `SHUTDOWN_TIMEOUT_MS` (default 25,000) → close the database → exit 0. `unhandledRejection` and
  `uncaughtException` log at `fatal` and exit 1.

### 5. Database guard rails

`openDatabase()` takes its options from configuration:

| Variable                   | Default | Applied as                                                     |
| -------------------------- | ------- | -------------------------------------------------------------- |
| `DB_POOL_MAX`              | `10`    | postgres.js `max`                                              |
| `DB_STATEMENT_TIMEOUT_MS`  | `5000`  | `statement_timeout` (scripts and the worker pass a longer one) |
| `DB_LOCK_TIMEOUT_MS`       | `3000`  | `lock_timeout` (also bounds waits on advisory locks)           |
| `DB_IDLE_IN_TX_TIMEOUT_MS` | `10000` | `idle_in_transaction_session_timeout`                          |
| `DB_CONNECT_TIMEOUT_MS`    | `5000`  | postgres.js `connect_timeout`                                  |

- Error mapping in `http/errors.ts`: `57014` (statement timeout) and `55P03` (lock timeout) → 503
  `unavailable` with `Retry-After: 1`.
- `inTransaction()` retries once, after 20–50 ms of jitter, on `40001` (serialisation failure) and `40P01`
  (deadlock) when it is the outermost transaction; then 503. Nested calls (savepoints) never retry.
- PGlite ignores pool settings; apply the timeouts with `SET` after opening so both drivers behave alike.

### 6. Error reporter

`src/observability/errors.ts`: `report(error, context)`. The default logs. If `SENTRY_DSN` is set, load the
adapter with a dynamic import so the dependency stays optional. Report only unexpected errors (the 500 path
and fatal process errors), never `DomainError`s.

## Phases

| Phase | Scope                                                                                     | Days |
| ----- | ----------------------------------------------------------------------------------------- | ---- |
| A     | Sections 1–3: validated configuration, structured logs and request ids, metrics           | 2–3  |
| B     | Sections 4–6: liveness, readiness and drain; database guard rails; error reporter; Docker | 1–2  |

## Verification

- Unit tests: configuration (valid, each guard, aggregated errors), request-id validation, the readiness
  checks with a database missing its last migration, the retry wrapper.
- Integration: the error envelope carries `requestId`; `/livez`, `/readyz`; `/metrics` is absent from the main
  port; a statement that exceeds the timeout answers 503.
- A drain test: start the server on a random port, begin a slow request, send `SIGTERM`, assert the request
  completes and readiness reports 503 meanwhile (skip on Windows if signals are unreliable there; CI is Linux).
- `npm run check`, `npm run test:pg`.

## Documentation to update

`docs/developer/operations.md` (configuration, monitoring: metrics catalogue and probes, shutdown behaviour),
`docs/developer/developer-guide.md` (logging rules, the error table), `docs/agents/architecture.md` (a new ADR:
observability and internal endpoints), `Dockerfile` (build argument, health check on `/readyz`),
`docker-compose.yml` (health check).

## Risks

- **Cardinality.** A raw path or an id in a label will exhaust the metrics backend. Review every label.
- **Statement timeouts and long operations.** `rebuild-metrics` and migrations must override the timeout; the
  scripts pass their own options to `openDatabase()`.

## Implementation notes

### Step 2 · Phase A · 2026-11-25

- Step 1 was marked done and matched the starting `main` commit `13e916b`. Baseline `npm run check`
  passed with 144 tests and all 66 catalogued endpoints covered.
- `apps/api/src/config.ts` validates environment input before startup. The operations guide owns the
  [configuration defaults](../../developer/operations.md#configuration) and
  [metric catalogue](../../developer/operations.md#monitoring). Local Compose and the production-build
  browser fixture explicitly opt in to the guards they need.
- The request lifecycle is in `apps/api/src/observability/`. HTTP, rate-limit and SQLSTATE instrumentation
  runs at the HTTP boundary. The hash queue reports current waiters and retains one process-wide budget.
  Unknown and inactive accounts still perform one scrypt verification against a random comparison value.
- `X-Request-Id` is accepted only when it matches the specified pattern. The public error envelope includes
  it, and the existing web toast quotes it for 5xx responses. CORS permits sending and reading the header
  from configured origins. The public health response body retains its existing contract.
- New packages are `pino@10.4.0` for JSON events and `prom-client@15.1.3` for the registry. The dev-only
  `pino-pretty@13.2.0` formats local logs. Both Pino packages declare no Node engine floor, and
  `prom-client` declares `^16 || ^18 || >=20`, compatible with Node 22.18. npm marked the plan's pinned
  `prom-client` version deprecated during install. Its lockfile adds a transitive OpenTelemetry API package.
  Production-only installs emit JSON when the pretty formatter is absent.
- Request timings and in-flight counts cover handler execution. `bytesOut` uses the known response length
  or zero for a bodyless response and is `null` when the length is discovered later by the server adapter.
  This avoids reading response streams for logging. The `db_errors_total` code label uses the SQLSTATE
  class. The error event records the full SQLSTATE when available.

**Verification.** `npm run docs:api` regenerated the contract reference and OpenAPI. `npm run check` and
`npm run test:pg` each passed 154 tests and contract-checked all 66 endpoints. PostgreSQL 17.12 ran in
an isolated Compose project. The production container passed `docker compose up --build --wait app`.
`npm run test:e2e` passed all 54 browser tests, including the 503 request-ID toast.

The correlation test sent two authenticated failure requests with IPv4 and IPv6 forwarded address fixtures.
Each 500 echoed the ID in the header and envelope, and produced one error event and one request event with
that ID. The captured logs excluded network addresses and limiter keys, route values, query terms, request
bodies, credentials and database parameters. The socket test saw a public 404 and an internal 200 on
`/metrics`. An isolated production container with `INTERNAL_PORT=9100` served the same registry with no
published port. The image with default settings returned the unchanged health payload and a public 404 for
`/metrics`, including when the client accepted HTML.

Completed request from the production container:

```json
{
  "level": 30,
  "time": 1795563991903,
  "requestId": "step2-smoke-ok",
  "method": "GET",
  "route": "/v1/health",
  "status": 200,
  "durationMs": 3.052878000002238,
  "actorId": null,
  "bytesOut": null,
  "msg": "request completed"
}
```

Unexpected error event from the IPv4 fixture, with its timestamp omitted:

```json
{ "level": 50, "requestId": "correlate-v4", "pgCode": "XX000", "msg": "unexpected request error" }
```

Phase B owns drain verification, probes, database guard rails and the error reporter. The next eligible row
after this commit is **step 3 (plan 01, phase B)**, using `prompts/api/01-operational-foundations-prompt.md`.
