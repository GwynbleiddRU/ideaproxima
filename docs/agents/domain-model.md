# Domain model

## What the product is (from concept.txt)

A persistent, open repository of humanity's possible futures, and a _collective memory_ of attempts to realise them.
Its unit of value is not engagement but **the progression of an idea**: imagined → developed → examined → tested →
implemented → learned from.

Principles the model must embody:

- Anyone may propose an idea; it need not be feasible, proven or accepted to deserve preservation.
- Community voting is **one** signal (what people care about). It does not determine truth, validity, feasibility
  or value.
- Ideas are evaluated along **multiple dimensions** that produce different ways of discovering ideas, not one
  "objective" ranking. Speculation with large potential must not disappear; popularity without evidence must not
  outrank rigour.
- **Preserve uncertainty** rather than hide it.
- Reputation reflects **demonstrated contribution quality** (ideas developed, useful criticism, evidence, accurate
  evaluations and predictions, domain expertise, collaboration). It is not intelligence, and it should make collective
  judgement more sensitive to demonstrated good judgement without creating a hierarchy.
- When an idea is acted on, preserve the history: who proposed, who developed, what evidence emerged, what was
  tried, what succeeded, what failed, what was learned.
- **Updated emphasis:** the platform primarily serves _scientists_ finding ideas and what they are connected to
  ("as one idea is brought to life, find its other uses by browsing connected ideas"), and _influencers/funders_
  finding ideas worth investing in. So the typed idea graph and the "who can advance this" surface are core, not
  extras.

## Concept map

```
Person ──proposes──▶ Idea ◀──stewards── Person
                      │
                      ├── Revision* (immutable narrative snapshots; proposed → accepted/rejected)
                      ├── StageTransition* (lifecycle history, proof-backed)
                      ├── IdeaClaim* ──▶ Claim (shared across ideas) ◀── Evidence* ──▶ Source | Outcome
                      │                     ▲
                      ├── Argument* ────────┘ (targets idea | claim | argument; rebuttal chains)
                      ├── Relation* ──▶ Idea (requires/applies/extends/derived_from/alternative/complements/conflicts)
                      ├── Initiative* ──▶ Outcome* (what was tried, what happened, lessons)
                      ├── Stance* (community perspective: important, worth researching, plausible, doubtful, ready now)
                      ├── Involvement* (person × capacity: offering / active / concluded)
                      ├── Comment* (threaded discussion, optionally anchored)
                      └── Topic* (taxonomy, hierarchical)

Evaluation* ──▶ exactly one of: Idea | Claim | Evidence | Argument | Relation | Comment
Activity* (ledger) ──▶ any subject, belongs to 0..n idea timelines
Derived: IdeaMetrics (ratings summaries, attention, perspectives, completeness, contestation, counts)
```

`*` = append-only facts (superseded, withdrawn, retracted or hidden; never edited or deleted).

## First-class entities, and why

| Concept              | Representation                      | Why first-class                                                                                                                                                               |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Person**           | `people` (+ `accounts`, `sessions`) | Attribution target of everything. Credentials are separate so identity survives login changes and account erasure.                                                            |
| **Topic**            | `topics` (hierarchical)             | Topic pages exist, and expertise and reputation are domain-specific.                                                                                                          |
| **Idea**             | `ideas`                             | The root of the knowledge it organises. Holds immutable identity/provenance plus projections of current content and stage.                                                    |
| **Revision**         | `idea_revisions`                    | "How did the idea change? Who contributed the development?" Full snapshots; anyone can propose, stewards decide.                                                              |
| **Steward**          | `idea_stewards` (time-ranged)       | Who may publish narrative changes. Time ranges keep "was this evaluator a steward _then_?" answerable (self-assessment detection).                                            |
| **Stage transition** | `stage_transitions`                 | Lifecycle history with rationale, proof requirements and the initiative that justified it.                                                                                    |
| **Claim**            | `claims` + `idea_claims`            | Atomic, independently assessable statements. Shared across ideas so evidence propagates. Immutable (rewording changes meaning).                                               |
| **Source**           | `sources`                           | Bibliographic facts, deduplicated by DOI/URL. One paper cited ten times is one row.                                                                                           |
| **Evidence**         | `evidence`                          | The assertion "this source/outcome bears on this claim, in this direction", with what it shows and what it does _not_ establish. Attached to claims, never to ideas directly. |
| **Argument**         | `arguments`                         | Structured reasoning for/against an idea, a claim, or another argument (rebuttals). Part of the epistemic record and assessed for strength.                                   |
| **Evaluation**       | `evaluations`                       | The raw observations behind every quality signal: person × target × dimension × time, with confidence and rationale.                                                          |
| **Stance**           | `stances`                           | Lightweight community perspective. `important` is the attention signal (the "vote"). Kept apart from evaluations.                                                             |
| **Involvement**      | `involvements`                      | "I can research / build / fund this", "I am working on it". The bridge to people who can advance ideas, and a key investor/scientist surface.                                 |
| **Relation**         | `idea_relations`                    | The typed graph. A relation is itself a claim ("A requires B"): attributed, evaluable for validity, retractable.                                                              |
| **Initiative**       | `initiatives`                       | Real-world action: research, experiment, prototype, pilot, deployment, policy, funding. Covers the concept's "experiment" and "implementation".                               |
| **Outcome**          | `outcomes`                          | What an initiative produced (success, partial, failure, inconclusive) and what was learned. Citable as evidence.                                                              |
| **Comment**          | `comments`                          | Conversation. Deliberately low-ceremony; knowledge belongs in claims, evidence and arguments.                                                                                 |
| **Activity**         | `activities`                        | Ledger of every domain action. History, contribution and moderation transparency.                                                                                             |

## Deliberately NOT first-class

| Concept                                                                       | Where it lives                                                                                                           | Why                                                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Contribution                                                                  | Derived from authored rows + the activity ledger                                                                         | A uniform "contribution" table would duplicate facts and blur their meaning. The ledger already gives one stream to score. |
| Reputation / contribution influence                                           | Future derived data (see scoring sketch)                                                                                 | Must be recomputable, versioned and auditable, never ground truth.                                                         |
| Claim status (established / supported / hypothesis / unknown / contested / …) | `deriveClaimStatus()` over evaluations                                                                                   | "Contested" _means_ assessors disagree, so it can only be derived. Typed-in statuses would be opinions stored as facts.    |
| Popularity / attention                                                        | `idea_metrics.attention` (count of current `important` stances)                                                          | Derived from stances.                                                                                                      |
| Uncertainty                                                                   | Dispersion, sample size, confidence levels, unknown/contested claims                                                     | Many signals, not one number.                                                                                              |
| Epistemic maturity                                                            | Not implemented yet. To be derived from claims and evidence                                                              | See ADR-9 and open questions.                                                                                              |
| Vote                                                                          | Stance `important`                                                                                                       | One of several perspectives.                                                                                               |
| Development stage                                                             | Stage transitions (+ `ideas.stage` projection)                                                                           | History first, current value second.                                                                                       |
| Experiment / implementation                                                   | Initiative kinds                                                                                                         | One concept with a kind keeps outcomes, evidence and lifecycle proof uniform.                                              |
| Dependency / prerequisite / consequence                                       | Relation types (`requires`, `applies`, `extends`) and claim roles (`prerequisite`, `consequence`, `risk` with depth 1–4) | Ideas that exist get typed edges; statements that are not (yet) ideas are claims.                                          |
| Discussion                                                                    | Comments                                                                                                                 | —                                                                                                                          |
| Bookmark / follow / notification                                              | Not modelled yet                                                                                                         | Personal state, not knowledge. Add when notifications are built.                                                           |
| Prediction / forecast                                                         | Not modelled yet                                                                                                         | Important for calibration-based reputation; designed in the scoring sketch.                                                |
| Organisation                                                                  | Free-text on initiatives for now                                                                                         | Organisation accounts are a roadmap item.                                                                                  |

## Narrative vs structure

An idea has two complementary representations:

- **Narrative** — Markdown sections inside each revision (`overview`, `motivation`, `mechanism`, `prerequisites`,
  `uncertainties`, `challenges`, `consequences`, `origins`), written for humans and read with progressive disclosure.
- **Structure** — claims (with roles), evidence, arguments, relations, initiatives, written for reasoning,
  evaluation and navigation.

They are connected by **claim anchors**: a Markdown link with a `claim:` scheme, e.g.
`[recognising contaminant molecules](claim:0190…)`. This degrades gracefully in any Markdown renderer and lets the
UI build "claim layers" (inline status markers that open the claim and its evidence). `parseClaimAnchors()` in the
domain package extracts them.

The `origins` section exists because **the submitter is not necessarily the originator**. Attribution to people
outside the platform (e.g. a 1980s proposal) belongs there.

## Lifecycle rules

| Stage        | Requires (enforced by `assertStageTransition`)                        |
| ------------ | --------------------------------------------------------------------- |
| imagined     | — (set on proposal)                                                   |
| developed    | steward judgement + rationale                                         |
| examined     | ≥ 1 evaluation or argument from someone who is not a current steward  |
| tested       | ≥ 1 experiment / prototype / pilot initiative with a recorded outcome |
| implemented  | ≥ 1 deployment / policy initiative that is active or completed        |
| learned_from | ≥ 1 outcome with explicit lessons                                     |

Every transition needs a rationale (≥ 10 characters). Transitions may go **backwards**: history is a record, not a
progress bar. Historical initiatives (things that happened before the platform existed) can be recorded as
completed, so real-world history can be captured.

Initiatives move forward only: planned → active → completed | discontinued. Outcomes cannot be recorded on a
planned initiative.

## Key invariants (all tested)

- One current evaluation per (person, target, dimension). One current stance per (person, idea, kind). One current
  involvement per (person, idea, capacity). One current link per (idea, claim, role). One current relation per
  (from, to, type).
- Symmetric relations are stored in canonical order, so A~B and B~A cannot both exist. No self-relations.
- Taking `plausible` retracts `doubtful` and vice versa.
- Nobody can mark their own comment or argument `useful`.
- Revisions: publishing requires the base to be the current revision (optimistic concurrency). Accepting a proposal
  requires its base to still be current. No-op revisions are rejected.
- Evidence has exactly one basis (a source or an outcome). The same source cannot be attached to the same claim twice
  while active.
- An argument has exactly one target. A comment has at most one anchor. An evaluation has exactly one target.
- Ideas are never deleted. Hidden content is invisible to non-moderators but stays in the archive.

## How the source conflicts were resolved

Priority: concept → sound domain modelling → long-term extensibility → existing implementation → UI details.

| Conflict                                  | Sources                                                                                                                                        | Resolution                                                                                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle vs "maturity"                   | Concept/MVP: imagined → … → learned from. Design: Imagined → Formulated → Theoretical → Researched → Experimental → Demonstrated → Implemented | Concept's lifecycle is the recorded stage. The design's track is epistemic and will be _derived_. The UI shows both, labelled differently.                                                                                       |
| One evidence score vs structured evidence | MVP: idea-level 1–5 "evidence" rating. Design: evidence items per idea.                                                                        | Structured evidence on **claims** (with stance and limitations), _plus_ the idea-level perceived-evidence dimension, kept as a separate human signal. The scoring agent may derive an evidence-graph score; both stay available. |
| Reactions vs ratings                      | Design: "Important / Interesting / Plausible / Needs research / I disagree / I can contribute". MVP: "I care" + 1–5 dimensions.                | Stances (important, worth_researching, plausible, doubtful, ready_now) + dimensions. "I can contribute" became Involvement (with a capacity). "Interesting" was dropped as indistinguishable from "important".                   |
| Contributions as one type                 | MVP: one `Contribution` model with kinds (comment, critique, evidence, …).                                                                     | Split into claims, evidence, arguments and comments, unified by the activity ledger.                                                                                                                                             |
| Stats stored on the idea                  | MVP: `idea.stats` overwritten on every write                                                                                                   | Derived `idea_metrics`, labelled and rebuildable.                                                                                                                                                                                |
| Hard-coded scores                         | Design: `impact: 96`, `votes: 48210`, "weighted support"                                                                                       | Not data. The UI must render real summaries with `n`, dispersion and "too early to tell".                                                                                                                                        |
| Topics                                    | MVP: 11 fixed domains. Design: 12 topics.                                                                                                      | A `topics` table seeded with the design's 12, hierarchical, admin-managed.                                                                                                                                                       |
| Who can change stage                      | MVP: author only                                                                                                                               | Stewards (time-ranged, appointable) and moderators, with proof requirements. Community-proposed transitions are an open question.                                                                                                |
| "Related ideas"                           | Design: an untyped list                                                                                                                        | Typed relations only (see open questions about an untyped edge).                                                                                                                                                                 |
