# Production-readiness program

How the Ideaproxima API grows from a sound foundation into a worldwide, production-ready platform: rate
limiting, twelve languages, AI-assisted moderation, and everything those depend on.

Written 2026-11-17 from a full [audit of the API](api-audit.md). It contains thirteen implementation plans.
Each plan has a matching prompt sketch in `prompts/api/` (same number and name, ending in
`-prompt-sketch.md`) that briefs the agent who will implement it.

## How to use this

- **The owner** reads this page, then [Decisions for the owner](#decisions-for-the-owner), and starts plans by
  handing an agent the matching prompt.
- **An agent** given a prompt follows [How a session works](#how-a-session-works) below.
- A plan is a design with reasons, not a script. When the code contradicts a plan, the agent says so and
  proposes the correction; it does not silently follow either.

## How a session works

Each task is one fresh session: **one phase of one plan**. The agent starts with no memory of earlier
sessions, so everything a later session needs must be left in the repository, never only in a conversation.

**Starting.** The owner opens a new session and names the prompt and, optionally, the phase: "Follow
`prompts/api/03-rate-limiting-prompt-sketch.md`, phase B". Without a phase, take the first one the plan's
status does not mark as done.

**Before writing code**

1. Read, in order: [`concept.txt`](../../../concept.txt); the [agent documentation](../README.md) (the
   non-negotiables and the definition of done); this page's [rules](#rules-for-every-plan); the plan; the
   audit findings it cites; the code the prompt lists.
2. Check the [status board](#status-board): every plan and phase this one depends on must be done. If one is
   not, stop and say so rather than building around it.
3. Re-verify the facts you depend on. Prompts state what was true on the date they give; the code has moved
   since. Where a fact no longer holds, say so and adapt.
4. Run `npm run check` and note the baseline. A failure that was already there is reported, not silently
   fixed and not blamed on your change.

**While working**

- Stay inside the phase. Work that belongs to another plan is reported, not done.
- Contract first; tests with every change; new switches default to today's behaviour.
- An interface change is first a mock-up in `designs/` for the owner. Until it is approved, do only the
  non-visual part of the phase.
- A decision that belongs to the owner is not made by the agent: build with the plan's default and list it.
  Never switch a production mode (for example moderation to `enforce`) or commit the `/v1` baseline unasked.

**Finishing**

1. Meet the definition of done in the prompt, running the commands it names, and say plainly which passed.
2. Leave the hand-over in the repository:
   - the plan's status line and the [status board](#status-board) ("Phase B done, 2026-12-03");
   - decisions in the document that owns them (an ADR, the data model, the guides the prompt lists);
   - measurements in the plan's own tables, replacing estimates;
   - anything that differs from the plan under a heading `## Implementation notes` at the end of the plan:
     what changed, why, and what the next phase must know.
3. Give the "Report back" items from the prompt as the final message.
4. Do not commit unless the owner asks. When asked: on `main`, in logical commits, without pushing, and with
   `prompts/` left untracked.

**Running sessions in parallel.** The two tracks in [Order](#order) can each have a session at the same time;
one plan never has two. Both tracks edit `packages/contracts` and the web shell, so their changes are merged
one phase at a time, and `npm run docs:api` and `npm run check` are rerun after each merge.

## Where the API stands

The foundation is unusually strong for its size: append-only facts enforced by database triggers, an executable
contract (66 endpoints, every response checked against its schema, every endpoint exercised), one permission
policy, correct concurrency proven on real PostgreSQL, and a stateless process. None of that needs rework.

What is missing is everything around it. The [audit](api-audit.md) found 53 issues, 19 of which block a public
launch:

| Area             | State today                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Abuse protection | Two in-memory fixed-window limits; reads unlimited; the client address can be forged; no bot friction                               |
| Accounts         | E-mail and password only: no verification, no recovery, no second factor                                                            |
| Moderation       | One endpoint that hides six kinds of content; no reports, queue, appeals or automation; hidden text leaks through the activity feed |
| Languages        | English only: interface, vocabulary, errors, search stemming, URL slugs                                                             |
| Scale            | Metrics recomputed inside every vote; unbounded lists; offset pagination; nothing cacheable                                         |
| Operations       | A text log and one health check; no metrics, background work, release pipeline or rehearsed restore                                 |

## Target state

```text
 readers ─▶ CDN / WAF ─▶ load balancer ─▶ api × N ──┐          stateless, one image
                                          worker × M ┤          jobs: mail, metrics, moderation, search
                                                     ├─▶ PostgreSQL (primary, replica when needed)
                              inference × K ◀────────┘          llama-server: moderation models, later embeddings
```

Principles the plans share:

1. **PostgreSQL stays the only required stateful service.** Jobs, rate limits, the search index and
   moderation records live there. Redis, a search engine or a queue broker are added only when a measured
   trigger is reached.
2. **The contract declares, the middleware enforces.** Rate-limit policies and cache rules join request and
   response schemas in the endpoint catalogue, so they are documented and tested by construction.
3. **Work that follows a write is enqueued in the same transaction** and runs in a worker.
4. **Everything derived is rebuildable**, labelled with what produced it, and written by exactly one module:
   metrics, the search index, embeddings, machine translations.
5. **People decide; machines assist.** Automated moderation flags, and hides only a short severe list pending
   human confirmation. It never judges whether an idea is true, feasible or good.
6. **Self-hosted on the request path.** No third-party script, font, CAPTCHA or model API; this is also what
   keeps the product reachable everywhere.
7. **Roll out by mode.** Every risky capability has an `off → shadow → on` switch and a measured gate between
   the steps.

## The plans

| #   | Plan                                                                     | Result                                                                                    | Depends on   | Engineer-days |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------ | ------------- |
| 00  | [Immediate hardening](00-immediate-hardening.md)                         | Seven defects closed that need no design decision                                         | —            | 2–3           |
| 01  | [Operational foundations](01-operational-foundations.md)                 | Validated configuration, structured logs, metrics, probes, graceful shutdown              | 00           | 3–5           |
| 02  | [Background jobs](02-background-jobs.md)                                 | A transactional job queue, a worker, schedules; metrics can refresh asynchronously        | 01           | 5–7           |
| 03  | [Rate limiting](03-rate-limiting.md)                                     | Named policies per endpoint and trust tier, shared across instances; proof of work        | 00, 01, 02   | 8–11          |
| 04  | [Accounts, e-mail and trust](04-accounts-and-trust.md)                   | Verification, recovery, sessions, ORCID sign-in, staff second factor, export and deletion | 02, 03       | 12–16         |
| 05  | [Localisation](05-localization.md)                                       | The product in twelve languages, including right-to-left                                  | 01           | 15–22         |
| 06  | [Multilingual content and search](06-multilingual-content-and-search.md) | Content languages, Unicode slugs, per-language search without extensions                  | 05 (phase A) | 11–15         |
| 07  | [Moderation core](07-moderation-core.md)                                 | Policy, reports, queue, decisions, appeals; every text can be hidden                      | 00, 02, 03   | 18–24         |
| 08  | [AI moderation](08-ai-moderation.md)                                     | Self-hosted multilingual screening with measured accuracy                                 | 02, 07       | 18–25         |
| 09  | [Read scalability](09-read-scalability.md)                               | Load tests, keyset pagination, caching, bounded lists                                     | 01, 02       | 11–15         |
| 10  | [Deployment and operations](10-deployment-and-operations.md)             | Release pipeline, alerts, proven backups, runbooks, compliance groundwork                 | 01, 02       | 13–19         |
| 11  | [Semantic search](11-semantic-search.md)                                 | Cross-language retrieval and duplicate suggestions                                        | 06, 08       | 5–8           |
| 12  | [Public API](12-public-api.md)                                           | Contract freeze, idempotency, API keys, open data                                         | 05–07, 09    | 8–12          |

### Order

Two tracks can run in parallel after plan 01. They meet at the launch.

```text
            ┌─ trust and safety ──▶ 02 ─▶ 03 ─▶ 04 ─▶ 07 ─▶ 08 ──────────────┐
 00 ─▶ 01 ──┤                                                                 ├─▶ 12 (freeze) ─▶ launch ─▶ 11, 12 (keys, data)
            └─ worldwide and scale ─▶ 05 ─▶ 06 ─▶ 09 ─▶ 10 ───────────────────┘
```

Plans 09 and 10 need the job runner of plan 02, so the second track waits for it there. Both tracks change
`packages/contracts` and the web shell: when two agents work at once, one phase is merged at a time and
`npm run docs:api` is rerun after each merge.

### Milestones

| Milestone                    | Contains                                           | Exit criterion                                                                                                                                      | Engineer-days |
| ---------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| M0 Hardened                  | 00                                                 | SEC-1 to SEC-6 and MOD-1 closed and tested                                                                                                          | 2–3           |
| M1 Operable                  | 01, 02                                             | Metrics, logs and probes live; a worker runs schedules                                                                                              | 8–12          |
| M2 Safe to open registration | 03 A–C, 04 A–B, 07 A–C, 08 A–C                     | Limits hold across instances; e-mail verified; report → decision → appeal works; every text can be hidden; AI in `flag` mode with measured accuracy | 40–53         |
| M3 Worldwide                 | 05, 06                                             | Twelve languages (released or beta); right-to-left; search and slugs work in every script                                                           | 26–37         |
| M4 Launch                    | 09 A–C, 10, 12 A, 08 D–E, 07 D, 04 C–D             | Load budgets met; restore drill passing; game day done; `/v1` frozen                                                                                | 42–60         |
| M5 After launch              | 11, 12 B–D, and the triggered phases 03 D and 09 D | —                                                                                                                                                   | 15–24         |

## Estimates

**Effort.** 118–165 engineer-days to launch (M0–M4) and 133–189 in total: about six to eight months for one
experienced engineer, or four to five calendar months on two tracks. In agent terms it is roughly 40 focused
sessions, each followed by an owner review.

The ranges are judgement, not measurement. What moves them most:

- **Interface text extraction** (plan 05): 61 components. The low end assumes few layout surprises.
- **Moderation** (plans 07 and 08): the widest ranges, because they touch every DTO that carries text and
  depend on policy decisions not yet made.
- **Owner decisions and outside people**: licences, the content policy, native reviewers, providers. None of
  them is engineering time, and any of them can stop a milestone.

**Calendar floors that effort cannot compress:** two weeks of AI moderation in shadow mode before it may flag,
and more before it may hide; three consecutive weekly restore drills; about one reviewer-day per language.
A launch earlier than eight to ten weeks from the start is not realistic however much effort is applied.

**Capacity** (planning figures; plan 09 replaces them with measurements):

| Stage  | Monthly users | Peak requests/s at origin | API instances | Database           | Moderated texts/day | Inference                 |
| ------ | ------------- | ------------------------- | ------------- | ------------------ | ------------------- | ------------------------- |
| Launch | 10,000        | ≈ 4                       | 1–2           | 2 vCPU, 4 GB       | 200–1,100           | Shares a 4 vCPU machine   |
| Growth | 100,000       | ≈ 30                      | 2–3           | 4–8 vCPU, 16–32 GB | 2,000–11,000        | One 8-core, 16 GB machine |
| Large  | 1,000,000     | ≈ 300                     | 4–6           | 16+ vCPU, 64 GB    | 20,000–110,000      | One GPU with 8 GB or more |

The first deployment fits on one 4 vCPU, 8 GB machine plus a small managed database. Assumptions and the
arithmetic are in [09](09-read-scalability.md#capacity-model) and [08](08-ai-moderation.md#sizing).

## The moderation model

Recommendation, argued in full in [08 — AI moderation](08-ai-moderation.md#the-recommended-models):

| Role                               | Model                     | File                            | Size    |
| ---------------------------------- | ------------------------- | ------------------------------- | ------- |
| Screen every text                  | Qwen3Guard-Gen-0.6B, Q8_0 | `Qwen3Guard-Gen-0.6B.Q8_0.gguf` | 0.80 GB |
| Second opinion on anything flagged | Qwen3Guard-Gen-4B, Q4_K_M | `Qwen3Guard-Gen-4B.Q4_K_M.gguf` | 2.72 GB |

Apache-2.0, 119 languages including all twelve, three labels (safe, controversial, unsafe) that map onto
"nothing, ask a moderator, act", and small enough to run on a CPU through llama.cpp. Files go in `models/` at
the repository root, which is git-ignored. If only one is downloaded, take the 4B: it is markedly better
outside English. Mistral's Shieldstral 1.0 (3B) is worth downloading too for the comparison plan 08 runs: it
accepts a policy written in plain language, which suits this platform, but it is newer, slower on a CPU and
does not officially cover Hindi or Indonesian.

## Rules for every plan

These add to the non-negotiables in the [agent documentation](../README.md); they do not replace any. How a
session starts, stays in scope and hands over is in [How a session works](#how-a-session-works).

1. **Contract first, and freeze-aware.** Change `packages/contracts` first. Until the freeze
   ([12](12-public-api.md)), a breaking change is allowed if the web app changes in the same commit; after
   it, never.
2. **A new fact table gets a history guard** in a hand-written migration. A new derived table gets one writer
   module and a rebuild command. A new operational table (jobs, tokens, limits) gets a purge schedule.
3. **A new text field is registered** as a moderation surface (plans 07 and 08) and gets a language
   (plan 06). A new user-visible string goes into a catalogue (plan 05). Once those plans have landed, these
   are part of adding any feature.
4. **A new endpoint declares** its access, limits and cache rule in the catalogue.
5. **Every switch defaults to today's behaviour** in development and tests. New capabilities are enabled per
   environment, by configuration.
6. **Interface changes are previewed.** Larger changes to the web app are mocked up in `designs/` (a local,
   uncommitted folder) and approved by the owner before they are implemented.
7. **Dependencies are a decision.** State why each new package is needed and check its engine requirement
   against the pinned toolchain; prefer what Node, Hono and PostgreSQL already provide.
8. **Privacy by default.** No raw network addresses or e-mail addresses in logs, metrics or shared stores;
   security events are private; anything about a person that is not a public contribution has a retention
   period.
9. **Definition of done** is unchanged: `npm run check`; `npm run test:pg` when SQL, locking or transactions
   changed; `npm run test:e2e` when the interface changed; `npm run docs:api` when the contract changed; the
   documents that record a decision updated in the same change.
10. **Measure before optimising, evaluate before enforcing.** Performance work starts from a recorded
    baseline; automated moderation acts only after passing its gate.

## Decisions for the owner

Nothing here blocks starting. Each decision blocks the plan named, at the phase named. Defaults are what the
plans assume if nothing is decided.

| #   | Decision                                                               | Default assumed                                                  | Needed by          |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------ |
| 1   | Download the moderation models                                         | The two Qwen3Guard files above                                   | 08, phase A        |
| 2   | The twelve languages, and which must be `released` at launch           | en, zh-Hans, es, ar, pt-BR, id, fr, ja, ru, de, hi, ko           | 05, phase A        |
| 3   | Native reviewers for each language                                     | None yet: languages ship as `beta` until reviewed                | 05, phase D        |
| 4   | The content policy and its reason codes                                | The draft in plan 07                                             | 07, phase B        |
| 5   | Which reasons may hide content automatically                           | Sexual content, privacy, violent threats, spam from new accounts | 08, phase D        |
| 6   | Hold new accounts' content for the seconds an assessment takes         | Yes, in `enforce` mode                                           | 08, phase D        |
| 7   | Registration: immediate sign-in, or only after verifying the e-mail    | Immediate                                                        | 04, phase A        |
| 8   | Terms, privacy notice, and the licence for contributions (question 12) | Undecided: the mechanism is built, the texts are missing         | 04 B; 12 D; launch |
| 9   | Code licence (question 25)                                             | Undecided                                                        | Publication        |
| 10  | Whether moderators are named in the public moderation log              | Named, as today                                                  | 07, phase B        |
| 11  | Lenses default to the reader's languages or to all languages           | The reader's languages, with one click to all                    | 06, phase C        |
| 12  | Hosting, CDN and mail providers; recovery objectives; who is on call   | One machine with compose, managed PostgreSQL; 5 min / 4 h        | 10, phase A        |
| 13  | Sign-in providers beyond ORCID                                         | ORCID first; Google and GitHub optional                          | 04, phase C        |
| 14  | The date of the `/v1` freeze                                           | Immediately before launch                                        | 12, phase A        |

## Status board

Updated by whoever finishes a phase.

| #   | Plan                            | Status      | Phases done |
| --- | ------------------------------- | ----------- | ----------- |
| 00  | Immediate hardening             | Not started | —           |
| 01  | Operational foundations         | Not started | —           |
| 02  | Background jobs                 | Not started | —           |
| 03  | Rate limiting                   | Not started | —           |
| 04  | Accounts, e-mail and trust      | Not started | —           |
| 05  | Localisation                    | Not started | —           |
| 06  | Multilingual content and search | Not started | —           |
| 07  | Moderation core                 | Not started | —           |
| 08  | AI moderation                   | Not started | —           |
| 09  | Read scalability                | Not started | —           |
| 10  | Deployment and operations       | Not started | —           |
| 11  | Semantic search                 | Not started | —           |
| 12  | Public API                      | Not started | —           |
