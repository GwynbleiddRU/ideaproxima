# 12 — The public API: contract freeze, keys, open data

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/12-public-api-prompt-sketch.md`.

| Status     | Not started. Phase A before launch; the rest after                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Depends on | Phase A: plans [05](05-localization.md), [06](06-multilingual-content-and-search.md), [07](07-moderation-core.md), [09](09-read-scalability.md) (they make the breaking changes); later phases: [03](03-rate-limiting.md), [02](02-background-jobs.md) |
| Unblocks   | The launch (phase A); integrations and research use (phases B–D)                                                                                                                                                                                       |
| Size       | 2–3 sessions · 8–12 engineer-days (2–3 of them before launch)                                                                                                                                                                                          |

## Outcome

`/v1` becomes a promise: after launch it only changes additively. Researchers and integrators get credentials
that are scoped, revocable and metered instead of a member's session token; a retried request cannot create a
duplicate; and the public facts of the archive are downloadable under a stated licence
([audit](api-audit.md): API-1, API-2, SEC-13; roadmap P1-7, P3-17).

## Phase A — The freeze

The API's own rule is "additive evolution within `/v1`; breaking changes mean `/v2`". Today the only client is
the bundled web app, so breaking changes cost one coordinated change. After launch they cost a second API
version maintained for years. Every shape change this program needs must therefore land first.

**The freeze checklist.** `/v1` is declared frozen when all of these are merged:

| Change                                                                 | From plan                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ActivityDto`: `subject.hidden`, `subject.label`, text-free payloads   | [00](00-immediate-hardening.md), [07](07-moderation-core.md)                        |
| Error envelope: `requestId`, `details.reason`, coded validation issues | [01](01-operational-foundations.md), [05](05-localization.md)                       |
| 429 details and rate-limit headers; `limits` in the catalogue          | [03](03-rate-limiting.md)                                                           |
| Registration: challenge, terms acceptance, locale                      | [03](03-rate-limiting.md), [04](04-accounts-and-trust.md), [05](05-localization.md) |
| `language` on content; `redacted` and `moderation` markers on DTOs     | [06](06-multilingual-content-and-search.md), [07](07-moderation-core.md)            |
| Pagination of the eleven unbounded lists; graph truncation             | [09](09-read-scalability.md)                                                        |
| Viewer state moved to `GET /v1/ideas/:idea/viewer`                     | [09](09-read-scalability.md)                                                        |
| Search: `kind`, `language`, per-kind cursors                           | [06](06-multilingual-content-and-search.md)                                         |

Work in this phase:

1. A **compatibility test**: commit the OpenAPI document at the freeze as
   `packages/contracts/baseline/v1.json`; a test compares the current document with it and fails on any
   removal, rename, type change, newly required request field, or response field that stopped being returned.
   Additions pass. From then on, "additive only" is enforced like the rest of the contract.
2. **Deprecation policy** in the developer guide: a field or endpoint is first marked deprecated in the
   catalogue (`deprecated: { since, sunset, replacement }`), which adds `Deprecation` and `Sunset` response
   headers and a note in the generated reference; removal only happens in `/v2`.
3. A **changelog** generated from catalogue differences between releases
   (`docs/developer/api-changelog.md`).
4. Record the freeze as a non-negotiable in `docs/agents/README.md` and as an ADR.

## Phase B — Idempotent creation

`Idempotency-Key` (a client-generated string of 16–128 characters) is accepted on every `POST` that records an
event: ideas, revisions, claims, evidence, arguments, comments, relations, initiatives, outcomes, reports.

```sql
create table idempotency_keys (                -- operational; purged after 24 hours
  actor_id uuid not null, key text not null,
  endpoint text not null, request_hash text not null,
  status integer, response jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, key)
);
```

- The first request stores the key with the request hash inside its transaction, then the response.
- A repeat with the same key and the same request returns the stored response with `Idempotent-Replay: true`.
- The same key with a different request is 422, reason `idempotency_key_reused`.
- A repeat while the first is still running is 409, reason `request_in_progress`.

The web app sends a key per form submission, which removes double-submit duplicates on poor connections.
State-style writes (stances, involvements, evaluations) are already idempotent and ignore the header.

## Phase C — API keys

```sql
create table api_keys (
  id uuid primary key, person_id uuid not null references people(id),
  name text not null, prefix text not null unique,        -- shown in lists: 'ipx_3f9a2c'
  key_hash text not null,                                  -- SHA-256 of the full key
  scopes text[] not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz, expires_at timestamptz, revoked_at timestamptz
);
```

- Format `ipx_<prefix>_<secret>`: a recognisable prefix (secret scanners can match it), shown once at
  creation. Sent as `Authorization: Bearer ipx_…`; the session middleware tells the two kinds apart by the
  prefix and never queries sessions for a key or keys for a session token.
- Scopes: `read` (public data plus the owner's own), `write:signals`, `write:content`. A key never has
  moderation or account-management power, whatever its owner's role.
- Requests made with a key act as the owner (attribution stays honest) and are marked in the ledger payload
  (`via: "api_key"`), so automated contributions are distinguishable from manual ones.
- Limits: policies `api.read` and `api.write` per key in [03](03-rate-limiting.md)'s catalogue, plus a daily
  quota; usage counters per key per day for the owner to see.
- Endpoints: `GET /v1/me/api-keys`, `POST /v1/me/api-keys`, `DELETE /v1/me/api-keys/:key`. Creating a key
  requires a verified e-mail and, when enabled, a recent second factor.
- Public reads stay possible without a key (the archive is a public good), within the anonymous limits.

A **typed client** generated from `ENDPOINTS` (`packages/client`: fetch-based, no runtime dependency) replaces
the hand-written modules in `apps/web/src/api` and is the reference client for integrators (roadmap P1-7).

## Phase D — Open data

- A weekly job exports the **public facts**, and only those: no accounts, e-mail addresses, sessions, security
  events, reports, internal notes, or anything hidden, held or redacted. Derived data is excluded, because it
  can be recomputed and must not be mistaken for ground truth.
- Format: one compressed JSON Lines file per table plus a manifest with schema version, row counts, checksums
  and the licence; stored in object storage; listed by `GET /v1/exports`.
- People appear by id, handle and display name as on their public profile; deleted accounts appear as the
  anonymised person.
- The licence for contributions (open question 12) must be decided before the first export is published.
- The yearly archival snapshot (roadmap P3-18) is one of these exports deposited with a long-term archive.

Webhooks and OAuth for third-party applications are deliberately out of scope until someone needs them.

## Phases

| Phase | Scope                                                                                        | Days |
| ----- | -------------------------------------------------------------------------------------------- | ---- |
| A     | Freeze checklist verified, baseline and compatibility test, deprecation mechanism, changelog | 2–3  |
| B     | Idempotency keys, web app sends them                                                         | 1–2  |
| C     | API keys, scopes, limits, usage; generated typed client                                      | 3–4  |
| D     | Open-data export job and index                                                               | 2–3  |

## Verification

- The compatibility test fails on a deliberately breaking fixture and passes on an additive one.
- Idempotency: sequential replay, concurrent duplicates (`npm run test:pg`), key reuse with another body.
- Keys: scope enforcement per endpoint (a table-driven test over the catalogue), revocation takes effect
  immediately, a key never reaches a moderation endpoint.
- An export contains no private column and no hidden subject (a test that seeds both and inspects the files).
- `npm run check`, `npm run test:pg`.

## Decisions for the owner

1. The date of the freeze (it is the launch gate).
2. The contribution licence, before any export.
3. Whether API keys are self-service (default) or granted on request at first.
