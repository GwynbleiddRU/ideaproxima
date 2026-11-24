# 00 — Immediate hardening

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/00-immediate-hardening-prompt.md`.

| Status     | Done 2026-11-25 · H1–H6 verified                                                  |
| ---------- | --------------------------------------------------------------------------------- |
| Depends on | Nothing                                                                           |
| Unblocks   | Everything else: later plans assume a trustworthy client address and a clean feed |
| Size       | 1 session (step 1) · 2–3 engineer-days                                            |

## Outcome

The nine findings that need no design decision are closed. Seven of them block a public launch: a forgeable
client address, account enumeration by timing, CPU exhaustion through password hashing, database work for
unauthenticated floods, unlimited reads, IPv6 evasion, and hidden text leaking through the activity ledger
(SEC-1 to SEC-6, MOD-1). Two are smaller and touch the same code: hidden evidence still returning three text
fields (MOD-3) and unbounded offset cursors (SEC-10) ([audit](api-audit.md)).

Nothing here adds a subsystem. The limiter keeps its fixed windows and in-memory store;
[03 — Rate limiting](03-rate-limiting.md) replaces the algorithm and the policies later, on top of the address
handling built here.

## Changes

### H1 — A client address that cannot be forged (SEC-1, SEC-6)

New module `apps/api/src/http/client-address.ts`; `clientAddress()` leaves `rate-limit.ts`.

| Variable                 | Default | Meaning                                                                                                   |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------- |
| `TRUST_PROXY_HOPS`       | `0`     | How many reverse proxies you operate in front of the API. `0`: use the socket address.                    |
| `CLIENT_IP_HEADER`       | unset   | A single-value header set by your edge (`cf-connecting-ip`, `fly-client-ip`, `x-real-ip`). Wins when set. |
| `RATE_LIMIT_IPV6_PREFIX` | `64`    | Prefix length that identifies one IPv6 client network.                                                    |

Rules:

1. With `TRUST_PROXY_HOPS = n > 0`, split `X-Forwarded-For` on commas and take the entry `n` positions from the
   **right**. Each trusted proxy appends the address it saw, so the right-most `n` entries are the only ones a
   client cannot write. Fewer than `n` entries: fall back to the socket address.
2. Both forwarded modes require every ingress path to pass through the configured trusted proxies. Verify
   origin isolation and consistent hop counts on staging. A trusted edge must overwrite a single-value
   header. If those conditions cannot be established, use the socket address.
3. Normalise the result with `node:net`: unwrap IPv4-mapped IPv6 (`::ffff:203.0.113.7`), lower-case, and reduce
   IPv6 to its network (`2001:db8:abcd:12::/64`). The function returns a **network key** (`v4:…` or `v6:…/64`),
   not a raw address. Anything unparsable becomes `unknown`, which is one shared bucket.
4. `TRUST_PROXY=true` is accepted for one release as `TRUST_PROXY_HOPS=1` with a start-up warning, then removed.
   This changes behaviour on purpose: first entry → last entry.

Tests (pure, no HTTP needed): a forged left-most entry is ignored; two hops; a missing header; IPv4-mapped
addresses; two addresses in one /64 share a key; garbage input.

### H2 — Refuse floods before they reach the database (SEC-4, SEC-5)

1. Add a network-keyed limiter for **every** `/v1` request (reads included), mounted before session resolution.
   `RATE_LIMIT_REQUESTS_PER_MINUTE`, default `600`, `0` disables. It reuses the existing `rateLimit()`.
2. In the session middleware, look a token up only if it matches `/^[A-Za-z0-9_-]{43}$/` (what
   `newSessionToken()` produces). Anything else is an anonymous request with no query.
3. New middleware order in `createApp()`: security headers → logging → web app files → CORS → body limit →
   **network limiter** → session resolution → auth and write limiters → routes. Update the comment that
   documents the order. Today `c.set("config", …)` happens inside the session middleware, and
   `clientAddress()` reads it: move that assignment into an earlier middleware so the network limiter can
   resolve the address.
4. The test harness disables the new limit by default, like the other two, and so does the browser audit's
   server (`audit/server.ts`), which sets the limit variables to `0`.

Tests: the 601st request in a minute from one network answers 429 with `Retry-After`, including `GET`; a
malformed bearer token triggers no session query (assert through a counting wrapper around `resolveSession`, or
by passing a database handle that throws).

### H3 — Constant-time login and a bound on hashing (SEC-2, SEC-3)

1. `login()` always calls `verifyPassword()`: against the stored hash, or against a module-level dummy hash
   (computed once at start-up with the current parameters) when the account is unknown or deactivated. The
   result is ignored in the second case.
2. Wrap `hashPassword()` and `verifyPassword()` in a semaphore inside `modules/identity/crypto.ts`:
   `PASSWORD_HASH_CONCURRENCY` (default `3`, leaving one libuv thread free) and a bounded waiting queue,
   `PASSWORD_HASH_QUEUE` (default `32`). When the queue is full, throw an error that the HTTP layer maps to
   **503** with the new code `unavailable` and `Retry-After: 1`.
3. Add `unavailable` (503) to the error table in the developer guide and to the OpenAPI default description
   (`packages/contracts/src/openapi.ts`).

Tests: unknown and known e-mails both invoke the hash function exactly once (spy on the module); with
concurrency 1 and queue 1, a third simultaneous login answers 503 `unavailable`.

Expected capacity after the change: about `PASSWORD_HASH_CONCURRENCY ÷ hash time` logins per second per
process (≈ 55/s on the development machine, 20–35/s on typical cloud vCPUs), with everything beyond that
rejected in microseconds instead of queueing.

### H4 — Hidden text no longer leaks through the ledger (MOD-1)

In `modules/history/service.ts`, `page()`:

1. After loading a page of activities, resolve the visibility of their **subjects** in batches, one query per
   kind present: `claim`, `evidence`, `argument`, `comment`, `initiative` by `hidden_at`; `idea_claim` through
   its claim. Moderators skip this step.
2. For an activity whose subject is hidden, return `payload: {}` and `subject.hidden: true`. Keep the row: the
   timeline stays honest and pagination stays exact. Moderation entries are never redacted.
3. `ActivityDto.subject` gains `hidden: boolean` (always present). Update the schema in
   `packages/contracts/src/responses.ts`, run `npm run docs:api`.
4. The web feed (`apps/web/src/components/ActivityFeed.tsx`) renders "content hidden by moderation" for such
   entries instead of quoting the payload.

This is the read-side fix. [07 — Moderation core](07-moderation-core.md) removes free text from new payloads
and extends hiding to revisions, sources and field-level text.

Tests: extend `governance.test.ts` with the probe from the audit: hide a claim and an argument on a visible
idea, then assert that neither text appears in `/activity`, the idea timeline or the author's profile activity
for an anonymous reader, and that a moderator still sees it.

### H5 — Hidden evidence returns no text (MOD-3)

`evidenceDtos()` blanks `limitations`, `locator` and `withdrawnReason` together with `summary` for
non-moderators. One test.

### H6 — A ceiling on offset cursors (SEC-10)

`offsetFrom()` rejects offsets above 10,000 with `validation_failed` ("Narrow the list with a filter").
Document the ceiling under "Pagination" in the developer guide. [09](09-read-scalability.md) replaces offsets
with keysets, after which the ceiling only guards legacy cursors.

## Documentation to update

- `docs/developer/operations.md`: the three new variables, the deprecation of `TRUST_PROXY`, and the security
  checklist item about proxies.
- `apps/api/.env.example`.
- `docs/developer/developer-guide.md`: the error table (`unavailable`), pagination ceiling.
- `docs/agents/architecture.md`: an addendum to ADR-17 (network keys, limiter order, hashing guard).
- `docs/developer/api-reference.md` and `openapi.json` through `npm run docs:api`.

## Verification

`npm run check`, `npm run test:pg` (the feed query changed), `npm run test:e2e` (the feed component changed).

## Risks

- **A wrong hop count can group unrelated clients or trust the wrong sender.** Verify the expected bucket in
  an isolated fixture and check staging ingress rules. Keep raw addresses and limiter keys out of logs.
- **The dummy hash must use the live parameters,** or timing differs again when parameters are raised. Derive
  it from the same constants.

## Implementation notes

Step 1 began on clean `main` at `be5eb61`. The sequence had no preceding row or owner gate. Baseline
`npm run check` passed (133 tests, all 66 endpoints). The Windows sandbox prevented tsx from reading the
current user, so the baseline and verification commands using tsx ran with host access.

| Change            | Local regression evidence                                                                                                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 · SEC-1, SEC-6 | `http/client-address.ts` supplies network keys to all three limiters. `client-address.test.ts` checks hop selection, short chains, the legacy alias, edge-header precedence, mapped IPv4, IPv6 masking and invalid input. Origin isolation and hop counts are deployment-specific checks in the operations guide.             |
| H2 · SEC-4, SEC-5 | In `app.ts`, the network budget precedes session resolution. `request-guards.test.ts` admits 600 reads from one network and rejects the next with 429 and a retry header, before the session resolver runs. Malformed bearer and cookie values produce zero lookups.                                                          |
| H3 · SEC-2, SEC-3 | The identity service verifies once for active, missing and deactivated accounts. Its crypto module computes the dummy hash at startup and bounds all scrypt work. `request-guards.test.ts` verifies the call counts, one active and one waiting login, overflow with 503 and a one-second retry, and subsequent recovery.     |
| H4 · MOD-1        | The history service batches visibility by subject kind, including claim links. `governance.test.ts` checks public redaction and moderator access in all three feeds, public moderation reasons and restoration. The Activity DTO and feed carry the visibility result. `audit/e2e/browse.spec.ts` checks the rendered notice. |
| H5 · MOD-3        | `knowledge.test.ts` covers the contributor withdrawing hidden evidence. This HTTP response uses `evidenceDtos()` and blanks all four text fields. A moderator's claim detail retains their original values. Public claim detail already omits hidden evidence.                                                                |
| H6 · SEC-10       | `shared/pagination.ts` checks the decoded offset before the list query. `ideas.test.ts` accepts 10,000 and returns 400 `validation_failed` at 10,001.                                                                                                                                                                         |

**Login timings.** Node 24.16.0, fresh PGlite harness, one registered fixture, identical wrong password.
Each run alternated the two e-mails for eight rounds through in-process `POST /v1/auth/login`.
All calls returned 401. Medians use the mean of the two middle observations.

| Account    | Before (ms) | After (ms) |
| ---------- | ----------: | ---------: |
| Unknown    |        1.29 |      51.01 |
| Registered |       50.10 |      51.50 |

**Verification.** `npm run docs:api` regenerated the reference and OpenAPI. `npm run check` passed
with 144 tests and all 66 endpoints covered. `npm run test:pg` passed the same 144 tests and contract
coverage on isolated PostgreSQL 17.12. `npm run test:e2e` passed all 53 browser checks, including the
moderation notice and accessibility in both themes.

**Handoff.** No owner decision is pending for this step. The next eligible row is step 2, plan 01 phase A,
using `prompts/api/01-operational-foundations-prompt.md`. Keep the network limiter ahead of session lookup
when adding request logs and metrics.
