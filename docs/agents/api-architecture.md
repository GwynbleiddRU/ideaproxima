# API architecture — design rules for agents

The authoritative, always-current list of endpoints, parameters and fields is **generated**:
[`../developer/api-reference.md`](../developer/api-reference.md) (human) and [`../developer/api/openapi.json`](../developer/api/openapi.json)
(machine), from `packages/contracts`. Conventions for clients (auth, errors, pagination, idempotency) are in the
[developer guide](../developer/developer-guide.md#api-conventions). This document records the _design rules_ to follow
when changing the API, and why.

## Design rules

1. **Domain operations, not CRUD.** Reads are resource-oriented. Writes are named operations: propose a revision,
   decide on it, transition a stage, withdraw evidence, retract a relation. There is deliberately no generic
   `PATCH /ideas/:id`: content changes are revisions (history), stage changes are transitions (proof), and opinion
   changes supersede (history). A new write endpoint should name the domain act it records.
2. **Facts in, DTOs out.** A write records a fact (plus projections and a ledger entry) and returns the resulting
   DTO. It never returns internal rows.
3. **Derived values are labelled.** Anything computed lives under `signals` / `derived` with an `algorithm`. Absent
   data is `null`/absent, never `0`.
4. **Errors are codes.** Services throw `DomainError(code, …)`. The HTTP layer maps codes in one place. Use
   `invariant_violated` (422) for well-formed requests that break a domain rule, and `conflict` (409) for
   duplicates and concurrent modification. Put what the client needs to recover in `details` (e.g.
   `currentRevisionId`, `requirement`).
5. **Idempotency where the user's intent is a state.** "I hold this stance", "I am involved as a funder", "my
   rating is 4" are states: PUT/DELETE or no-op resubmission, safe under double submission (advisory locks).
   "Record this evidence" is an event, and duplicates are conflicts.
6. **Optimistic concurrency for narrative.** Revisions carry `baseRevisionId`. Never silently merge or overwrite.
7. **Public by default, private by exception.** The archive is a public good: contributions, evaluations and
   stances are public and attributable. Credentials, emails and password events are private and stay out of the
   ledger.
8. **Hidden ≠ deleted.** Hidden content is 404 for non-moderators. Threads keep placeholders. The moderation log
   is public.
9. **Additive evolution.** New fields and endpoints are additive within `/v1`, and clients ignore unknown fields.
   Breaking changes mean `/v2` mounted beside `/v1`, reusing the same services.
10. **The contract leads.** Change `packages/contracts` first (schema + `ENDPOINTS`), then the service and route,
    then tests, then `npm run docs:api`. The suite enforces all four stay consistent (see ADR-14).

## How the contract is enforced

| Mechanism               | Where                                                | Fails when                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request validation      | `apps/api/src/http/input.ts` (`jsonBody`, `queryOf`) | A request does not match its zod schema (400).                                                                                                                |
| Response contract check | `apps/api/test/harness.ts` (`assertContract`)        | A successful response does not deep-equal its schema-parsed form, has an undocumented status, or the route is not catalogued; or an error lacks the envelope. |
| Catalogue ↔ routes      | `apps/api/test/contract.test.ts`                     | A route exists without a catalogue entry, or vice versa.                                                                                                      |
| Docs freshness          | `apps/api/test/contract.test.ts`                     | `docs/developer/api-reference.md` or `docs/developer/api/openapi.json` differ from what `npm run docs:api` would generate.                                    |
| Endpoint coverage       | `scripts/run-tests.ts`                               | A full test run never exercised some catalogued endpoint.                                                                                                     |

## Known gaps

Email verification and password reset; OAuth/ORCID; follows, bookmarks and notifications; bulk data export (open
data dumps); webhooks. See [roadmap.md](roadmap.md).
