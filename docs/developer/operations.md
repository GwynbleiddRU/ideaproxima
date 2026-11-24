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

- **One stateless process** (Node.js ≥ 22.18): `apps/api/dist/main.js`. On `PORT` it serves the API at `/v1` and the
  built web app (`apps/web/dist`) at every other path. The web app's files are read once at startup and served from
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

| Variable                         | Default                                         | Meaning                                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | `pglite:./.data/pglite`                         | `postgres://user:pass@host:5432/db` in production. `pglite:memory` or `pglite:<dir>` for development.                                                                            |
| `PORT`                           | `3000`                                          | HTTP port.                                                                                                                                                                       |
| `NODE_ENV`                       | —                                               | Set `production` in production (makes cookies Secure by default).                                                                                                                |
| `SESSION_TTL_DAYS`               | `30`                                            | Session lifetime.                                                                                                                                                                |
| `COOKIE_SECURE`                  | `true` when `NODE_ENV=production`, else `false` | Mark the session cookie Secure (HTTPS only).                                                                                                                                     |
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
| `WEB_ROOT`                       | `apps/web/dist`, when it has been built         | Directory of the built web app to serve at `/`. `off` serves the API only (`GET /` then redirects to the `/v1` index).                                                           |

## Deploying with Docker

The image (`Dockerfile` at the repository root) contains the built web app, the bundled API and operator commands,
the API's production dependencies and the SQL migrations. The web app's packages are build-time only and are not
installed in it.

```bash
docker build -t ideaproxima .
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

The image declares a `HEALTHCHECK` against `GET /v1/health`, runs as the unprivileged `node` user and listens on 3000.
`CORS_ORIGINS` is needed only for a client hosted on another origin; the bundled web app is same-origin.

**The same layout locally:** `docker compose up --build` runs PostgreSQL, then a one-off `migrate` service (the release
steps above), then the app once the migrations succeed. `--profile demo` adds the demo dataset. For production, the
compose file is a template rather than a deployment: replace the fixed credentials, drop the published PostgreSQL
port, put HTTPS in front of the API and remove `COOKIE_SECURE: "false"`.

## Deploying without Docker

```bash
npm ci
npm run build                                    # → apps/web/dist + apps/api/dist/*.js
DATABASE_URL=… node apps/api/dist/migrate.js
DATABASE_URL=… node apps/api/dist/seed.js
DATABASE_URL=… NODE_ENV=production node apps/api/dist/main.js
```

`apps/api/dist/` must stay next to `apps/api/drizzle/` (migrations are read at runtime) and `apps/web/dist/` (or set
`WEB_ROOT`). The process stops gracefully on SIGINT/SIGTERM.

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

- **Health:** `GET /v1/health` returns `200 {"ok":true,"database":"up"}`, or `503` when the database is
  unreachable. Use it for load balancers and container orchestration.
- **Logs:** one line per request (`LOG_REQUESTS=true`) and stack traces for unexpected errors (`internal_error`
  responses) on stderr.
- **Moderation and governance:** the public activity feed (`/v1/activity?action=moderation.`) shows every
  moderation action with its reason.

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
