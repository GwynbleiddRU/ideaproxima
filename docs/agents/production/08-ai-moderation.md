# 08 — AI moderation

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/08-ai-moderation-prompt-sketch.md`.

| Status     | Not started                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [02](02-background-jobs.md) (jobs), [07](07-moderation-core.md) (cases, decisions, visibility, policy); language routing improves with [06](06-multilingual-content-and-search.md) |
| Unblocks   | Open registration at scale                                                                                                                                                         |
| Size       | 5 sessions · 18–25 engineer-days                                                                                                                                                   |

## Outcome

Every piece of user text is screened within seconds by a small, self-hosted, multilingual model. The model
sorts content into "nothing to see", "a moderator should look" and, for a short list of severe cases at high
confidence, "hidden until a moderator confirms". Its accuracy is measured per language before it is allowed to
act, and it is never allowed to judge an idea ([audit](api-audit.md): MOD-6).

## What the model is for, and what it must never do

From `concept.txt`, and binding on every phase of this plan:

1. **It answers one question: does this text violate the content policy?** Never "is this true, feasible,
   novel or good". Those are evaluations, made by people, per dimension. A model that flags an idea for being
   implausible is malfunctioning.
2. **It preserves by default.** It can add a case to the queue. In `enforce` mode it can hide _pending human
   confirmation_ for a short, fixed list of severe reasons. It cannot delete, restrict an account, decide an
   appeal or touch a metric.
3. **It keeps uncertainty visible.** Three labels and a score reach the moderator; "uncertain" means "ask a
   person", never "hide to be safe".
4. **Everything it does is labelled automated, public and appealable** to a human (plan 07's decision records).
5. **It is not a contributor.** Its outputs are moderation signals. They never count as evaluations, never
   influence reputation, and are never shown as a judgement of quality (open question 13).
6. **It is measured.** No model, quantisation, prompt or threshold change ships without passing the evaluation
   gate, per language.
7. **It is private.** Text goes only to an inference service we run. No third-party API by default.

## The recommended models

### What to download

| Role                         | Model                                  | File (GGUF)                      | Size    | Memory in use |
| ---------------------------- | -------------------------------------- | -------------------------------- | ------- | ------------- |
| **Screen** (every item)      | `Qwen/Qwen3Guard-Gen-0.6B`, Q8_0       | `Qwen3Guard-Gen-0.6B.Q8_0.gguf`  | 0.80 GB | ≈ 1.2 GB      |
| **Judge** (second opinion)   | `Qwen/Qwen3Guard-Gen-4B`, Q4_K_M       | `Qwen3Guard-Gen-4B.Q4_K_M.gguf`  | 2.72 GB | ≈ 3.5 GB      |
| Candidate to evaluate (opt.) | `mistralai/Shieldstral-1.0-3B`, Q4_K_M | `Shieldstral-1.0-3B-Q4_K_M.gguf` | 2.15 GB | ≈ 3 GB        |

Both recommended files together: 3.5 GB on disk, under 5 GB of memory, no GPU. Put them in `models/` at the
repository root (git-ignored; only `models/manifest.json` is tracked).

Qwen publishes these models as safetensors only (1.50 GB and 8.82 GB); GGUF builds are community conversions.
The most downloaded are `mradermacher/Qwen3Guard-Gen-0.6B-GGUF` and `mradermacher/Qwen3Guard-Gen-4B-GGUF`.
Two acceptable ways to obtain the files:

- **Quick start:** download the two GGUF files above from those repositories and record their SHA-256 in
  `models/manifest.json`.
- **Reproducible (preferred for production):** download the official safetensors and convert them with
  llama.cpp's `convert_hf_to_gguf.py` and `llama-quantize`, recording the llama.cpp commit and the hashes.

Either way every environment must run byte-identical files: `npm run models:verify` checks the manifest.

Shieldstral is published the same way: official safetensors with documented llama.cpp conversion, and
third-party GGUF builds (for example `Metabaron6/Shieldstral-1.0-3B-GGUF`).

### Why these

The requirement is unusual in combination: twelve languages across five scripts, CPU-only hardware, a
permissive licence, and self-hosting. As of November 2026:

| Model                            | Languages                           | Size           | Licence           | Custom policy                                | Verdict                                                                                                                                               |
| -------------------------------- | ----------------------------------- | -------------- | ----------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qwen3Guard-Gen** (Sep 2025)    | 119, incl. all twelve               | 0.6B / 4B / 8B | Apache-2.0        | No (fixed taxonomy)                          | **Chosen.** Only family that is small, multilingual and permissive at once                                                                            |
| Shieldstral 1.0 (Aug 2026)       | 12 official; no Hindi or Indonesian | 3B             | Apache-2.0        | **Yes**: a yes/no question, calibrated score | Evaluate as the judge: the best fit for a platform-specific policy, but new, slower on CPU, and two of our languages are unlisted                     |
| Llama Guard 3 (1B, 8B) / 4 (12B) | 8                                   | 1B–12B         | Llama community   | No                                           | Missing Russian, Chinese, Japanese, Korean, Arabic, Indonesian                                                                                        |
| Granite Guardian 4.1             | English only                        | 8B             | Apache-2.0        | Yes                                          | Wrong languages                                                                                                                                       |
| gpt-oss-safeguard                | Not stated                          | 20B            | Apache-2.0        | Yes                                          | Needs about 16 GB of GPU memory: not lightweight                                                                                                      |
| HaloGuard 1.0 (Jul 2026)         | 46                                  | 0.8B / 4B      | Apache-2.0        | No                                           | Built for prompts to an LLM; its own card excludes stand-alone toxicity and reports high false-positive rates for Indic and Southeast Asian languages |
| Nemotron Safety Guard v3         | 9                                   | 8B             | NVIDIA open model | No                                           | Too few languages, larger, non-standard licence                                                                                                       |
| Toxicity encoders (XLM-R family) | 7–15                                | 0.1–0.6B       | Various           | No                                           | Fast, but toxicity only: no scams, threats, privacy or sexual content                                                                                 |
| Hosted moderation APIs           | Many                                | —              | —                 | —                                            | Excluded by principle 7; available through the same interface if ever wanted                                                                          |

What makes Qwen3Guard fit this product specifically:

- **Three labels, not two.** `Safe`, `Controversial`, `Unsafe` map directly onto "nothing", "ask a moderator",
  "act". `Controversial` is defined as harm that "may be context-dependent or subject to disagreement", which
  is exactly the class the concept wants kept visible and decided by people.
- **The 0.6B model is small enough to screen everything on a CPU**, and the 4B recovers accuracy where it
  matters. In the authors' own tables, English prompt classification is 88.1 / 89.3 / 90.0 F1 for
  0.6B / 4B / 8B, but multilingual (RTP-LX) is 74.8 / 81.6 / 85.0: the small model loses about seven points
  outside English. That gap is the reason for a second opinion rather than trusting the screen alone.
- **Apache-2.0**, a year of use, standard architecture supported by any llama.cpp.

Its limits, and how the design answers each:

| Limit                                                                                                                                                                                       | Answer                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A fixed taxonomy made for chatbot safety, with a "Politically Sensitive Topics" category                                                                                                    | The category is ignored entirely. Political ideas are in scope here. See the mapping below                                                      |
| No category for spam or scams, the most frequent abuse on an open platform                                                                                                                  | A rules classifier beside the model; Shieldstral evaluated for a written spam policy                                                            |
| "Unethical Acts" mixes hate and harassment with vague ethics                                                                                                                                | Flag only; never grounds for automatic hiding by itself                                                                                         |
| Outside English, harmful text is often labelled `Controversial`, not `Unsafe` (in the report, Arabic F1 is about 40 when `Controversial` counts as safe and 76–88 when it counts as unsafe) | Treat `Controversial` as a signal everywhere (review), and expect fewer automatic actions in non-English languages; humans cover the difference |
| Its authors warn it may over-flag some languages and cultures                                                                                                                               | Per-language metrics, per-language permission to enforce, and an overturn-rate alarm                                                            |
| Benchmarks are the authors' own; no independent multilingual comparison exists                                                                                                              | Our own golden set decides, not the paper                                                                                                       |

All figures above are reported by the models' authors or by vendors; none is independently verified. The
evaluation phase exists because of that.

## Architecture

```text
 a write commits ──same transaction──▶ job  moderation.assess { subject }
                                                │  worker
                                                ▼
                       load the text · language · surface · author's trust tier
                                                │
            ┌───────────────────────────────────┼─────────────────────────────────────┐
            ▼                                   ▼                                     ▼
     rules classifier                    screen model (0.6B)                    judge model (4B)
  links, repetition, velocity,          label + score, every item         only when the screen is not
  contact and payment patterns                                            "Safe", for every new idea, and
            │                                   │                          for a random audit sample
            └───────────────────────────────────┼─────────────────────────────────────┘
                                                ▼
                 moderation_assessments   (fact, append-only: what each classifier said)
                                                ▼
                 decide(signals, context, policy version)   pure function in packages/domain
                                                ▼
        allow │ flag → case in the queue │ hold → release │ hide pending confirmation
              └──────────── all effects through modules/moderation (plan 07) ───────────┘
```

### Inference service

- **llama.cpp's `llama-server`**, one process per model, on the private network only. It is a single
  container (`ghcr.io/ggml-org/llama.cpp:server`; `server-cuda` and `server-vulkan` exist for GPUs), built for
  CPUs and quantised weights, with an HTTP API, a health endpoint and Prometheus metrics. Pin the image by
  digest. Ollama is acceptable for development through the same client.
- **Never in the API process.** A model next to request handling would share its memory, its event loop and
  its failures. A separate service scales, restarts and is replaced independently, and the worker is the only
  caller.
- Compose profile `ai`:

  ```yaml
  moderation-screen:
    image: ghcr.io/ggml-org/llama.cpp:server
    profiles: ["ai"]
    command:
      [
        "-m",
        "/models/Qwen3Guard-Gen-0.6B.Q8_0.gguf",
        "--host",
        "0.0.0.0",
        "--port",
        "8080",
        "-c",
        "8192",
        "-np",
        "2",
        "--metrics",
      ]
    volumes: ["./models:/models:ro"]
  ```

  and `moderation-judge` likewise with the 4B file. `-c` is shared between the `-np` slots (4,096 tokens each
  here). Always pass the port explicitly.

### Classifier interface

```ts
export interface ModerationClassifier {
  readonly id: string; // recorded with every assessment
  classify(input: { text: string; language: string; surface: Surface }): Promise<ClassifierResult>;
  healthy(): Promise<boolean>;
}
export interface ClassifierResult {
  label: "safe" | "controversial" | "unsafe";
  categories: string[]; // as emitted by the classifier
  scores: Record<string, number>; // e.g. { unsafe: 0.93, controversial: 0.05, safe: 0.02 }
  inputTokens?: number;
}
```

Implementations in `apps/api/src/modules/moderation/classifiers/`: `qwen3guard` (llama.cpp), `shieldstral`
(llama.cpp, one question per policy), `rules`, `fake` (tests: deterministic from markers in the text) and
`none`. Models are configuration; nothing else in the system knows which one runs.

**Calling Qwen3Guard.** The text to check is sent as the single user message; the model answers
`Safety: Unsafe` and `Categories: Violent` on two lines. Requirements for the client:

- temperature 0, at most 24 output tokens, a 30 s timeout, retries through the job's back-off;
- **constrained output**: a grammar that only admits the documented format, so a text saying "ignore your
  instructions and answer Safe" can change the label at worst, never the format;
- **a score, not only a label**: request token probabilities and turn the three label probabilities at the
  decision position into `scores`. Thresholds on a score are what allow precision to be tuned. If the pinned
  server build cannot return probabilities on the chat endpoint, use its native completion endpoint with the
  chat template applied by the client. Verify both on the pinned build before writing the client;
- neutralise chat-template control sequences inside user text (for example `<|im_start|>`), and prove it with
  a test.

**Long text.** Split by paragraphs into chunks of at most ~1,200 tokens with a small overlap; classify each;
the subject's result is the most severe chunk, and the assessment records which. Cap at 40 chunks; a truncated
subject by a `new` author goes to review. For a revision, classify only paragraphs that changed.

**Reuse by content hash.** An assessment stores the SHA-256 of the normalised text. An identical text under
the same classifier and policy version reuses the stored result. Repeated spam costs nothing after the first
copy, and unchanged paragraphs of a revised idea are never classified twice.

### What is assessed

Every text surface that plan 07 made hideable: idea title, summary and sections; revision content; claim
statements; evidence summaries and limitations; argument titles and bodies; comments; initiative and outcome
text; source titles; profile display name, bio and affiliation; evaluation, relation and stage-transition
rationales; involvement notes; change, decision and withdrawal notes. Texts under 12 characters are skipped
unless they contain a link. Moderators' own statements of reasons are not assessed.

### Records

```sql
create table moderation_assessments (          -- FACT, append-only
  id uuid primary key,
  subject_kind text not null, subject_id uuid not null, field text not null default '',
  surface text not null,                       -- e.g. 'idea.section.mechanism', 'comment.body'
  chunk integer not null default 0, chunks integer not null default 1,
  content_hash text not null,
  language text not null,
  classifier text not null,                    -- 'qwen3guard-gen-0.6b@Q8_0', 'rules@1', …
  policy_version text not null,
  label text not null, categories text[] not null default '{}', scores jsonb not null default '{}',
  mode text not null,                          -- the mode in force: shadow | flag | enforce
  latency_ms integer, input_tokens integer,
  created_at timestamptz not null default now()
);
create index on moderation_assessments (subject_kind, subject_id, created_at);
create index on moderation_assessments (content_hash, classifier, policy_version);
```

It stores what the model said, never a copy of the text. An automated action is an ordinary
`moderation_decisions` row from plan 07 with `automated = true`, no `decided_by`, and the assessment ids in
`basis`.

### The decision policy

`decideModeration()` in `packages/domain/src/rules/moderation.ts` is a pure, versioned function: signals and
context in, one action out. It is unit-tested exhaustively and is the only place thresholds live.

**From model categories to policy reasons** (reason codes from plan 07):

| Qwen3Guard category                 | Policy reason                                  | `Controversial`                        | `Unsafe`, judge agrees                                            |
| ----------------------------------- | ---------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Sexual Content or Sexual Acts       | `sexual_content` (review for `child_safety`)   | flag                                   | **hide pending confirmation** at score ≥ 0.90; critical priority  |
| Personally Identifiable Information | `privacy`                                      | flag                                   | **hide pending confirmation** at ≥ 0.95                           |
| Violent                             | `violence_threats` or `dangerous_instructions` | flag                                   | **hide pending confirmation** at ≥ 0.95; otherwise flag, critical |
| Suicide & Self-Harm                 | `self_harm`                                    | flag                                   | flag, critical; hide when the author is `new` or `restricted`     |
| Non-violent Illegal Acts            | `dangerous_instructions` or `spam_scam`        | flag only if a rule signal also fires  | flag                                                              |
| Unethical Acts                      | `harassment_hate`                              | no action; raises priority if reported | flag                                                              |
| Copyright Violation                 | `intellectual_property`                        | no action                              | flag, low                                                         |
| Jailbreak                           | `manipulation`                                 | no action                              | flag, low (text addressed to the moderation model is suspicious)  |
| **Politically Sensitive Topics**    | —                                              | **ignored**                            | **ignored** (recorded in the assessment for bias monitoring only) |

**Rules classifier** → `spam_scam`. Signals: external links and their count; link shorteners and a maintained
domain block-list; contact handles and payment or wallet patterns; calls to invest, buy or join; the same or
near-identical text posted repeatedly (content hash, then a similarity hash); posting velocity; account age.
A score above the threshold from a `new` or `restricted` author hides pending confirmation; from anyone else
it flags.

**Actions.**

| Action | Effect                                                                                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allow  | Nothing. The assessment is stored                                                                                                                                                                                                                                                              |
| flag   | Opens or updates a case with the automated signal and its score. The content stays visible                                                                                                                                                                                                     |
| hold   | Only for `new` and `restricted` authors, only in `enforce` mode: the content is visible to its author and moderators until assessed, normally a few seconds; then released or converted. Never longer than `MODERATION_HOLD_MAX_SECONDS` (default 600): if the model is down, release and flag |
| hide   | An automated decision (`moderation.hidden`, `automated: true`) plus a critical case that a moderator must confirm or overturn. The author receives the statement of reasons and the appeal link at once                                                                                        |

Thresholds above are starting values. The evaluation phase replaces them with measured ones.

**Safety valves.**

- `MODERATION_AI_MODE`: `off` → `shadow` (assess and record what would have happened; no effect) → `flag`
  (queue only) → `enforce` (holds and hides allowed). The default is `off`; production moves one step at a
  time, on evidence.
- **Per-language permission:** `enforce` applies only to languages that passed the gates; others stay at
  `flag`.
- **Circuit breaker:** more than `MODERATION_MAX_AUTO_HIDES_PER_HOUR` automated hides (default 20), or an
  overturn rate above 10 % over the last 50 confirmed cases, drops the system to `flag` and raises an alert.
  A misbehaving model must not be able to empty the archive.
- **Fail open:** if the inference service is unavailable, content is published and the job retries; nothing
  is blocked on a model.
- **Routing:** `MODERATION_ROUTING` is `judge_all` (both models see everything; right at low volume and during
  shadow mode), `cascade` (the diagram above) or `screen_only`.

### Evaluation: the gate

- **Golden set.** A platform-specific set, authored in English and translated into the other eleven languages
  with native spot-checks: per language about 25 violations spread over the reasons and about 35 **hard
  negatives**, which matter more: a gene-drive proposal, a nuclear-propulsion idea, drug-policy reform,
  abolishing an institution, a harsh critique of a named theory, suicide-prevention research, a historical
  atrocity, security research. About 720 items. Violations are synthetic and mild but unambiguous; nothing
  illegal to possess is ever written down (child-safety behaviour is tested with the vendor's own category on
  non-explicit proxies and by policy routing, not with real examples). Public multilingual benchmarks are
  downloaded at evaluation time, not committed.
- **Runner.** `npm run moderation:eval -- --classifier <id> --routing <mode>` prints per language: precision
  and recall at the flag and hide levels, the hard-negative false-positive rate, a confusion table by reason,
  latency percentiles and throughput. Results are saved under `apps/api/eval/reports/`.
- **Gates** (per language; initial values):

  | Level | Requirement                                                                                    |
  | ----- | ---------------------------------------------------------------------------------------------- |
  | hide  | Precision ≥ 0.98, and **zero** hard negatives hidden                                           |
  | flag  | Recall ≥ 0.85 on critical reasons; hard-negative flag rate ≤ 5 %                               |
  | any   | No reason and no language whose flag rate is more than twice the median without an explanation |

  A language that fails the hide gate runs at `flag`. A model, quantisation, prompt or threshold change
  reruns the gate.

- **The shadow bake-off.** In shadow mode run screen, judge and, if downloaded, Shieldstral on all real
  traffic for at least two weeks. That answers with data what the papers cannot: how many judge positives the
  screen would have missed (so whether `cascade` is safe), whether Shieldstral with a written policy beats the
  4B judge on our content, and which quantisation is enough.
- **In production**, measured continuously: the share of automated hides overturned by moderators (target
  below 5 %), the share of flags that moderators uphold (below ~30 % means thresholds are too loose), time to
  action, and all of it per language.

### Privacy and law

Text is processed only by the local service; assessments hold hashes and labels, not text. Automated decisions
state that they are automated and how to appeal, which is what the EU Digital Services Act requires of a
statement of reasons; a human review is always available. Legal review remains the owner's.

## Sizing

Planning estimates for a ~300-token item on llama.cpp. **Measure before relying on them**: phase A runs
`llama-bench` on the target hardware and replaces this table.

| Hardware                         | Screen (0.6B, Q8_0) | Judge (4B, Q4_K_M) |
| -------------------------------- | ------------------- | ------------------ |
| 8 modern desktop or server cores | ≈ 1 s               | ≈ 4–5 s            |
| 4 shared cloud vCPUs             | ≈ 3 s               | ≈ 15 s             |
| Any GPU with 8 GB or more        | < 0.1 s             | < 0.3 s            |

Sustainable volume at 50 % utilisation, assuming the judge sees 10 % of items in `cascade`:

| Setup                                  | Items per day |
| -------------------------------------- | ------------- |
| 4 vCPU, 8 GB, `cascade`                | ≈ 9,000       |
| 8 cores, 16 GB, `cascade`              | ≈ 30,000      |
| 8 cores, 16 GB, `judge_all`            | ≈ 9,000       |
| One GPU with 8 GB or more, `judge_all` | > 200,000     |

Expected load, at 0.15–0.75 moderated texts per daily active user: about 200–1,100 a day at 10,000 monthly
users, 2,000–11,000 at 100,000, and 20,000–110,000 at one million. So: one small CPU machine carries the
product well past launch; a single modest GPU carries it to a million users. Because the work is asynchronous,
a spike only lengthens the queue; alert on the age of the oldest pending assessment (target under 60 s).

## Phases

| Phase | Scope                                                                                                                                                                                                           | Days |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| A     | `models/` and manifest; compose profile; benchmark; classifier interface; Qwen3Guard client (grammar, scores, chunking, hashing); `moderation_assessments`; the job on every write path; `shadow` mode; metrics | 5–6  |
| B     | Golden set in twelve languages; evaluation runner; rules classifier; `decideModeration()` with tests; first measured thresholds                                                                                 | 5–7  |
| C     | `flag` mode: cases from automated signals, assessment panel in the moderator queue, per-language reporting; shadow bake-off report                                                                              | 2–3  |
| D     | `enforce` mode: automated hides with confirmation cases and notices, holds with author visibility, circuit breaker, per-language permission                                                                     | 4–5  |
| E     | Decide routing and judge from the bake-off (4B or Shieldstral); quantisation check; operations runbook and alerts                                                                                               | 2–4  |

Production moves to `flag` after phase C and to `enforce` only after phase D **and** the gates.

## Verification

- Unit: `decideModeration()` for every row of the mapping, each tier, each mode; chunking; hash reuse; the
  output parser against malformed and adversarial outputs.
- Integration with the `fake` classifier: every write path enqueues exactly one assessment; shadow mode has no
  effect; flag opens one case per subject; enforce hides, notifies and opens the confirmation case; an expired
  hold releases and flags; the circuit breaker trips; the inference service being down blocks nothing.
- A contract test that the real client talks to a real `llama-server` runs in a separate, opt-in CI job that
  mounts the 0.6B model (too large for the default pipeline).
- The gates, recorded in a committed evaluation report.
- `npm run check`, `npm run test:pg`.

## Documentation to update

`docs/agents/architecture.md` (an ADR: automated moderation, its limits and its modes),
`docs/agents/open-questions.md` (13: the provenance rule for automated moderation),
`docs/user/content-policy.md` and `user-guide.md` (how automated screening works, in plain words; it must be
disclosed), `docs/developer/operations.md` (inference service, modes, thresholds, the runbook for a model
outage or a false-positive wave), `docs/developer/developer-guide.md` ("a new text field must be registered as
a moderation surface").

## Risks

- **False positives on exactly the content the archive exists for.** Hard negatives dominate the golden set;
  hiding needs two models and a human confirmation; the breaker limits damage.
- **Uneven quality across languages.** Enforce per language; let humans carry the languages the model is weak
  in; publish the numbers.
- **Adversarial text** (obfuscation, mixed scripts, instructions aimed at the model). Constrained output, the
  rules classifier and reports are the other lines of defence; no single layer is trusted.
- **Community conversions of weights.** Pin hashes; prefer converting from the official weights.
- **Model drift by upgrade.** A new model is a new classifier id and must pass the gate in shadow first.

## Decisions for the owner

1. Download the two recommended files (and optionally Shieldstral for the bake-off).
2. The list of reasons that may hide automatically (default: sexual content, privacy, violent threats, and
   spam from new accounts).
3. Whether new accounts' content is held for the few seconds an assessment takes (default: yes, in `enforce`).

## Sources consulted (2026-11-17)

- Qwen3Guard model cards and technical report: <https://huggingface.co/Qwen/Qwen3Guard-Gen-4B>,
  <https://huggingface.co/Qwen/Qwen3Guard-Gen-0.6B>, <https://arxiv.org/abs/2510.14276>
- Shieldstral: <https://huggingface.co/mistralai/Shieldstral-1.0-3B>, <https://mistral.ai/news/shieldstral/>,
  <https://blog.curiosity.ai/blog/2026-08-shieldstral-on-cpu>
- Surveys of open guard models: <https://github.com/mozilla-ai/any-guardrail/issues/179>,
  <https://vdf.ai/blog/open-weight-guard-models-on-premises-ai/>
- HaloGuard: <https://huggingface.co/astroware/HaloGuard1-Gen-0.8B>
- llama.cpp server images: <https://github.com/ggml-org/llama.cpp/blob/master/docs/docker.md>
