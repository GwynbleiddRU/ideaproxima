# 14 — Launch readiness

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/14-launch-readiness-prompt.md`.

| Status     | Not started                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| Depends on | Every step before it in the [sequence](README.md#sequence-and-status) (steps 1–40) |
| Unblocks   | The owner's launch decision                                                        |
| Size       | 1 session (step 41) · 1–2 engineer-days                                            |

## Outcome

A written, evidence-backed answer to one question: **can the platform be opened to the public now?** The
answer is `Ready`, `Ready with accepted risks` (each residual risk has dated owner acceptance), or
`Not ready` (each blocker named, with the plan and phase that must fix it). The decision to launch stays the
owner's.

This session verifies; it does not build. A gap that takes less than about half a day to close and lies
inside an existing plan's scope may be fixed here, recorded under that plan's `## Implementation notes`;
anything larger becomes a blocker.

## Deliverable

`docs/agents/production/launch-readiness.md`: one section per area below, each item with its status
(`pass`, `fail`, `accepted risk`, `scheduled after launch`, `waiting`), the evidence (a test name, a command and its
output, a document) and, for a failure, the owning plan and phase. The verdict at the top.

## The checklist

### 1. Every finding has a disposition

Use exactly one row per ID in the [audit](api-audit.md). For a launch requirement name its closing step and proving test or measurement on the release candidate. Record API-2 (42), SEC-13 (43) and the partitioning part of PERF-10 (T2) as scheduled after launch, with the interim behaviour and owner. For PERF-10 verify the size monitoring and trigger now. A scheduled item is open and cannot count as a pass. A missing pre-launch proof blocks the verdict.
Repeat the four measured probes of the audit by hand and record the new numbers: login timing for known and
unknown e-mails; the hidden-claim ledger leak; slugs for Russian, Chinese and Arabic titles; search for
`двигатель` and inside a Chinese title.

### 2. The sequence is complete

Steps 1–40 are `Done`. Every plan's `## Implementation notes` has been read, and every deferred item in them
is either done or listed here.

### 3. Security

- Review Level 1 of OWASP ASVS 5.0.0. Record each versioned requirement ID, applicability, evidence and unresolved gaps for this candidate. [OWASP ASVS](https://asvs.owasp.org/)
- `npm audit` with no high or critical advisories; the image scan, the SBOM and secret scanning green in CI.
- On the production compose stack, booted from the published image: response headers (CSP, HSTS at the edge,
  `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`), cookie flags (`Secure`, `HttpOnly`,
  `SameSite`), CORS, `/metrics` and the inference ports unreachable from outside.
- Every endpoint declares its limits (the contract test) and every `/v1` request passes L1.
- Hostile-input tests exist for every place where user text reaches HTML outside React (plan 13's metadata,
  e-mail templates).
- Federated sign-in: `state`, PKCE, OIDC `nonce` where applicable, and a redirect target limited to same-origin paths.
- Staff actions require a recent second factor in the production configuration.
- A sample of logs from the game day contains no e-mail address, token, raw network address or search term
  (search the log with patterns).

### 4. Privacy

Exercise retention jobs for sessions, security events, jobs, tokens, rate-limit keys and personal exports.
Step 42 verifies retention for idempotency keys. Verify export and deletion end to end and erasure replay
in the restore drill. Reconcile the published privacy notice with the operations guide's data map.

### 5. Operations

Release and rollback performed by the workflow; three consecutive weekly restore drills passed (or the date
they will have); every alert made to fire once and reach a person; runbooks exist and each was rehearsed;
the game-day report's failures closed or accepted; dashboards live.

### 6. Moderation

The content policy approved by the owner and published in the product; reason codes final; time targets and
the queue's staffing known (the owner); the child-safety and legal-notice runbooks; the AI's mode at launch
per language, matching the gate results (decision 17); the circuit breaker and the fail-open path tested; a
hidden subject's URLs purged from the edge (the `cache.purge` job and the CDN adapter); every text surface in
the registry screened and hideable (the table-driven tests of plans 07 and 08).

### 7. Languages

`i18n:check` green; each language's status (`released` or `beta`) and reviewer; the browser audit, axe and the
performance budget passing in `de`, `ar` and `ja`; which policy texts are translated.

### 8. Performance and capacity

The load test at the reference size on the production layout meets its budgets (plans 09 and 10); the
capacity tables of plans 08 and 09 hold measured values; the first-visit budget holds in a non-English locale.

### 9. The public web

Entity pages return real status codes and metadata; a link preview works for an idea (a plain HTTP fetch
shows title and summary); the sitemap lists no hidden content; the end-to-end suite passes on Chromium,
Firefox and WebKit; accessibility passes in both themes; no `TODO(owner)` remains in `docs/user/terms.md`,
`privacy.md` or `contact.md`.

### 10. Contract

`/v1` is frozen (the baseline committed with the owner's go-ahead, step 40) and the compatibility test is
green; the generated reference is fresh.

### 11. Owner decisions

Each row of the program's [decisions table](README.md#decisions-for-the-owner): decided, or explicitly
accepted with its default. The licences, the legal texts, the providers and the on-call arrangement are
launch conditions; the code licence is a condition for publishing the repository, not for the launch.

### 12. Documentation

`AGENTS.md`, `CLAUDE.md`, the root `README.md`, the guides and the agent documentation describe the system as it now is
(spot-check each plan's "Documentation to update" list); `npm run docs:check` passes.

### 13. The final run

`npm run check`, `npm run test:pg` and `npm run test:e2e` pass; the CI workflow is green on `main`; the
production compose stack boots from the published image with the example environment (test values for
secrets) and passes the smoke test.

## Rules

- Record the candidate Git SHA, image digest, effective modes and evidence dates. Re-run affected checks if the candidate changes, including after a small fix. Each pass needs a reproducible reference. An unmet mandatory gate or pending acceptance yields `Not ready`. Keep step 41 open until mandatory evidence exists and any residual risks have explicit owner acceptance.
- Never launch, deploy to production, switch a production mode or commit the `/v1` baseline.
- Do not soften a failure into an accepted risk; only the owner accepts risks.
- Calendar gates that have not elapsed (restore drills, reviews) are `waiting`, with the date they can pass.

## Documentation to update

The new `launch-readiness.md`; the program README (step 41's status); each plan touched by a small fix (its
`## Implementation notes`).
