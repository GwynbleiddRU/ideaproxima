# API audit (2026-11-16)

A complete read of the API as it stands at commit `85212fa` (2026-11-16): `apps/api`, `packages/domain`,
`packages/contracts`, the migrations, the tests, the Dockerfile, the compose file and CI. It is the evidence
base of the [production-readiness program](README.md): every finding names the plan that fixes it.

Line numbers are hints (they drift); function names are the stable reference.

## How it was verified

- **Code reading**: every file under `apps/api/src`, `packages/domain/src`, `packages/contracts/src`, both
  migrations, the test harness and the deployment files.
- **Probes against the real app** (in-process, in-memory database, through the test harness). Findings marked
  _measured_ were reproduced this way:
  - a hidden claim answers 404, yet its statement is still served by `GET /v1/activity` and the idea timeline;
  - login takes 0.6 ms for an unknown e-mail and 53 ms for a registered one (median of 8);
  - titles in Russian, Chinese and Arabic received the slugs `idea`, `idea-2`, `idea-3`;
  - search finds `engine` → "engines" but not `двигатель` → "двигатели", and nothing inside a Chinese title.
- **Local measurements** on the development machine (Ryzen 7 7700, Node 24.16): one scrypt hash at the
  configured cost takes 49–54 ms; with Node's default four-thread pool a process tops out at ~73 hashes/s.
- **PostgreSQL 17 catalogue** (PGlite 17.5): text-search configurations exist for `arabic`, `english`, `french`,
  `german`, `hindi`, `indonesian`, `portuguese`, `russian`, `spanish` (and 19 others); there is none for
  Chinese, Japanese or Korean.

## Inventory

| Aspect     | Today                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shape      | One Node process (Hono) serving `/v1` and the built web app; one PostgreSQL database; PGlite for development and tests             |
| Endpoints  | 66 catalogued (29 reads, 37 writes) in 8 tags; every one contract-checked and exercised by tests                                   |
| Modules    | 12: identity, catalog, ideas, knowledge, signals, graph, practice, discussion, moderation, history, search, metrics                |
| Tables     | 24: 17 fact tables with history guards, projections on `ideas`/`idea_topics`, one derived table (`idea_metrics`)                   |
| Tests      | ~80 API integration tests, 38 domain unit tests, 15 web unit tests, a Playwright audit; the whole suite also runs on PostgreSQL 17 |
| Abuse      | Two in-memory fixed-window limits (auth per address, writes per account), a 1 MiB body limit, JSON-only writes                     |
| Moderation | `POST /v1/moderation` hides or restores six kinds of content; account deactivation; a public moderation log                        |
| Languages  | English only: vocabulary, errors, search configuration, slugs, formats, interface                                                  |
| Background | None: everything happens inside a request                                                                                          |
| Operations | Text request log, `GET /v1/health`, Docker image, compose stack, CI with four jobs                                                 |

## Strengths to preserve

These are the reasons the API can be scaled rather than rewritten. No plan may weaken them.

1. **Append-only facts enforced by the database** (`0001_history_guards.sql`). Moderation hides, it never
   deletes. Every plan that adds a fact table adds its guard.
2. **An executable contract.** `ENDPOINTS` drives validation, OpenAPI, the generated reference, exact response
   checks and enforced endpoint coverage. New capabilities (limits, cache rules, localisation) should be declared
   there too, so they are documented and tested by construction.
3. **One permission policy, one vocabulary, one error mapping.** Each is a single file.
4. **Three data tiers.** Derived data is disposable and labelled with its algorithm. The program adds derived
   tables (search index, embeddings); each gets exactly one writer module and a rebuild command.
5. **Correct concurrency**, proven on real PostgreSQL: advisory locks per logical key, idempotent state writes.
6. **Statelessness.** Sessions are rows; nothing lives on local disk. Horizontal scaling needs shared rate limits
   and a job runner, not a redesign.
7. **Separation of popularity and quality**, and "no data is `null`, never `0`". AI moderation and trust tiers
   must stay out of both.
8. **One origin, strict CSP, no third-party scripts or fonts.** This is also what makes the product reachable
   in regions where third-party services are blocked.

## Findings

Severity: **S1** fix before the API is exposed to the public; **S2** fix before growth or launch; **S3**
improvement. "Plan" is the plan in this folder that resolves the finding.

### Security and abuse

**SEC-1 · S1 · The client address can be forged behind a proxy.** `clientAddress()`
(`apps/api/src/http/rate-limit.ts`, ≈ line 55) takes the _first_ `X-Forwarded-For` value when `TRUST_PROXY=true`.
Proxies append the address they saw, so the first value is whatever the client sent. An attacker rotates fake
addresses and every per-address limit disappears. _Fix:_ count trusted hops from the right, or read one
edge-specific header. → [00](00-immediate-hardening.md)

**SEC-2 · S1 · Login reveals which e-mails are registered** (_measured_: 0.6 ms vs 53 ms). `login()`
(`modules/identity/service.ts`, ≈ line 233) skips password verification when the account does not exist, so the
uniform error message is defeated by timing. Registration states "That email is already registered" outright
(S2). _Fix:_ always verify against a dummy hash; make registration non-enumerating once e-mail verification
exists. → [00](00-immediate-hardening.md), [04](04-accounts-and-trust.md)

**SEC-3 · S1 · Password hashing is an unmetered CPU sink.** scrypt with N=2¹⁵ costs ~50 ms on a fast desktop
core (more on cloud vCPUs) and runs on the libuv pool (four threads). The only brake is 10 attempts per minute
per address, which a botnet or one IPv6 subnet bypasses; saturating the pool also delays everything else that
uses it. _Fix:_ a bounded concurrency guard around hashing, and global and per-account auth limits.
→ [00](00-immediate-hardening.md), [03](03-rate-limiting.md)

**SEC-4 · S1 · The session lookup runs before any limiter.** In `createApp()` (`app.ts`, ≈ lines 77–108) every
request carrying any bearer token or cookie costs a database query before it can be rejected. _Fix:_ a cheap
per-network limiter first, and reject tokens that do not have the shape of a session token (43 base64url
characters) without touching the database. → [00](00-immediate-hardening.md)

**SEC-5 · S1 · Reads are not limited at all.** The write limiter returns no key for `GET`. Expensive public
reads include `/v1/search` (four queries, two of them sequential scans), `/v1/ideas?lens=neglected` (a median
over all ideas), `/v1/ideas/:idea/graph?depth=4` (a recursive CTE) and `/v1/topics` (aggregates over every idea).
→ [00](00-immediate-hardening.md) for a ceiling, [03](03-rate-limiting.md) for policies

**SEC-6 · S1 · Per-address limits mean nothing on IPv6.** Keys use the full address; a home connection owns a
/64 (2⁶⁴ addresses). _Fix:_ key IPv6 clients by prefix. → [00](00-immediate-hardening.md)

**SEC-7 · S2 · The limiter is coarse.** Fixed windows allow twice the limit across a window edge; counters are
per process; there are only two policies; nothing distinguishes a comment from a vote, a new account from an
established one, or a search from a page view. → [03](03-rate-limiting.md)

**SEC-8 · S1 before open registration · No friction for bots, full quota for unverified accounts.**
Registration needs no proof of work, CAPTCHA or e-mail verification (`accounts.email_verified_at` exists and is
never written), and a fresh account may make 120 writes per minute: 172,800 per day.
→ [03](03-rate-limiting.md), [04](04-accounts-and-trust.md)

**SEC-9 · S2 · No per-account login throttling.** Guessing one account's password from many addresses is only
limited per address. → [03](03-rate-limiting.md)

**SEC-10 · S2 · Offset cursors are unbounded.** `decodeCursor()` accepts any non-negative offset, so a client
can force `OFFSET 100000000` on every lens. → [00](00-immediate-hardening.md) caps it,
[09](09-read-scalability.md) replaces offsets with keysets

**SEC-11 · S3 · An undocumented error code and unstructured error logs.** `handleError()` answers Hono's
`HTTPException` with the code `http_error`, which the contract does not list; unexpected errors go to
`console.error` with no request context. → [01](01-operational-foundations.md)

**SEC-12 · S2 · No second factor for moderators and admins,** although their sessions can hide content and
deactivate accounts. → [04](04-accounts-and-trust.md)

**SEC-13 · S3 · Session tokens are the only credential for non-browser clients:** full account power for 30
days, no scopes, no per-client revocation. → [12](12-public-api.md)

### Moderation, trust and safety

**MOD-1 · S1 · Hidden content stays public through the ledger** (_measured_). Activity payloads carry text:
`claim.stated` the statement, `argument.made` and `initiative.created` the title, `source.registered` the
title, `revision.*` the change note, `initiative.status_changed` and `evidence.withdrawn` free-text notes. The
feed (`modules/history/service.ts`, `page()`) filters only activities of hidden _ideas_, so hiding a claim,
argument or initiative leaves its text readable in `/v1/activity`, idea timelines and profile activity. The
ledger is append-only, so the text cannot be removed afterwards; it has to be withheld on read.
→ [00](00-immediate-hardening.md) redacts, [07](07-moderation-core.md) stops writing text into payloads

**MOD-2 · S1 before launch · Many text surfaces cannot be moderated.** Only ideas, claims, evidence, arguments,
comments and initiatives can be hidden. Out of reach: the content of a proposed or accepted revision (a spam
proposal on a legitimate idea stays readable at `GET /ideas/:idea/revisions/:revision` forever), sources (title,
authors, URL), outcomes, the public rationale of an evaluation, relation rationales, involvement notes,
stage-transition rationales, change and decision notes, withdrawal reasons, and profile fields (display name,
bio, affiliation). → [07](07-moderation-core.md)

**MOD-3 · S3 · Hidden evidence still returns `limitations`, `locator` and `withdrawnReason`.** `evidenceDtos()`
blanks only `summary`. → [00](00-immediate-hardening.md)

**MOD-4 · S1 before launch · No reports, queue, appeals, notices or written policy.** Moderators find problems
by browsing; people cannot flag anything; an author is never told that or why their content was hidden and has
no way to contest it. → [07](07-moderation-core.md)

**MOD-5 · S2 · Actions are one item at a time.** Cleaning up after a spam account means one call per item.
→ [07](07-moderation-core.md)

**MOD-6 · S1 before open registration at scale · Nothing screens content automatically.**
→ [08](08-ai-moderation.md)

**MOD-7 · S2 · A moderation act is only a ledger entry with free text.** There is no structured decision
(reason code, whether automated, which reports it answers, whether it was appealed), so statistics, statements
of reasons and model evaluation have nothing to build on. → [07](07-moderation-core.md)

**MOD-8 · S3 · Deactivated accounts keep a fully public profile,** including a bio that may be the reason for
the deactivation. → [07](07-moderation-core.md)

### Localisation

**I18N-1 · S1 for a worldwide product · Search is English-only** (_measured_). The generated columns
`ideas.search` and `claims.search` and every query use the `english` configuration. Russian text is neither
stemmed nor stripped of stop words; Chinese and Japanese text is not segmented, so only whole-title matches
work. → [06](06-multilingual-content-and-search.md)

**I18N-2 · S1 for a worldwide product · Slugs are ASCII-only** (_measured_). `slugify()`
(`packages/domain/src/rules/content.ts`) drops every character outside `a–z0–9`. Non-Latin titles all become
`idea-N`; German loses `ß`. Worse, `uniqueSlug()` then loads every `idea-%` slug while holding the advisory lock
`idea-slug:idea`, so all non-Latin proposals serialise behind an O(n) scan.
→ [06](06-multilingual-content-and-search.md)

**I18N-3 · S1 for a worldwide product · Content has no language.** Nothing records what language an idea or a
comment is written in, so the API cannot choose a search analyser, filter a lens, set `lang`/`dir` for
rendering, or route moderation. → [06](06-multilingual-content-and-search.md)

**I18N-4 · S1 for a worldwide product · Every product string is an English literal.** About 310 vocabulary
strings in `packages/domain/src/vocabulary` (116 labels, 113 descriptions, 12 questions, 8 prompts, 7 inverse
phrases, 55 scale anchors), 24 topic strings, ~90 error sites, and the web interface (61 `.tsx` files, ~9,900
lines; formats pinned to `en` in `lib/format.ts`; an English-only `plural()`; `<html lang="en">`).
→ [05](05-localization.md)

**I18N-5 · S2 · Errors cannot be localised by clients.** `error.message` is an interpolated English sentence;
within a code there is no stable reason ("That handle is taken" and "That email is already registered" are both
`conflict`), and validation issues carry zod's English text without a code. → [05](05-localization.md)

**I18N-6 · S3 · Limits are tuned for English.** Lengths count UTF-16 units; minimums such as "summary ≥ 20
characters" are several times stricter in Chinese or Japanese than in English.
→ [06](06-multilingual-content-and-search.md)

**I18N-7 · S2 for Arabic, Hindi and CJK · The interface assumes left-to-right Latin text.** 63 physical
direction declarations (`margin-left`, `left:` …) across 47 stylesheets, letter-spacing in 11 of them (it breaks
Arabic joining), and bundled fonts that cover only Latin, Cyrillic and Greek. → [05](05-localization.md)

**I18N-8 · S3 · Case-insensitive matching depends on the database locale** (`ILIKE` in people and source
search). → [06](06-multilingual-content-and-search.md), [10](10-deployment-and-operations.md)

### Scalability

**PERF-1 · S2 · Every signal write recomputes an idea's metrics under a lock.** `refreshIdeaMetrics()` takes a
per-idea advisory lock, runs five queries (one counts distinct actors over the ledger), deletes ~23 rows and
inserts them again, inside the request. Concurrent voters on a popular idea queue behind each other.
→ [02](02-background-jobs.md)

**PERF-2 · S2 · Lenses do not scale with the archive.** Offset pagination everywhere; `neglected` recomputes
the median attention of all ideas per request; `emerging` runs a 30-day count over `stances` for every idea per
request (`lensPlan()` in `modules/ideas/queries.ts`). → [09](09-read-scalability.md)

**PERF-3 · S2 · Eleven endpoints return unbounded lists:** an idea's claims, arguments, relations,
involvements, initiatives, revisions and stage history; a claim's evidence and arguments; an argument's replies;
a profile's involvements; and topics. The graph endpoint bounds depth but not the number of nodes. Paginating
them changes response shapes, so it must happen before the contract freezes.
→ [09](09-read-scalability.md), [12](12-public-api.md)

**PERF-4 · S2 · Search scans.** `searchPeople()` and `searchSources()` use `ILIKE '%…%'` without an index;
`/v1/search` runs four queries and has no pagination. → [06](06-multilingual-content-and-search.md)

**PERF-5 · S3 · Topics are aggregated on every call,** and `getTopic()` computes all topics to return one.
→ [09](09-read-scalability.md)

**PERF-6 · S3 · A profile view runs nine count subqueries;** `usefulReceived` filters `evaluations` by
`comment_id`/`argument_id`, which have no index (only `target_id` has). → [09](09-read-scalability.md)

**PERF-7 · S2 · One query per authenticated request for the session, and sessions are never purged.**
→ [02](02-background-jobs.md) purges, [09](09-read-scalability.md) caches

**PERF-8 · S2 · API responses are neither cacheable nor compressed.** No `Cache-Control`, `ETag` or `Vary`;
JSON is sent uncompressed; viewer-specific state is embedded in public resources (`IdeaDetail.viewer`), which
keeps them from being shared by a cache. → [09](09-read-scalability.md)

**PERF-9 · S2 · The database client has no guard rails.** A fixed pool of 10 (`db/client.ts`), no statement,
lock or idle-in-transaction timeouts, no retry on deadlock or serialisation failure.
→ [01](01-operational-foundations.md)

**PERF-10 · S3 · The ledger grows without bound** in one table with a GIN index on `idea_ids`.
→ [09](09-read-scalability.md)

**PERF-11 · S3 · `ideasForArgument()` issues one query per level** of a rebuttal chain (up to 50).
→ [09](09-read-scalability.md)

### Operations

**OPS-1 · S1 before launch · The service cannot be observed.** A text line per request, stack traces on
stderr; no request ids, metrics, traces or error tracking. → [01](01-operational-foundations.md)

**OPS-2 · S2 · One health endpoint.** No liveness/readiness split, and an instance started against a database
with missing migrations reports healthy and then fails requests. → [01](01-operational-foundations.md)

**OPS-3 · S2 · Shutdown does not drain.** `main.ts` calls `server.close()` without waiting and closes the
database at once. → [01](01-operational-foundations.md)

**OPS-4 · S2 · Configuration fails open.** `int()` and `bool()` silently fall back on typos; nothing stops
production from running on PGlite or with insecure cookies. → [01](01-operational-foundations.md)

**OPS-5 · S1 enabler · Nothing can run outside a request.** No cleanup, e-mail, moderation, digests or
recomputation is possible. → [02](02-background-jobs.md)

**OPS-6 · S2 · No delivery pipeline.** CI builds the image and throws it away; no registry, release workflow,
dependency or image scanning, or SBOM. → [10](10-deployment-and-operations.md)

**OPS-7 · S1 before launch · Backups are described, not automated or rehearsed.**
→ [10](10-deployment-and-operations.md)

**OPS-8 · S2 · Only single-instance operation has ever been exercised.**
→ [10](10-deployment-and-operations.md)

### Contract

**API-1 · S2 · Breaking changes are still pending.** Pagination of unbounded lists (PERF-3), the viewer split
(PERF-8), error reasons (I18N-5), activity payloads (MOD-1) and language fields (I18N-3) all change response
shapes. They are cheap today, because the only client is the bundled web app, and expensive after launch.
→ [12](12-public-api.md) owns the freeze checklist

**API-2 · S3 · No idempotency for event-type POSTs.** A retried `POST` of a comment, claim or idea creates a
duplicate. → [12](12-public-api.md)

### Privacy and compliance

**PRIV-1 · S2 · No self-service export or deletion;** erasure is a manual SQL procedure.
→ [04](04-accounts-and-trust.md), [10](10-deployment-and-operations.md)

**PRIV-2 · S1 before launch (owner) · No record of accepted terms, and no licence for contributions**
(open question 12). → [04](04-accounts-and-trust.md) builds the mechanism; the owner chooses the texts

**PRIV-3 · S3 · No retention schedule** for sessions, logs or security data.
→ [10](10-deployment-and-operations.md)

## Summary by severity

53 findings: 19 S1, 22 S2, 12 S3.

- **S1 (19):** a forgeable client address, account enumeration, CPU exhaustion, unlimited reads, the ledger
  leak, no reports or automated screening, English-only search, slugs and strings, no observability, no
  background work, unrehearsed backups, no terms or licence.
- **S2 (22):** coarse limits, lens and list scalability, caching, database guard rails, structured decisions,
  delivery.
- **S3 (12):** clean-ups and later optimisations.

Seven S1 findings (SEC-1 to SEC-6 and MOD-1) are small code changes with no design decision attached. They are
grouped in [00 — Immediate hardening](00-immediate-hardening.md) and should ship first.
