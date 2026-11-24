# 09 — Read scalability and performance

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/09-read-scalability-prompt.md`.

| Status     | Not started                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [01](01-operational-foundations.md) (metrics), [02](02-background-jobs.md) (jobs for materialised values), and the shapes of plans 04–08 (it paginates their lists); search queries are [06](06-multilingual-content-and-search.md)'s |
| Unblocks   | [13](13-public-web.md) (cache classes for pages); the contract freeze in [12](12-public-api.md) (this plan changes response shapes); the launch                                                                                       |
| Size       | 3 sessions (steps 28–30) · 11–15 engineer-days, plus 3–5 for phase D (step T2) when it is triggered                                                                                                                                   |

## Outcome

Read latency is measured against a realistic dataset and stays flat as the archive grows; anonymous traffic is
served by a cache; no endpoint returns an unbounded list; and the origin's capacity is a known number rather
than a hope ([audit](api-audit.md): PERF-2, PERF-3, PERF-5 to PERF-8, PERF-10, PERF-11, SEC-10).

## Rule: measure first

No optimisation in this plan is applied on belief. Phase A builds the dataset and the load test; every later
change is justified by a before-and-after number recorded in this document.

## Work

### A. A load-test harness

- `apps/api/scripts/seed-load.ts`: a generator for a realistic archive, sized by flags. Reference size
  "growth": 100,000 ideas across the twelve languages, 400,000 claims with shared claims, 3 million
  evaluations, 8 million stances with a long-tailed distribution (a few viral ideas), 1 million comments,
  20 million activities, 200,000 accounts. It writes with bulk `COPY`-style inserts, bypassing services, then
  runs the rebuild commands.
- `load/` at the repository root: [k6](https://k6.io) scenarios. `browse` (anonymous: lenses, idea pages with
  the six to eight calls a page makes, topics), `search`, `signed-in` (reads with a session, votes,
  evaluations, comments), `viral` (hundreds of concurrent voters on one idea).
- Budgets at the origin, at the reference size, on the reference hardware (2 vCPU API instance, 4 vCPU
  database): p95 ≤ 150 ms for reads, ≤ 300 ms for search, ≤ 250 ms for writes; error rate below 0.1 %.
- Enable `pg_stat_statements` in the compose PostgreSQL and review the top statements after each run.
- Record the baseline here before changing anything.

### B. Queries and response shapes

| Problem (audit)                                           | Change                                                                                                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offset pagination on lenses (PERF-2, SEC-10)              | Keyset cursors `{ v: metric value, id }`. Drive metric lenses from `idea_metrics` through a new index `(metric, value desc, idea_id desc)`, joining `ideas` for filters, so a page is an index range scan            |
| `neglected` computes a median per request                 | The metrics module materialises the global median attention (a singleton row in a small derived table), refreshed by a job every minute                                                                              |
| `emerging` counts 30 days of stances per idea per request | A per-idea metric `attention.30d`, refreshed with the other metrics and decayed by a daily job                                                                                                                       |
| Eleven unbounded lists (PERF-3)                           | Convert to pages `{ items, nextCursor }` with `limit` ≤ 100: an idea's claims, arguments, relations, involvements, initiatives, revisions, stage history; an argument's replies; topics stay a plain list but cached |
| `GET /claims/:claim` embeds all evidence and arguments    | Return the first page of each plus cursors; add `GET /claims/:claim/evidence` and `…/arguments`                                                                                                                      |
| `GET /people/:handle` embeds all involvements             | First page plus `GET /people/:handle/involvements`                                                                                                                                                                   |
| Graph traversal bounds depth, not size                    | Cap nodes at 500, nearest first, and return `truncated: true`                                                                                                                                                        |
| Topics aggregated per call (PERF-5)                       | Cache the topic list in process for 60 s (invalidate on topic or idea-topic change in the same process)                                                                                                              |
| Profile runs nine counts (PERF-6)                         | Rewrite `usefulReceived` on `target_id`; cache profile counts for 60 s; revisit as `person_metrics` in the scoring work                                                                                              |
| `ideasForArgument` walks one level per query (PERF-11)    | One recursive CTE                                                                                                                                                                                                    |

**Mutable rankings.** For metric lenses, publish immutable, bounded-lifetime ranking generations. Put the generation, lens/filter fingerprint, sort value and tie-breaking ID in the opaque cursor. Read subsequent pages from that generation and recheck current visibility before returning each item. Reject an expired or mismatched cursor with a documented restart response. Measure storage and rebuild cost at the reference size. Stable chronological lists can use their immutable ordering key directly.

**Viewer state leaves public resources.** `IdeaDetail.viewer` (the caller's stances, ratings, involvements,
stewardship) is what makes the same URL return different bodies. Move it to `GET /v1/ideas/:idea/viewer`
(signed-in only, never cached). At the edge, bypass shared-cache lookup and storage for cookies or authorization before serving a hit. Share only expressly public anonymous successes whose locale and representation are part of the cache key. Send private no-store on authenticated requests, errors and any response setting a cookie. The web app fetches both in
parallel. This and the pagination changes are breaking: they land before the freeze.

### C. Caching, compression, sessions

- **Cache rules are declared in the contract.** `EndpointSpec` gains `cache`:
  `{ scope: "public" | "private" | "none", maxAge, sMaxAge, staleWhileRevalidate }`. A middleware sets the
  headers; the generated reference documents them; a test requires every `GET` endpoint to declare one.

  | Class                                             | `Cache-Control`                                                    |
  | ------------------------------------------------- | ------------------------------------------------------------------ |
  | Vocabulary, locales, OpenAPI                      | `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` |
  | Topics, lenses, idea pages, lists, search         | `public, max-age=0, s-maxage=30, stale-while-revalidate=30`        |
  | Anything under `/v1/me`, viewer state, moderation | `private, no-store`                                                |
  | Responses to moderators                           | `private, no-store` (they may contain hidden content)              |

  Thirty seconds of staleness is acceptable for an archive and removes most origin load during a spike. The
  content class is kept short (at most a minute with revalidation) because a shared cache can also keep
  serving something a moderator has just hidden.

- **Hidden means gone from the edge too.** A `CachePurger` interface (`purge(urls)`) with a no-op default:
  `setVisibility()` enqueues a `cache.purge` job, in the same transaction, for the subject's own URLs (its API
  detail URL and web page, affected sitemap shards and the parent idea when applicable). Lists and search results are
  not purged; they age out within the content class's minute. Plan 10 phase D supplies the adapter for the
  chosen CDN's purge API. A test asserts the job is enqueued for every visibility change.

- `ETag` on `GET` responses (`hono/etag`) so revalidation costs no bandwidth; `Vary: Accept-Language` only on
  the localised endpoints; no `Vary: Cookie` on public resources once viewer state has moved out.
- **Compression** for JSON above 1 KB (`hono/compress`), unless the deployment's edge compresses; today API
  responses are sent uncompressed.
- **Session cache:** a per-process LRU from token hash to actor, 30 s lifetime, 10,000 entries. Revocation,
  deactivation and restriction publish the session ids on a PostgreSQL `NOTIFY` channel that every instance
  listens to on a dedicated connection, so they take effect immediately; the 30 s lifetime is only the
  fallback for memory reclamation. Flush and bypass the LRU on listener loss, reconnect or uncertain health, and revalidate privileged actions against current database state. Guard against a stale in-flight lookup repopulating an invalidated entry. Test missed notifications on two instances. PGlite runs in one process, so there the cache is invalidated in process; the cross-instance path
  is proven under `npm run test:pg`.

### D. When the numbers ask for it

Each item has a trigger; none is done in advance.

| Step                                 | Trigger                                                     | Notes                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Connection pooler (transaction mode) | More than ~8 API and worker processes, or connection limits | `prepare: false` in postgres.js; `LISTEN` connections bypass the pooler; advisory transaction locks are compatible         |
| Read replica for anonymous reads     | Primary CPU above 60 % at peak after caching                | `Ctx.dbRead`: anonymous requests read the replica, signed-in requests the primary, which avoids read-your-writes surprises |
| Partition `activities` by month      | Beyond ~50 million rows or when its indexes outgrow memory  | Declarative partitioning in a custom migration; the history guards are per partition                                       |
| Autovacuum tuning for hot tables     | Bloat visible on `idea_metrics`, `jobs`, `rate_limits`      | Per-table scale factors                                                                                                    |

## Capacity model

Planning figures to be replaced by phase A's measurements. One 2-vCPU API instance is assumed to serve about
150 dynamic requests per second at p95 within budget; a CDN is assumed to absorb 50–70 % of anonymous reads.

| Stage  | Monthly users | Daily users | Peak requests/s at the edge | Peak at origin | API instances          | Database                  |
| ------ | ------------- | ----------- | --------------------------- | -------------- | ---------------------- | ------------------------- |
| Launch | 10,000        | 1,500       | ≈ 5                         | ≈ 4            | 1 (2 for availability) | 2 vCPU, 4 GB              |
| Growth | 100,000       | 15,000      | ≈ 45                        | ≈ 30           | 2–3                    | 4–8 vCPU, 16–32 GB        |
| Large  | 1,000,000     | 150,000     | ≈ 450                       | ≈ 300          | 4–6                    | 16+ vCPU, 64 GB, replicas |

Assumptions: daily users are 15 % of monthly users; 25 API calls per daily user per day, and as much again from
crawlers and anonymous visitors (the half a cache can absorb); a peak five times the daily average; 0.65
writes per daily user per day. Instance counts include about 50 % headroom. Storage grows by roughly 1 GB,
10 GB and 100 GB a year at the three stages (text, ledger and indexes), which PostgreSQL carries comfortably.

## Phases

| Phase | Scope                                                             | Days |
| ----- | ----------------------------------------------------------------- | ---- |
| A     | Load dataset, k6 scenarios, baseline report                       | 3–4  |
| B     | Keyset lenses, materialised values, pagination, viewer split, web | 5–7  |
| C     | Cache declarations and headers, ETag, compression, session cache  | 3–4  |
| D     | Pooler, replica, partitioning, as triggered                       | 3–5  |

## Verification

- Every changed query: `EXPLAIN (ANALYZE, BUFFERS)` at the reference size, before and after, pasted into the
  phase report.
- Keyset pagination: no row skipped or repeated while values change between pages (a test that mutates metrics
  mid-listing).
- Cache rules: a test asserts each `GET` endpoint's declared headers; a signed-in and an anonymous request to
  the same public resource return identical bodies; moderators never receive a cacheable response.
- Session cache: a revoked session is rejected on another instance within a second (`npm run test:pg`, two
  app instances on one database).
- The load test meets the budgets; the capacity table is updated with measured numbers.
- `npm run check`, `npm run test:pg`, `npm run test:e2e`.

## Documentation to update

`docs/agents/architecture.md` (scaling notes become decisions; ADR-11 amended for keysets),
`docs/agents/api-architecture.md` (a rule: public resources carry no viewer state),
`docs/developer/developer-guide.md` (pagination, caching, "declare cache rules for a new endpoint"),
`docs/developer/operations.md` (load testing, capacity, the scaling ladder).

## Risks

- **Caching something private.** The default for an undeclared endpoint is `no-store`, and the moderator rule
  is enforced centrally, not per route.
- **Stale reads after a write.** The web app already updates its own cache after mutations; with a 30 s shared
  cache, the acting user's view comes from the uncached viewer endpoint and from optimistic updates.
- **Breaking the bundled client.** Every shape change is made together with the web app in the same change.
