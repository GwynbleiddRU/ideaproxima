# Production-readiness program

How Ideaproxima grows from a sound foundation into a worldwide, production-ready platform: rate limiting,
twelve languages, AI-assisted moderation, and everything those depend on.

Written 2026-11-17 from a full [audit of the API](api-audit.md); revised 2026-11-18 for strictly sequential
execution, with two plans added (13 and 14) after a second review of the whole delivery. It contains fifteen
plans, `00` to `14`. Each has a prompt in `prompts/api/` with the same number and name, ending in
`-prompt.md`, that briefs the agent who implements it. The prompts were verified against the code on
2026-11-18.

## How to use this

- **The owner** reads this page, then [Decisions for the owner](#decisions-for-the-owner), and starts one
  session at a time with: "Do the next step of the production-readiness program."
- **For OpenAI models**, use the [Codex handoff and model guide](codex-handoff.md) for the kickoff message and phase map.
- **An agent** follows [How a session works](#how-a-session-works) below.
- A plan is a design with reasons, not a script. When the code contradicts a plan, the agent says so and
  proposes the correction; it does not silently follow either.

## How a session works

Each session is **one step** of the [sequence](#sequence-and-status): one phase of one plan. Steps run strictly
one after another. The agent starts with no memory of earlier sessions, so everything a later session needs
must be left in the repository, never only in a conversation.

**Starting.** The next step is the first numbered row of the [sequence](#sequence-and-status) whose status is not
"Done". The owner may name a step instead ("step 11", or "plan 03, phase B"). Open the prompt of that step's
plan: `prompts/api/NN-<name>-prompt.md`.

**Before writing code**

1. Read, in order: [`concept.txt`](../../../concept.txt); the [agent documentation](../README.md) (the
   non-negotiables and the definition of done); this page's [rules](#rules-for-every-plan); the plan,
   including any `## Implementation notes` that earlier steps left in it; the audit findings it cites; the
   code the prompt lists.
2. Check the [sequence](#sequence-and-status). All preceding numbered steps must be "Done" for a numbered step. Use the trigger rules below the table for T1 and T2. If one is not, stop
   and say so rather than building around it.
3. Re-verify the facts you depend on. Prompts state what was true on the date they give; earlier steps have
   changed the code since. Where a fact no longer holds, say so and adapt.
4. Check the branch, HEAD and staged and unstaged changes so you can identify your own work at handoff.
   Run `npm run check` and note the baseline. A failure that was already there is reported, not silently
   fixed and not blamed on your change.

**While working**

- Stay inside the step. Work that belongs to another step is reported, not done.
- Follow the [code quality rules](../../../AGENTS.md#code-quality). In the final diff, trace the affected
  entry point, check the cost of its work and verify the failure or concurrency case that matters here.
- Contract first; tests with every change; new switches default to today's behaviour.
- An interface change is first a mock-up in `designs/` for the owner. Present it and wait for the owner's
  answer in the same session. If the owner cannot answer now, finish the non-visual part, set the step to
  "Waiting for the owner: …", and stop; the next step does not start until this one is done.
- A decision that belongs to the owner is not made by the agent: build with the plan's default and list it.
  Never switch a production mode (for example moderation to `enforce`) or commit the `/v1` baseline unasked.

**Finishing**

1. Apply the prompt's definition of done and report-back items to the selected phase. A later phase's deliverable stays with that phase. Run the applicable commands and record which passed.
2. Leave the hand-over in the repository:
   - the step's row in the [sequence](#sequence-and-status) ("Done 2026-12-03") and the plan's status line;
   - decisions in the document that owns them (an ADR, the data model, the guides the prompt lists);
   - measurements in the plan's own tables, replacing estimates;
   - anything that differs from the plan under a heading `## Implementation notes` at the end of the plan:
     what changed, why, and what later steps must know.
3. Record the phase, changed paths, commands run and their outcomes, outstanding decisions, and the next
   eligible row in the plan's implementation notes. If a required check or approval is missing, keep the
   current row open and record the precise condition for resuming it.
4. Commit your work and the matching handoff records together on `main` with a conventional message.
   Review the exact paths and hunks going into the commit, including anything already staged. Leave
   unrelated work in its original state and keep local prompts ignored. On an interrupted phase, commit a
   coherent checkpoint and label its verification status accurately. If only the blocker record is ready,
   commit that record and identify any unfinished working-tree changes. Skip an empty commit.
5. Verify the commit with `git show --stat --oneline HEAD` and check `git status --short --branch`.
   Report the actual hash, checks and any remaining changes. Finish with the
   [next-chat handoff](codex-handoff.md#hand-off-to-the-next-chat). If the commit failed, resolve it or
   report the blocker and hand back the current step. The next session only advances from a committed handoff.

**One step at a time.** Never run two steps at once, even of different plans: every step relies on the exact
state the steps above it left, and both halves of the product (contract, web shell, catalogues) are touched
by most of them.

## Where the platform stands

The foundation is unusually strong for its size: append-only facts enforced by database triggers, an executable
contract (66 endpoints, every response checked against its schema, every endpoint exercised), one permission
policy, correct concurrency proven on real PostgreSQL, and a stateless process. None of that needs rework.

What is missing is everything around it. The [audit](api-audit.md) records 58 findings (53 from the API audit,
5 from the 2026-11-18 review of the web delivery), 20 of which block a public launch:

| Area             | State today                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Abuse protection | Two in-memory fixed-window limits; reads unlimited; the client address can be forged; no bot friction                               |
| Accounts         | E-mail and password only: no verification, no recovery, no second factor                                                            |
| Moderation       | One endpoint that hides six kinds of content; no reports, queue, appeals or automation; hidden text leaks through the activity feed |
| Languages        | English only: interface, vocabulary, errors, search stemming, URL slugs                                                             |
| Scale            | Metrics recomputed inside every vote; unbounded lists; offset pagination; nothing cacheable                                         |
| Operations       | A text log and one health check; no metrics, background work, release pipeline or rehearsed restore                                 |
| Public web       | Every page is the same shell with status 200; no link previews; no policy pages; browser errors unseen; Chrome-only tests           |

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

| #   | Plan                                                                     | Result                                                                                    | Engineer-days |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------- |
| 00  | [Immediate hardening](00-immediate-hardening.md)                         | Nine findings closed that need no design decision, seven of them launch blockers          | 2–3           |
| 01  | [Operational foundations](01-operational-foundations.md)                 | Validated configuration, structured logs, metrics, probes, graceful shutdown              | 3–5           |
| 02  | [Background jobs](02-background-jobs.md)                                 | A transactional job queue, a worker, schedules; metrics can refresh asynchronously        | 5–7           |
| 03  | [Rate limiting](03-rate-limiting.md)                                     | Named policies per endpoint and trust tier, shared across instances; proof of work        | 8–11 (+1–2)   |
| 04  | [Accounts, e-mail and trust](04-accounts-and-trust.md)                   | Verification, recovery, sessions, ORCID sign-in, staff second factor, export and deletion | 12–16         |
| 05  | [Localisation](05-localization.md)                                       | The product in twelve languages, including right-to-left                                  | 15–22         |
| 06  | [Multilingual content and search](06-multilingual-content-and-search.md) | Content languages, Unicode slugs, per-language search without extensions                  | 11–15         |
| 07  | [Moderation core](07-moderation-core.md)                                 | Policy, reports, queue, decisions, appeals; every text can be hidden                      | 18–24         |
| 08  | [AI moderation](08-ai-moderation.md)                                     | Self-hosted multilingual screening with measured accuracy                                 | 18–25         |
| 09  | [Read scalability](09-read-scalability.md)                               | Load tests, keyset pagination, caching, bounded lists                                     | 11–15 (+3–5)  |
| 10  | [Deployment and operations](10-deployment-and-operations.md)             | Release pipeline, alerts, proven backups, runbooks, compliance groundwork                 | 13–19         |
| 11  | [Semantic search](11-semantic-search.md)                                 | Cross-language retrieval and duplicate suggestions                                        | 5–8           |
| 12  | [Public API](12-public-api.md)                                           | Contract freeze, idempotency, API keys, open data                                         | 8–12          |
| 13  | [The public web](13-public-web.md)                                       | Crawlable pages and link previews, policy pages, browser telemetry, cross-browser tests   | 4–6           |
| 14  | [Launch readiness](14-launch-readiness.md)                               | Evidence and disposition for every finding and a verdict on the release candidate         | 1–2           |

Figures in brackets are phases that run only when their trigger is reached.

## Sequence and status

The order satisfies every dependency between phases. Its main choices:

- **Languages early, translations late.** The localisation runtime (steps 6–9) lands before any other
  interface work, so every later string goes straight into the English catalogue and every later error has a
  stable reason. The eleven translations are drafted at step 38, after the last interface change.
- **Content language before moderation.** Step 15 gives every text a language, so reports, cases and model
  assessments know theirs. Step 16 creates the single visibility writer, so the search index (step 17) follows
  it from the start.
- **Moderation tools before the staff second factor** (step 27), so the second factor covers all of them.
- **Shapes before caching, and caching before the public web** (steps 29–32): the contract freeze (step 40)
  comes after the last shape change.
- **Operations last among the builds** (steps 33–39), when there is a complete product to deploy, alert on,
  restore and stress.
- **Nothing before the launch depends on real traffic.** The comparison of models on real content (step 47)
  happens after the launch, while the AI flags for human review.

Updated by whoever finishes a step: `Not started`, `In progress`, `Waiting for the owner: …`, or
`Done YYYY-MM-DD`.

| Step | Plan | Phase | Delivers                                                                                                   | Waits for the owner   | Status          |
| ---- | ---- | ----- | ---------------------------------------------------------------------------------------------------------- | --------------------- | --------------- |
| 1    | 00   | —     | Trusted network keys, bounded hashing, pre-session limits, redacted activity and evidence, capped offsets  | —                     | Done 2026-11-25 |
| 2    | 01   | A     | Validated configuration, structured logs, request ids, metrics                                             | —                     | Done 2026-11-25 |
| 3    | 01   | B     | Liveness and readiness, drain on shutdown, database guard rails, error reporter                            | —                     | Not started     |
| 4    | 02   | A     | Job queue, worker, schedules, `JOBS_MODE`                                                                  | —                     | Not started     |
| 5    | 02   | B     | Purges, asynchronous metric refresh, compose worker service                                                | —                     | Not started     |
| 6    | 05   | A     | `packages/i18n`, error reasons, localised vocabulary, topics and errors, `/v1/locales`                     | Decision 2            | Not started     |
| 7    | 05   | B     | Web localisation runtime, language switcher, right-to-left, script fonts; shell and auth pages extracted   | Mock-ups              | Not started     |
| 8    | 05   | C1    | Interface extraction: home, explore, the idea page and its tabs                                            | —                     | Not started     |
| 9    | 05   | C2    | Interface extraction: editor, topics, search, activity, people, account, dialogs                           | —                     | Not started     |
| 10   | 03   | A     | GCRA, memory and PostgreSQL stores, trust tiers, the policy catalogue                                      | —                     | Not started     |
| 11   | 03   | B     | Limits declared per endpoint and enforced; rate-limit headers; web handling of 429                         | —                     | Not started     |
| 12   | 03   | C     | Proof of work on registration                                                                              | —                     | Not started     |
| 13   | 04   | A     | Mail, verification, password reset, e-mail change, registration modes                                      | Decision 7; mock-ups  | Not started     |
| 14   | 04   | B     | Session list and revocation, security log, trust inputs, terms and minimum-age mechanism                   | Decision 15           | Not started     |
| 15   | 06   | A     | Content languages, language detection, Unicode slugs                                                       | —                     | Not started     |
| 16   | 07   | A     | Every text can be hidden; one visibility writer; text-free activity payloads                               | —                     | Not started     |
| 17   | 06   | B     | The multilingual search index                                                                              | —                     | Not started     |
| 18   | 06   | C     | Fair minimum lengths, database locale check, language display and filter in the web app                    | Decision 11; mock-ups | Not started     |
| 19   | 07   | B     | Content policy draft, reports, cases, the queue API, decisions                                             | Decisions 4, 10       | Not started     |
| 20   | 07   | C     | Notices, appeals, restrictions, bulk clean-up, statistics, external notices                                | —                     | Not started     |
| 21   | 07   | D     | Web: report dialog, notices and appeals, the moderator queue                                               | Mock-ups              | Not started     |
| 22   | 08   | A     | Model files, inference service, classifier, assessments, `shadow` mode                                     | Decision 18           | Not started     |
| 23   | 08   | B     | Golden set in twelve languages, evaluation runner, rules classifier, decision policy                       | —                     | Not started     |
| 24   | 08   | C     | `flag` mode, the assessment panel, model comparison on the golden set, runbook, alert definitions          | —                     | Not started     |
| 25   | 08   | D     | `enforce` mode built and tested, switched off                                                              | —                     | Not started     |
| 26   | 04   | C     | Sign-in with ORCID, then Google and GitHub                                                                 | Decision 13; mock-ups | Not started     |
| 27   | 04   | D     | Staff second factor, export, deletion with grace period                                                    | Mock-ups              | Not started     |
| 28   | 09   | A     | Load dataset, k6 scenarios, baseline report                                                                | —                     | Not started     |
| 29   | 09   | B     | Keyset lenses, bounded lists, the viewer split, materialised lens inputs                                   | —                     | Not started     |
| 30   | 09   | C     | Cache rules, ETag, compression, session cache                                                              | —                     | Not started     |
| 31   | 13   | A     | Crawlable pages: real status codes, metadata, link previews, sitemap, robots                               | Decision 19; mock-up  | Not started     |
| 32   | 13   | B     | Policy, help and contact pages; browser telemetry; Firefox and WebKit tests                                | Decision 16; mock-ups | Not started     |
| 33   | 10   | A     | Production compose file, image publishing, release workflow, release-safe web assets                       | Decision 12           | Not started     |
| 34   | 10   | B     | Dashboards, alerts, uptime probe                                                                           | —                     | Not started     |
| 35   | 10   | C     | Backups and the weekly automated restore drill                                                             | —                     | Not started     |
| 36   | 10   | D     | Supply-chain and runtime hardening, edge settings                                                          | —                     | Not started     |
| 37   | 10   | E     | Runbooks, retention jobs, compliance documents                                                             | —                     | Not started     |
| 38   | 05   | D     | Glossaries, drafts in eleven languages, `i18n:check`, pseudo-locale, audits in `de`, `ar`, `ja`            | Decision 3            | Not started     |
| 39   | 10   | F     | Game day on the production layout                                                                          | —                     | Not started     |
| 40   | 12   | A     | Contract freeze: checklist, baseline, compatibility test, deprecation mechanism                            | Decision 14           | Not started     |
| 41   | 14   | —     | Launch-readiness review and report                                                                         | The launch decision   | Not started     |
|      |      |       | **Launch** (the owner's decision, on the report of step 41)                                                |                       |                 |
| 42   | 12   | B     | Idempotency keys                                                                                           | —                     | Not started     |
| 43   | 12   | C     | API keys, the generated typed client                                                                       | Decision 20           | Not started     |
| 44   | 12   | D     | Open-data exports                                                                                          | Decision 8 (licence)  | Not started     |
| 45   | 11   | A     | Embeddings and hybrid search                                                                               | —                     | Not started     |
| 46   | 11   | B     | Similar-idea and similar-claim suggestions                                                                 | Mock-ups              | Not started     |
| 47   | 08   | E     | Comparison on real traffic (at least 14 days after launch); routing, judge, quantisation; enforce proposal | Decisions 5, 6, 17    | Not started     |
| T1   | 03   | D     | Redis store for rate limits, when its trigger is reached                                                   | —                     | Not started     |
| T2   | 09   | D     | Pooler, read replica, ledger partitioning, as triggered                                                    | —                     | Not started     |

Steps 42–47 also need the owner's recorded launch and date. After launch, T1 and T2 may be selected at a session boundary when their own measured trigger is documented. Neither optional row is a prerequisite for the other or for numbered work. Record which sub-trigger fired and leave other conditional changes deferred.

### Milestones

| Milestone                    | Steps | Exit criterion                                                                                                                                                                                          | Engineer-days |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| M0 Hardened                  | 1     | The nine findings of plan 00 closed and tested                                                                                                                                                          | 2–3           |
| M1 Operable                  | 2–5   | Metrics, logs and probes live; a worker runs schedules                                                                                                                                                  | 8–12          |
| M2 Multilingual foundation   | 6–9   | Every interface string, vocabulary term, topic and error comes from a catalogue; right-to-left works                                                                                                    | 13–19         |
| M3 Safe to open registration | 10–27 | Limits hold across instances; e-mail verified; staff use a second factor; report → decision → appeal works; every text can be hidden; the AI flags with measured accuracy; search works in every script | 66–88         |
| M4 Launch-ready              | 28–41 | Load budgets met; pages crawlable; policies published; restore drill passing; game day done; eleven translations drafted; `/v1` frozen; the launch report written                                       | 33–48         |
| M5 After launch              | 42–47 | Idempotency, API keys, open data, semantic search; enforcement decided on real evidence                                                                                                                 | 12–20         |

## Estimates

**Effort.** 122–170 engineer-days to launch (M0–M4) and 138–197 in total, including the two triggered phases.
For one experienced engineer that is six to nine months. In agent terms it is 41 sessions to launch and 49 in
all, each followed by an owner review.

The ranges are judgement, not measurement. What moves them most:

- **Interface text extraction** (plan 05): 61 files of interface code. The low end assumes few layout
  surprises.
- **Moderation** (plans 07 and 08): the widest ranges, because they touch every DTO that carries text and
  depend on policy decisions not yet made.
- **Owner decisions and outside people**: licences, the content policy, native reviewers, providers. None of
  them is engineering time, and any of them can stop a milestone.

**Calendar floors that effort cannot compress:**

- Three consecutive weekly restore drills must pass before the launch (they start at step 35).
- About one reviewer-day per language, from step 38 on; a language without a review ships as `beta`.
- At least 14 days of real traffic before automated hiding may even be proposed (step 47).
- The owner's answers to mock-ups and decisions, at the steps the sequence names.

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
"nothing, ask a moderator, act", and small enough to run on a CPU through llama.cpp. Mistral's Shieldstral 1.0
(3B) is worth downloading too for the comparison plan 08 runs: it accepts a policy written in plain language,
which suits this platform, but it is newer, slower on a CPU and does not officially cover Hindi or Indonesian.

**The files in `models/`** (downloaded by the owner on 2026-11-17, verified 2026-11-18) are byte-identical to
community conversions on Hugging Face: the 0.6B to `QuantFactory/Qwen3Guard-Gen-0.6B-GGUF`
(`Qwen3Guard-Gen-0.6B.Q8_0.gguf`), the 4B to `burrowswang/Qwen3Guard-Gen-4B-Q4_K_M-GGUF`
(`qwen3guard-gen-4b-q4_k_m.gguf`, renamed). Their weights also match the `mradermacher` conversions in every
sampled range. Plan 08 phase A pins them by hash and checks their embedded chat templates against Qwen's.

## Rules for every plan

These add to the non-negotiables in the [agent documentation](../README.md); they do not replace any. How a
session starts, stays in scope and hands over is in [How a session works](#how-a-session-works).

1. **Contract first, and freeze-aware.** Change `packages/contracts` first. Until the freeze (step 40), a
   breaking change is allowed if the web app changes in the same commit; after it, never.
2. **A new fact table gets a history guard** in a hand-written migration. A new derived table gets one writer
   module and a rebuild command. A new operational table (jobs, tokens, limits) gets a purge schedule.
3. **New text is born complete.** From step 6 every new error has a reason, and from step 7 every new
   interface string goes into the English catalogue. From step 15 every new text field gets a language, and
   from step 16 it is registered as a moderation surface, which plan 08 screens from step 22.
4. **A new endpoint declares** its access, its limits (from step 11) and its cache rule (from step 30) in the
   catalogue.
5. **Every switch defaults to today's behaviour** in development and tests. New capabilities are enabled per
   environment, by configuration.
6. **Interface changes are previewed and audited.** Larger changes to the web app are mocked up in `designs/`
   (a local, uncommitted folder) and approved by the owner before they are implemented. Every new page joins
   the browser audit: an end-to-end flow, and the accessibility check in both themes.
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
11. **Leave the product shippable.** Every step ends with the whole application working, the default
    configuration unchanged in behaviour unless the plan says otherwise, and no half-built feature exposed
    to users.

## Decisions for the owner

Nothing here blocks starting. Each decision blocks the step named; until then the plans build with the
default.

| #   | Decision                                                                    | Default assumed                                                              | Needed by        |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- |
| 1   | Download the moderation models                                              | Done 2026-11-17 (sources above)                                              | —                |
| 2   | The twelve languages, and which must be `released` at launch                | en, zh-Hans, es, ar, pt-BR, id, fr, ja, ru, de, hi, ko; all `beta`           | Step 6           |
| 3   | Native reviewers for each language                                          | None yet: languages ship as `beta` until reviewed                            | Step 38          |
| 4   | The content policy and its reason codes                                     | The draft in plan 07                                                         | Step 19          |
| 5   | Which reasons may hide content automatically                                | Sexual content, privacy, violent threats, spam from new accounts             | Step 47          |
| 6   | Hold new accounts' content for the seconds an assessment takes              | Yes, once `enforce` is approved                                              | Step 47          |
| 7   | Registration: immediate sign-in, or only after verifying the e-mail         | Immediate                                                                    | Step 13          |
| 8   | Terms, privacy notice, and the licence for contributions (question 12)      | Undecided: the mechanism and skeletons are built, the texts are missing      | Launch; step 44  |
| 9   | Code licence (question 25)                                                  | Undecided                                                                    | Publication      |
| 10  | Whether moderators are named in the public moderation log                   | Named, as today                                                              | Step 19          |
| 11  | Lenses default to the reader's languages or to all languages                | The reader's languages, with one click to all                                | Step 18          |
| 12  | Hosting, CDN and mail providers; recovery objectives; who is on call        | One machine with compose, managed PostgreSQL; 5 min / 4 h                    | Step 33          |
| 13  | Sign-in providers beyond ORCID                                              | ORCID first; Google and GitHub optional                                      | Step 26          |
| 14  | The date of the `/v1` freeze                                                | Immediately before launch                                                    | Step 40          |
| 15  | Minimum age for an account                                                  | 16, confirmed at registration together with the terms                        | Step 14          |
| 16  | The operator's contact details for users, legal notices and the authorities | Placeholders in the contact page; launch is blocked until filled             | Launch           |
| 17  | AI moderation at launch                                                     | `flag` in languages that pass the golden-set flag gate, `shadow` in the rest | Step 41; step 47 |
| 18  | Production model files                                                      | The downloaded conversions, pinned by hash after the template check          | Step 22          |
| 19  | Site description and preview image for link previews                        | A one-line description and a plain branded image, previewed first            | Step 31          |
| 20  | API keys: self-service or granted on request                                | Self-service for verified accounts                                           | Step 43          |
