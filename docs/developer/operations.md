# Operations guide

How to configure, deploy, run and maintain the Ideaproxima API.

## Contents

1. [What runs in production](#what-runs-in-production)
2. [Configuration](#configuration)
3. [Deploying with Docker](#deploying-with-docker)
4. [Deploying without Docker](#deploying-without-docker)
5. [First admin and roles](#first-admin-and-roles)
6. [Database: migrations, backups, restore](#database-migrations-backups-restore)
7. [Security checklist](#security-checklist)
8. [Monitoring](#monitoring)
9. [Maintenance tasks](#maintenance-tasks)
10. [Scaling](#scaling)

## What runs in production

- **One stateless process** (Node.js ≥ 22.19): `apps/api/dist/main.js`. On `PORT` it serves the API at `/v1` and the
  built web app (`apps/web/dist`) outside `/v1`. The web app's files are read once at startup and served from
  memory, brotli- or gzip-compressed: hashed assets (`/assets/*`) with `Cache-Control: immutable` for a year, the
  HTML shell with `no-cache` and a Content-Security-Policy. A CDN or reverse proxy in front may cache `/assets/*`
  indefinitely.
- **One PostgreSQL database**, version 13 or newer (generated columns, `websearch_to_tsquery`,
  `hashtextextended`; CI tests on 17). All state lives there: sessions are rows, and nothing is kept on local disk.
- **PGlite is for development and tests only.** Do not run production on `pglite:` URLs (single process, no
  replication or backup tooling).

## Configuration

All configuration comes from environment variables. The server and the operator commands also read
`apps/api/.env` when it exists; variables already set in the environment take precedence. The Docker image never
contains that file.

Invalid settings stop startup with one error listing the affected variables. Boolean settings accept
`true`, `false`, `1` or `0`. Omit settings to use their defaults.

| Variable                         | Default                                         | Meaning                                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | `pglite:./.data/pglite`                         | `postgres://user:pass@host:5432/db` in production. `pglite:memory` or `pglite:<dir>` for development.                                                                            |
| `ALLOW_PGLITE_IN_PRODUCTION`     | `false`                                         | Explicit exception for isolated local runs with PGlite and production defaults.                                                                                                  |
| `PORT`                           | `3000`                                          | HTTP port.                                                                                                                                                                       |
| `INTERNAL_PORT`                  | unset                                           | Enables the private Prometheus listener on a port distinct from `PORT`.                                                                                                          |
| `NODE_ENV`                       | —                                               | Set `production` in production (makes cookies Secure by default).                                                                                                                |
| `APP_COMMIT`                     | `unknown`                                       | Short or full Git commit hash recorded at startup. Also a Docker build argument.                                                                                                 |
| `DB_POOL_MAX`                    | `10`                                            | Maximum connections per API instance on PostgreSQL.                                                                                                                              |
| `DB_STATEMENT_TIMEOUT_MS`        | `5000`                                          | Maximum execution time per API statement. Zero disables it.                                                                                                                      |
| `DB_LOCK_TIMEOUT_MS`             | `3000`                                          | Maximum wait per API database lock, including advisory locks. Zero disables it.                                                                                                  |
| `DB_IDLE_IN_TX_TIMEOUT_MS`       | `10000`                                         | Maximum idle time inside an API transaction. Zero disables it.                                                                                                                   |
| `DB_CONNECT_TIMEOUT_MS`          | `5000`                                          | PostgreSQL connection establishment deadline in milliseconds.                                                                                                                    |
| `SHUTDOWN_DELAY_MS`              | `5000`                                          | Wait after readiness fails so the load balancer can stop routing. Zero closes the listeners immediately.                                                                         |
| `SHUTDOWN_TIMEOUT_MS`            | `25000`                                         | Maximum time to wait for active HTTP connections after closing the listeners.                                                                                                    |
| `SESSION_TTL_DAYS`               | `30`                                            | Session lifetime.                                                                                                                                                                |
| `COOKIE_SECURE`                  | `true` when `NODE_ENV=production`, else `false` | Mark the session cookie Secure (HTTPS only).                                                                                                                                     |
| `ALLOW_INSECURE_COOKIES`         | `false`                                         | Explicit exception for local HTTP runs with production defaults and `COOKIE_SECURE=false`.                                                                                       |
| `CORS_ORIGINS`                   | empty (same-origin only)                        | Comma-separated browser origins allowed to call the API with credentials.                                                                                                        |
| `TRUST_PROXY_HOPS`               | `0`                                             | Trusted reverse proxies on every ingress path. Count from the right of `X-Forwarded-For`. Zero or a short chain uses the socket peer.                                            |
| `CLIENT_IP_HEADER`               | unset                                           | Single-value header overwritten by the edge, e.g. `cf-connecting-ip`, `fly-client-ip` or `x-real-ip`. Takes precedence over hop counting. A missing header uses the socket peer. |
| `TRUST_PROXY`                    | `false`                                         | Deprecated for one release. `true` warns at startup and defaults `TRUST_PROXY_HOPS` to one (the last entry).                                                                     |
| `RATE_LIMIT_IPV6_PREFIX`         | `64`                                            | IPv6 network prefix length (0–128). IPv4-mapped addresses share their IPv4 bucket. Invalid addresses share one unknown bucket.                                                   |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `600`                                           | Requests per network per minute, including reads, before session lookup. Zero disables this limit.                                                                               |
| `PASSWORD_HASH_CONCURRENCY`      | `3`                                             | Maximum simultaneous scrypt operations per process. Minimum one.                                                                                                                 |
| `PASSWORD_HASH_QUEUE`            | `32`                                            | Maximum waiting scrypt operations. Zero allows only active slots. Overflow returns 503 `unavailable` with `Retry-After: 1`.                                                      |
| `MAX_BODY_BYTES`                 | `1048576`                                       | Maximum request body size.                                                                                                                                                       |
| `RATE_LIMIT_AUTH_PER_MINUTE`     | `10`                                            | Login + registration attempts per client address per minute. `0` disables.                                                                                                       |
| `RATE_LIMIT_WRITES_PER_MINUTE`   | `120`                                           | Writes per account (or per address when anonymous) per minute. `0` disables.                                                                                                     |
| `LOG_REQUESTS`                   | `true` (unless `NODE_ENV=test`)                 | One log line per request.                                                                                                                                                        |
| `LOG_LEVEL`                      | `info`                                          | Minimum log level. Values are `fatal`, `error`, `warn`, `info`, `debug`, `trace` and `silent`.                                                                                   |
| `LOG_FORMAT`                     | `json` in production, else `pretty`             | Log format on stdout. Pretty formatting requires the development dependency; production-only installations emit JSON.                                                            |
| `SENTRY_DSN`                     | unset                                           | Optional HTTP(S) DSN for forwarding redacted unexpected errors and fatal process events.                                                                                         |
| `WEB_ROOT`                       | `apps/web/dist`, when it has been built         | Directory of the built web app to serve at `/`. `off` serves the API only (`GET /` then redirects to the `/v1` index).                                                           |
| `JOBS_MODE`                      | `inline`                                        | Execute jobs in the API (`inline`), a dedicated process (`worker`), or only through explicit drains (`off`).                                                                     |
| `METRICS_REFRESH_MODE`           | `sync`                                          | Compute signals during the write, or set `async` to enqueue one pending refresh per affected idea.                                                                               |
| `JOBS_CONCURRENCY`               | `4`                                             | Maximum active handlers per worker process.                                                                                                                                      |
| `JOBS_QUEUES`                    | `default`                                       | Comma-separated queue names with optional per-process caps, e.g. `default,moderation=2`.                                                                                         |
| `JOBS_STATEMENT_TIMEOUT_MS`      | `60000`                                         | Dedicated worker and queue operator statement deadline. Inline handlers share the API database settings.                                                                         |

## Background jobs

For dedicated execution, apply the release migrations first. Set `JOBS_MODE=worker` on both processes,
point them at the same PostgreSQL database, and start `node apps/api/dist/worker.js` alongside the API.
Give each process its own private metrics port when sharing a network namespace. On termination the worker
stops polling and drains its handlers. At the deadline it releases unfinished leases for reclamation.
A crashed worker's leases expire after 60 seconds.

Compose starts both processes after migration. The worker's private health check scrapes port 9100.
Hourly schedules purge sessions expired or revoked over 30 days ago and apply job retention.
Daily reconciliation samples up to 25 ideas, repairs their metrics and increments
`metrics_reconcile_drift_total` once per repaired idea. Ideas with an outstanding refresh are skipped.

In async mode the writer sees its stance or rating immediately. Aggregate signals and lens rankings
catch up when the worker processes the idea. A new idea can have `signals.computedAt = null`;
afterward this field reports the most recent change among its stored metric rows. Scrape the worker
for refresh duration and drift, and monitor oldest pending age for backlog. The staleness target is p95
below two seconds. Run the rebuild command for an immediate recomputation in either mode.

Run the operator command against the same database. Listing shows the 100 newest matching IDs.
A manual retry grants one additional attempt. Pending work with the same key covers the retry.

```sh
node apps/api/dist/jobs.js list --state failed
node apps/api/dist/jobs.js retry <id>
node apps/api/dist/jobs.js retry --kind <kind>
node apps/api/dist/jobs.js purge
```

Purge removes completed jobs older than seven days and failed jobs older than 30 days, in batches of 500.
The private listener exports `jobs_enqueued_total{kind}`, `jobs_finished_total{kind,outcome}` and
`job_duration_seconds{kind}` per process. Each scrape also reads `jobs_pending`, `jobs_failed` and
`jobs_oldest_pending_seconds` by queue from the shared database. Use one instance or the maximum across
instances for these gauges. Oldest pending age starts when the job becomes due.

## Deploying with Docker

The image (`Dockerfile` at the repository root) contains the built web app, the bundled API and operator commands,
the API's production dependencies and the SQL migrations. The web app's packages are build-time only and are not
installed in it.

```bash
docker build --build-arg APP_COMMIT="$(git rev-parse HEAD)" -t ideaproxima .
```

**Release steps** (once per deploy, before starting new instances):

```bash
docker run --rm -e DATABASE_URL="$DATABASE_URL" ideaproxima node apps/api/dist/migrate.js
docker run --rm -e DATABASE_URL="$DATABASE_URL" ideaproxima node apps/api/dist/seed.js   # base topics; idempotent
```

**Run:**

```bash
docker run -d -p 3000:3000 \
  -e DATABASE_URL="$DATABASE_URL" -e NODE_ENV=production \
  ideaproxima
```

The image declares a `HEALTHCHECK` against `GET /readyz`, runs as the unprivileged `node` user and listens on 3000 by default.
`CORS_ORIGINS` is needed only for a client hosted on another origin; the bundled web app is same-origin.

**The same layout locally:** `docker compose up --build` runs PostgreSQL, then a one-off `migrate` service (the release
steps above), then the app and worker once the migrations succeed. `--profile demo` adds the demo dataset. For production, the
compose file is a template rather than a deployment: replace the fixed credentials, drop the published PostgreSQL
port, put HTTPS in front of the API and remove the local `COOKIE_SECURE` and `ALLOW_INSECURE_COOKIES` overrides.

## Deploying without Docker

```bash
npm ci
npm run build                                    # → apps/web/dist + apps/api/dist/*.js
DATABASE_URL=… node apps/api/dist/migrate.js
DATABASE_URL=… node apps/api/dist/seed.js
DATABASE_URL=… NODE_ENV=production node apps/api/dist/main.js
```

`apps/api/dist/` must stay next to `apps/api/drizzle/` (migrations are read at runtime) and `apps/web/dist/` (or set
`WEB_ROOT`).

### Shutdown

On SIGINT or SIGTERM the process marks itself draining and readiness responds 503 immediately. After
`SHUTDOWN_DELAY_MS` it closes both listeners to new connections and lets active requests finish for up to
`SHUTDOWN_TIMEOUT_MS`. At the deadline it closes any remaining HTTP connections and forces the
PostgreSQL pool closed. It closes the database, flushes pending error reports and exits 0. An uncaught exception
or unhandled rejection emits a redacted fatal event and exits 1. Compose gives the app 40 seconds by default.
When changing either shutdown setting, set the orchestrator's grace period above their sum with time for cleanup.

## First admin and roles

A fresh deployment has no admin, and nobody can become one through the API. After the first person registers,
an operator promotes them:

```bash
node apps/api/dist/set-role.js <handle> admin              # production build / container
npm run admin:set-role -- <handle> admin                   # from a repository checkout
```

From then on, admins change roles through `PUT /v1/people/:handle/role` (never their own). Every role change is
recorded publicly in the activity ledger (`GET /v1/activity?action=person.role_changed`). Operator changes appear
with no actor.

## Database: migrations, backups, restore

- **Migrations** are plain SQL in `apps/api/drizzle/`, applied in order and tracked in the `drizzle` schema.
  `migrate.js` is safe to run repeatedly. Never edit an applied migration; add a new one.
- **The API never migrates a PostgreSQL database by itself** (only embedded PGlite in development). Migrating is
  an explicit release step, so several instances can never race on it.
- **Timeouts:** the API applies the configured pool and per-session settings. Operator commands retain their
  driver and database defaults for long migrations and metric rebuilds. PGlite accepts the session settings
  but uses one in-process connection, and its embedded runtime did not interrupt `pg_sleep` at the statement deadline.
  Use PostgreSQL to verify enforced database deadlines and contention.
- **History guards:** migration `0001_history_guards.sql` installs triggers that make recorded facts
  append-only. They also stop accidental `UPDATE`/`DELETE` by operators. That is intended.
- **Backups:** use standard PostgreSQL tooling, e.g. `pg_dump --format=custom "$DATABASE_URL" > ideaproxima.dump`
  on a schedule, plus point-in-time recovery if your provider offers it. The archive is meant to outlive the
  platform, so test restores regularly.
- **Restore:** `pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" ideaproxima.dump`, then
  `node apps/api/dist/rebuild-metrics.js` (derived data is recomputable from facts).

## Security checklist

- [ ] `NODE_ENV=production` and HTTPS in front of the API (cookies are then `Secure`, `HttpOnly`, `SameSite=Lax`).
- [ ] Before enabling forwarded addresses, verify on staging that the origin is reachable only through your
      trusted proxies. For hop counting, check that every ingress path has the same configured hop count and
      that each proxy appends its peer. For a single-value header, check that the edge overwrites it.
      Keep the socket default until you verify the topology. Keep addresses and network keys out of logs.
- [ ] `CORS_ORIGINS` lists exactly your frontend origins, or is empty when the frontend is served from the same
      origin.
- [ ] The database user has only the privileges the API needs. Keep `DATABASE_URL` in a secret store.
- [ ] Rate limits are **per process and in memory**. With several instances, use sticky sessions or put a shared
      rate limiter (proxy/WAF) in front.
- [ ] Not yet built (see `docs/agents/roadmap.md`): email verification, password reset, OAuth/ORCID. Plan around them
      before a public launch.

## Monitoring

- **Probes:** `GET /livez` returns 200 without querying PostgreSQL. `GET /readyz` returns 200 when the
  database answers and its newest migration matches the bundle. A 503 response names the failed check
  (`database`, `migrations` or `draining`). Use readiness for load balancers and container orchestration.
  The public `GET /v1/health` contract continues to report database connectivity only.
- **Logs:** stdout carries one completion event per request when `LOG_REQUESTS=true`. The event records
  `requestId`, `method`, `route`, `status`, `durationMs`, `actorId` and `bytesOut` (`null` when the
  response length is unavailable at dispatch). Static files log at `debug`. Unexpected errors emit a separate
  event with the same request ID and the SQLSTATE when available.
- **Error reporting:** startup logs the version, Git commit, driver and resolved settings with connection
  strings and filesystem paths masked. With `SENTRY_DSN` set, the process also forwards the fixed error
  message, source, SQLSTATE and request ID when present. The transport bounds pending sends and skips
  delivery during Sentry's `Retry-After` window. It uses the [Sentry envelope protocol](https://develop.sentry.dev/sdk/foundations/envelopes/).
- **Metrics:** scrape `GET /metrics` on `INTERNAL_PORT`. The listener binds to all container interfaces.
  Keep it on the monitoring network. The Compose file publishes only the app's public HTTP port for that
  service. Leave the internal port out of host port mappings and public proxy routes.
- **Moderation and governance:** the public activity feed (`/v1/activity?action=moderation.`) shows every
  moderation action with its reason.

| Metric                          | Type      | Labels                                                                                                      |
| ------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `http_requests_total`           | Counter   | `method`, `route`, `status`                                                                                 |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_class`                                                                           |
| `http_requests_in_flight`       | Gauge     | None                                                                                                        |
| `db_errors_total`               | Counter   | `code` (two-character SQLSTATE class observed at the HTTP boundary)                                         |
| `rate_limit_decisions_total`    | Counter   | `policy` (`requests`, `authentication`, `writes`), `outcome` (`allowed`, `denied`)                          |
| `password_hash_queue_depth`     | Gauge     | None                                                                                                        |
| Node process defaults           | Various   | Runtime metrics from `prom-client`, including event-loop lag, heap, GC and file descriptors where supported |

HTTP metrics describe public requests. Route labels come from registered patterns and use `unmatched` for
requests without a registered route, including web files served by middleware. The duration buckets are
5, 10, 25, 50, 100, 250 and 500 ms,
then 1, 2.5, 5 and 10 seconds.

## Maintenance tasks

| Task                                                                                 | How                                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Recompute derived metrics (after changing the metrics algorithm, or after a restore) | `node apps/api/dist/rebuild-metrics.js`                                       |
| Seed base topics on a new database                                                   | `node apps/api/dist/seed.js` (idempotent)                                     |
| Appoint or change roles without an admin                                             | `node apps/api/dist/set-role.js <handle> <member\|moderator\|admin>`          |
| Deactivate an abusive account                                                        | A moderator or admin calls `POST /v1/people/:handle/deactivate` with a reason |

### Legally required erasure

The archive is append-only by design: moderation _hides_ content, it never deletes it. When the law requires
real deletion (a court order, or a data-protection request that cannot be met by anonymising the person's
profile), an operator performs a deliberate, recorded procedure inside one transaction:

```sql
BEGIN;
ALTER TABLE comments DISABLE TRIGGER comments_guard;          -- only the table(s) concerned
UPDATE comments SET body = '[removed: legal request #123]' WHERE id = '…';
ALTER TABLE comments ENABLE TRIGGER comments_guard;
INSERT INTO activities (action, subject_kind, subject_id, payload)
  VALUES ('moderation.erased', 'comment', '…', '{"reason": "legal request #123"}');
COMMIT;
```

Prefer redaction over deletion, so that references from other records stay intact. To erase a person, anonymise
the `people` row (display name, bio, affiliation) and delete their `accounts` row. Their contributions then remain
attributed to an anonymous former contributor.

## Scaling

The API is stateless; run more instances behind a load balancer once the points above are addressed (shared rate
limiting). Known future steps, in the order they are likely to be needed:

1. Move derived-metric recomputation from the request path to a job queue (a table with `SKIP LOCKED` workers is
   enough). Callers don't change.
2. Keyset pagination for heavily used lenses.
3. Read replicas for public read traffic.
4. Semantic search (pgvector) in the same database.

Details: [`docs/agents/architecture.md`](../agents/architecture.md#scaling-notes-apply-when-needed-not-before).
