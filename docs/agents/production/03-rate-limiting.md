# 03 — Rate limiting and abuse protection

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/03-rate-limiting-prompt.md`.

| Status     | Phase A complete 2026-11-25 (step 10). Step 11, phase B, is next.                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [00](00-immediate-hardening.md) (network keys), [01](01-operational-foundations.md) (metrics, configuration), [02](02-background-jobs.md) (the PostgreSQL store's purge schedule) |
| Unblocks   | Open registration; [07](07-moderation-core.md) (report limits); [12](12-public-api.md) (key quotas)                                                                               |
| Size       | 3 sessions (steps 10–12) · 8–11 engineer-days, plus 1–2 for the Redis store (step T1) when it is needed                                                                           |

## Outcome

Every request is governed by a named, documented policy that depends on what it does and who makes it; limits
hold across any number of API instances; clients are told their budget in standard headers; and creating
accounts in bulk costs an attacker real compute ([audit](api-audit.md): SEC-3, SEC-5, SEC-7, SEC-8, SEC-9).

## Threats and the layer that answers each

| Threat                                    | Answer                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Volumetric floods, connection exhaustion  | L0: the edge (CDN/WAF), configured in [10](10-deployment-and-operations.md)                                |
| Floods of cheap requests from one network | L1: per-network limiter in memory, before any database work                                                |
| Password guessing against one account     | L2: per-account failure throttle                                                                           |
| Credential stuffing across accounts       | L2: per-network auth policy, hashing guard (plan 00)                                                       |
| Bulk registration                         | L2: per-network registration policy; proof of work; e-mail verification ([04](04-accounts-and-trust.md))   |
| Spam and signal flooding from accounts    | L2: per-account policies by kind of write, tighter for new accounts                                        |
| Scraping and expensive reads              | L1 ceiling; L2 policies for search and heavy reads                                                         |
| Many accounts acting in concert (sybils)  | Not a rate-limit problem: registration friction, trust tiers, and detection in [07](07-moderation-core.md) |

The application must be safe without L0, but production must have it: an application-level limiter cannot
absorb a flood that saturates the network or the TLS layer.

## Design

### Algorithm: GCRA

The generic cell rate algorithm stores one timestamp per key (the "theoretical arrival time", `tat`), allows
bursts up to a configured size, then admits requests at a steady rate. It replaces fixed windows, which admit
twice the limit across a window edge and need a counter and an expiry per key.

A rule is `{ limit, periodSeconds, burst? }` (`burst` defaults to `limit`). Let `T = periodSeconds / limit`
(seconds per unit) and `τ = T × burst`. For a request of cost `c` at time `now`:

```text
tat      = max(stored tat or now, now)
new_tat  = tat + c × T
if new_tat − τ > now:   deny;  retryAfter = new_tat − τ − now
else:                   store new_tat (expiring at new_tat)
                        remaining = floor((now + τ − new_tat) / T)
                        reset     = new_tat − now          # seconds until the budget is full again
```

Worked example, 10 per minute: `T` = 6 s, `τ` = 60 s. Ten immediate requests are admitted (`remaining` 9 … 0);
the eleventh is denied with `retryAfter` = 6 s; after that, one request every 6 s.

The arithmetic is a pure function in `packages/domain/src/rules/rate-limits.ts` and is unit-tested there. Stores
only persist `tat` atomically.

### Stores

```ts
export interface RateLimitRule {
  limit: number;
  periodSeconds: number;
  burst?: number;
}
export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}
export interface RateLimitStore {
  consume(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitDecision>;
  peek(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
  reset(key: string): Promise<void>;
  close(): Promise<void>;
}
```

| Store      | `RATE_LIMIT_STORE` | Use                                                             | Notes                                                                                     |
| ---------- | ------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Memory     | `memory` (default) | Development, tests, one instance; always used for L1            | `Map<key, tat>`; sweep expired keys every 30 s; cap at 200,000 keys, evicting the stalest |
| PostgreSQL | `postgres`         | Two or more instances, no new infrastructure                    | One statement per check on an `UNLOGGED` table                                            |
| Redis      | `redis`            | When limiter traffic is worth moving off the database (phase D) | One Lua script per check; works with Valkey                                               |

**PostgreSQL store.** Table `rate_limits(key text primary key, tat timestamptz not null)`: declare it in the
schema, then make it `UNLOGGED` in a custom migration (`alter table rate_limits set unlogged`): no WAL, and
losing its contents in a crash merely resets budgets. One statement decides and records:

```sql
insert into rate_limits as r (key, tat)
values ($1, clock_timestamp() + make_interval(secs => $2))                -- $2 = c × T
on conflict (key) do update
   set tat = greatest(r.tat, clock_timestamp()) + make_interval(secs => $2)
 where greatest(r.tat, clock_timestamp()) + make_interval(secs => $2)
       - make_interval(secs => $3) <= clock_timestamp()                   -- $3 = τ
returning extract(epoch from tat - clock_timestamp()) as reset_seconds;
```

A returned row means "allowed". No row means "denied"; a second, read-only statement fetches `tat` to compute
`retryAfter`. Rules: run it on the pool, never inside the request's business transaction (a rollback must not
refund the budget, and the row lock must be released at once); reject `cost > burst` when policies load; purge
`where tat < now() - interval '1 minute'` every minute through a schedule from plan 02.

Cost of this store: one round trip (well under a millisecond on a local network) for each request that has an
L2 policy. Those are writes, authentication and search, a small share of traffic. Cheap reads only pass L1.

**Redis store** (phase D, built when needed): a Lua script doing the same arithmetic with `TIME`, `GET` and
`SET … PX`. Trigger for building it: limiter statements exceed ~300 per second sustained, or show up in the
database's top statements, or the deployment becomes multi-region.

**Keys.** `rl:{policy}:{rule}:{scope}:{subject}`. The subject is an account id, or an HMAC-SHA-256 of the
network key or normalised e-mail under `RATE_LIMIT_KEY_SECRET` (required in production). Shared stores
therefore never hold raw addresses or e-mails.

### Trust tiers

A pure function in the domain package decides a caller's tier; `Actor` gains `trust`.

| Tier          | Who                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `anonymous`   | No session                                                                                       |
| `restricted`  | Under a moderation restriction ([07](07-moderation-core.md))                                     |
| `new`         | Account younger than 72 hours, or e-mail not verified (when `TRUST_REQUIRE_VERIFIED_EMAIL=true`) |
| `member`      | Everyone else                                                                                    |
| `established` | Member for 30 days with at least 10 contributions and no upheld moderation decision in 90 days   |
| `staff`       | Moderators and admins                                                                            |

Tiers gate **rate limits and pre-moderation only**. They never weight a vote, an evaluation or a metric: the
concept reserves influence for demonstrated contribution quality, which is the scoring work, and account age is
not quality. Keep `TRUST_REQUIRE_VERIFIED_EMAIL=false` until [04](04-accounts-and-trust.md) ships verification.

`trustTier()` takes its inputs as plain values (role, account creation time, `emailVerifiedAt`,
`restrictedUntil`, `establishedAt`), so it is complete in this plan even though two inputs arrive later:
[04](04-accounts-and-trust.md) adds `accounts.established_at` and the daily job that sets it, and
[07](07-moderation-core.md) adds `accounts.restricted_until`. Until then `resolveSession()` passes `null` for
both: nobody is `established` or `restricted`.

### Policies

Defaults live in `packages/domain/src/rules/rate-limits.ts` as data. A policy has a scope (`network`,
`account` or `email`) and, per tier, one or more rules that must all pass. Values are requests per period;
`—` means the tier cannot reach the endpoint.

| Policy                | Applies to                                                      | Scope              | anonymous     | new             | member            | established        |
| --------------------- | --------------------------------------------------------------- | ------------------ | ------------- | --------------- | ----------------- | ------------------ |
| `net.requests`        | Every `/v1` request (L1, memory)                                | network            | 600/min       | 600/min         | 600/min           | 600/min            |
| `auth.login`          | `POST /auth/login`                                              | network            | 10/min, 60/h  | same            | same              | same               |
| `auth.login.failures` | Failed logins for one account                                   | email              | 10 per 15 min | same            | same              | same               |
| `auth.register`       | `POST /auth/register`                                           | network            | 3/h, 10/day   | —               | —                 | —                  |
| `auth.recovery`       | Verification and reset e-mails ([04](04-accounts-and-trust.md)) | email and network  | 3/h and 10/h  | same            | same              | same               |
| `write.any`           | Every mutating request                                          | account            | —             | 30/min          | 120/min           | 240/min            |
| `write.signal`        | Stances, evaluations, involvements                              | account            | —             | 20/min, 200/day | 60/min, 2,000/day | 120/min, 5,000/day |
| `write.discussion`    | Comments, arguments                                             | account            | —             | 5/min, 30/day   | 20/min, 300/day   | 40/min, 1,000/day  |
| `write.knowledge`     | Claims, evidence, sources, relations, initiatives, outcomes     | account            | —             | 5/min, 30/day   | 20/min, 200/day   | 40/min, 600/day    |
| `write.idea`          | Propose an idea, submit a revision                              | account            | —             | 2/h, 3/day      | 10/h, 30/day      | 30/h, 100/day      |
| `moderation.report`   | `POST /reports` ([07](07-moderation-core.md))                   | account            | —             | 5/h, 10/day     | 20/h, 50/day      | 40/h, 100/day      |
| `read.search`         | `GET /search`, `GET /ideas?q=`                                  | account or network | 20/min        | 30/min          | 60/min            | 120/min            |
| `read.heavy`          | Graph traversal, activity feeds, evaluation history             | account or network | 30/min        | 60/min          | 120/min           | 240/min            |

`restricted` uses the `new` column halved; `staff` uses `established` × 4 for `write.*` and `read.*` and is
never exempt from `auth.*`. Graph traversal costs 1 unit at depth ≤ 2 and 3 units beyond. Daily rules use
`burst = limit`: the whole daily budget may be spent at once and then refills continuously.

These numbers are starting points chosen to be invisible to a person and painful to a script. They must be
tuned from the `rate_limit_decisions_total` metric after launch: a 429 rate above 1 % for members on a
`write.*` policy means the limit is too tight.

Overrides without a deployment: `RATE_LIMIT_SCALE` (a multiplier for all `write.*` and `read.*` limits,
default `1`) and `RATE_LIMIT_OVERRIDES` (a JSON object keyed by policy). The legacy variables
`RATE_LIMIT_AUTH_PER_MINUTE`, `RATE_LIMIT_WRITES_PER_MINUTE` and plan 00's `RATE_LIMIT_REQUESTS_PER_MINUTE` are
removed; `RATE_LIMITS=off` disables everything for tests and local load experiments.

### The contract declares the policy

`EndpointSpec` gains `limits: readonly RateLimitPolicyName[]`. From that single declaration:

- the L2 middleware looks up the matched endpoint and enforces its policies;
- the generated API reference and the OpenAPI document list each endpoint's limits;
- a test fails if a mutating endpoint breaks the rules below, or names a policy that does not exist.

Rules for declarations:

- **Reads** default to no L2 policy (L1 still applies); search and heavy reads declare `read.search` or
  `read.heavy`.
- **Member writes** (every mutating endpoint that requires a session) declare `write.any` plus one specific
  policy (`write.signal`, `write.discussion`, `write.knowledge`, `write.idea`, `moderation.report`).
- **Public credential endpoints** declare their `auth.*` policy instead: `POST /auth/register` →
  `auth.register`, `POST /auth/login` → `auth.login`, and the recovery endpoints of
  [04](04-accounts-and-trust.md) → `auth.recovery`. Anonymous callers cannot reach `write.*` at all, so these
  must not declare it. `POST /auth/logout` is the one listed exemption: it only ends the caller's own session.
- **"Mutating" is declared, not guessed from the method.** `EndpointSpec` gains `mutates: boolean`, defaulting
  to `true` for `POST`, `PUT`, `PATCH` and `DELETE`. A `POST` that changes nothing (the similarity queries of
  [11](11-semantic-search.md)) sets `mutates: false` and is treated as a read.

At step 10, 38 of the 68 endpoints mutate; three are public (`register`, `login`, `logout`).

### Enforcement order

```text
security headers → request id, logging → web app files → CORS → body limit
→ L1  net.requests            (memory; network key; before any database work)
→ session resolution          (token-shape check from plan 00)
→ L2  endpoint policies       (shared store; account key, or network key when anonymous)
→ routes
```

Two policies are enforced inside the identity service because they need the request body:

- `auth.login.failures`: `peek` before verifying; on failure `consume`; on success `reset`. Throttling, not
  lockout: an attacker can slow a victim's logins but cannot disable the account, existing sessions keep
  working, and password reset is governed by `auth.recovery`, not by this policy.
- `auth.recovery` (plan 04) by e-mail.

### What clients see

- **429** with the existing envelope, extended additively:

  ```json
  {
    "error": {
      "code": "rate_limited",
      "message": "…",
      "details": {
        "policy": "write.discussion",
        "scope": "account",
        "limit": 20,
        "periodSeconds": 60,
        "retryAfterSeconds": 3
      }
    }
  }
  ```

- `Retry-After` (seconds) on every 429.
- On every response governed by an L2 policy, the IETF fields of
  `draft-ietf-httpapi-ratelimit-headers-11` (May 2026; still a draft, so the formatter is one small function):

  ```http
  RateLimit-Policy: "write.discussion";q=20;w=60, "write.discussion";q=300;w=86400
  RateLimit: "write.discussion";r=17;t=42
  ```

  `RateLimit` reports the rule closest to exhaustion. Add both names to the CORS `exposeHeaders`.

- The web app's 429 message uses `retryAfterSeconds`; forms disable their submit button until then.

### Proof of work on registration (phase C)

A self-hosted proof of work is the only bot friction that is reachable everywhere (third-party CAPTCHAs are
blocked or unreliable in several large regions), needs no account with a vendor, and keeps the page free of
third-party scripts, which the CSP forbids anyway.

- `GET /v1/auth/challenge` → `{ algorithm, challenge, salt, maxNumber, signature, expiresAt }`: stateless,
  HMAC-signed with `CHALLENGE_SECRET`, valid for 5 minutes. The ALTCHA scheme: find `n ≤ maxNumber` such that
  `SHA-256(salt + n)` equals `challenge`. `altcha-lib` implements creation and verification; a 60-line
  implementation of our own is equally acceptable.
- `RegisterRequest` gains `challenge` (the solved payload). `REGISTRATION_CHALLENGE=pow` (the production
  default) makes it mandatory; `none` (development, tests) ignores it.
- The server verifies signature, expiry and solution, then marks the salt as used in the shared store until it
  expires (no replay).
- Difficulty adapts: `maxNumber` starts near 50,000 (a fraction of a second on a phone) and doubles for a
  network each time it consumes a unit of `auth.register`, up to a ceiling of about 10 s of work.
- The web app solves the challenge in a Web Worker while the person fills in the form, so nobody waits. Load
  it as a same-origin module worker, which Vite emits as its own file:
  `new Worker(new URL("./pow.worker.ts", import.meta.url), { type: "module" })`. The CSP built in
  `apps/api/src/http/web.ts` has no `worker-src`, so workers fall back to `script-src 'self'`, and a `blob:`
  worker would be refused.
- A `ChallengeProvider` interface keeps the door open for other providers (for example Turnstile) without
  changing the contract.

Proof of work does not stop a determined attacker; it prices bulk registration. The real gate is e-mail
verification plus `new`-tier limits plus pre-moderation of new accounts ([08](08-ai-moderation.md)).

## Phases

| Phase | Scope                                                                                                                        | Days |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ---- |
| A     | GCRA in the domain package; `RateLimitStore` with memory and PostgreSQL stores; trust tiers on `Actor`; policy catalogue     | 3–4  |
| B     | `limits` on every endpoint; L1/L2 middleware; login failure throttle; headers and envelope; docs generator; web 429 handling | 3–4  |
| C     | Challenge endpoint, verification, adaptive difficulty, web solver                                                            | 2–3  |
| D     | Redis store (when its trigger is reached)                                                                                    | 1–2  |

## Verification

- Domain unit tests: GCRA (burst, steady state, cost, retry and reset times, clock going backwards), trust
  tiers, policy resolution with overrides.
- One store contract suite run against memory and PostgreSQL (PGlite and, under `npm run test:pg`, a real
  server): 50 concurrent `consume` calls against a limit of 10 admit exactly 10.
- Integration: each policy answers 429 with the documented envelope and headers; reads pass L1 only; the
  failure throttle resets on success; a replayed challenge is refused; with `RATE_LIMITS=off` nothing limits.
- Contract: every endpoint's declaration follows the rules in "The contract declares the policy" (member
  writes, public credential endpoints, the logout exemption, `mutates: false`); the generated reference lists
  the limits.
- `npm run check`, `npm run test:pg`, `npm run test:e2e` (registration flow).

## Documentation to update

`docs/agents/architecture.md` (replace ADR-17), `docs/agents/open-questions.md` (close question 20),
`docs/developer/operations.md` (configuration, tuning guide, the security checklist), `docs/developer/developer-guide.md`
(429 handling, "declare limits when adding an endpoint"), `docs/user/user-guide.md` (limits in plain words).

## Risks

- **Limits that hurt real people.** Launch generous, watch the metric, tighten. Never tune by guesswork twice.
- **Shared networks** (universities, mobile carriers, whole countries behind carrier-grade NAT) share a network
  key. L1 is deliberately high and all account-scoped policies ignore the network.
- **The limiter becoming a dependency.** If the shared store fails, fail open for `read.*` and `write.*` (log
  and count it) and fail closed for `auth.*`.
- **A draft header format.** If the IETF draft changes before publication, only the formatter changes.

## Implementation notes

### Step 10 · Phase A · 2026-11-25

Steps 1–9 were Done at clean `main` commit `c1dd2b0`. The checkout contained the pre-session network
ceiling, bounded hashing, configuration schema, job scheduler and English catalogues. The baseline
`npm run check` passed with 214 tests and coverage of all 68 endpoints.

- `packages/domain/src/rules/rate-limits.ts` implements the policy table above, trust classification, GCRA
  and graph cost. Memory and PostgreSQL use integer microseconds, rounding a non-integral unit interval up.
  Peek reports the current balance and whether one more unit fits. Denials preserve the balance.
- `apps/api/src/modules/rate-limits/` owns key construction and the two stores. The memory cap evicts the
  least recently charged key in constant time. PostgreSQL uses its own clock, an atomic upsert on the pool
  and a read after denial. Migrations 0004–0005 create the operational table and make it unlogged.
  `modules/jobs` schedules its purge. Network keys and normalised email subjects use HMAC-SHA-256.
- `modules/identity/service.ts` computes trust from the account creation and verification dates on session
  lookup, falling back to the person's creation date for a legacy session without an account row. A current
  restriction takes precedence over staff. The established and restricted markers are supplied as null
  until plans 04 and 07. The email verification requirement defaults to false.
- A policy override supplies replacement rules per base tier in catalogue order, preserving scopes and rule
  count. Tier factors and the read/write scale apply to limit and explicit burst, rounding down to at least
  one unit. A heavy-read burst must accommodate the three-unit graph cost. Public registration accepts a
  request carrying a session, so its resolver always selects the anonymous network budget.

**PostgreSQL store benchmark.** PostgreSQL 17.12 in local Docker, one sequential client, one warm key per
outcome, 100 warm-up and 2,000 measured consumes per outcome. Latency covers the entire store call.
With `TEST_DATABASE_URL` set to a local test server, run `npx tsx apps/api/scripts/bench-rate-limits.ts`.
The script creates and drops its own database.

| Outcome | SQL statements per decision | Statements/s | Mean ms | p50 ms | p95 ms |
| ------- | --------------------------: | -----------: | ------: | -----: | -----: |
| Allowed |                           1 |          904 |   1.106 |  1.061 |  1.286 |
| Denied  |                           2 |          964 |   2.074 |  2.043 |  2.338 |

The policy defaults stand pending real traffic. This synthetic benchmark measures the local store and
does not establish the post-launch Redis trigger. No owner decision is pending for phase A.

| Verification                                 | Result                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                              | Passed typecheck, lint, format, docs, 229 tests on PGlite and the production build. Three PostgreSQL-only cases ran on the real server.                                                                            |
| `npm run test:pg`                            | All 232 tests passed on PostgreSQL 17.12. Both full runs exercised all 68 endpoints.                                                                                                                               |
| Shared store conformance                     | The same burst, weighted cost, peek, refill, reset and concurrency cases passed for memory and the SQL store on both drivers. Each admitted exactly 10 of 50 simultaneous consumes for one key with a burst of 10. |
| Storage lifecycle                            | Verified unlogged persistence, scheduled purge on redelivery, retention of live and recently expired rows, memory sweep and eviction.                                                                              |
| `npm run db:generate` and `npm run docs:api` | Drizzle found no schema drift after migrations 0004–0005. The generated contract reference matched the checkout.                                                                                                   |
| `npm run test:e2e`                           | All 62 browser checks passed, including registration and contribution.                                                                                                                                             |

**Next eligible row:** step 11 (plan 03, phase B), `prompts/api/03-rate-limiting-prompt.md`.
Wire the policies through the endpoint catalogue, request middleware, failure throttle and web retry handling.
