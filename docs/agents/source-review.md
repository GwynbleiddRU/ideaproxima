# Review of the source material

Three inputs existed before this foundation: `concept.txt`, the `seedbank-mvp` prototype and the
`humanitys-future-archive` UI exploration. This records what each contributed and what was deliberately not
carried forward. Both prototypes were **removed from this repository on 2026-11-15** to keep it clean for
publication. The seedbank MVP is archived by the owner outside the repository; the design exploration lives in
its own Lovable/GitHub repository. Everything of value is captured in this document, `domain-model.md` and
`front-rebuild-prompt-sketch.md`.

## concept.txt

The authority. The final paragraph (added most recently) sharpened the audience: the platform serves **scientists**
discovering ideas and their connections ("as one idea is brought to life, they can instantly find other uses of it
by browsing connected ideas") and **influencers/funders** finding ideas worth investing in, more than people who
only want to dream. This promoted the idea graph (typed relations, upstream/downstream traversal) and involvements
(who can research, build or fund) from "later" to the core model.

## seedbank-mvp (Next.js 15 + MongoDB/Mongoose, server actions)

**Good instincts, preserved in spirit**

- "Interest" (popularity) stored apart from evaluations → became stances vs evaluations (ADR-10).
- Optional dimensions where "I don't know" is not a zero → preserved (`validateRatings`: omission, never 0).
- Mean _and_ spread, "too early to tell" under 3 ratings, contestation as a lens → preserved in `baseline-v0` with
  the same formulas (weighted mean, weighted population SD, widest spread among confident dimensions) and tests.
- Section completeness (≥ 80 chars per section) → `sectionCompleteness`.
- Discovery lenses instead of one ranking → kept and extended (11 lenses, each with an honest description).
- `evaluatorWeight()` returning 1 as _the_ reputation hook → became the injectable `WeightPolicy`.
- One vocabulary file (`config.ts`) → became `packages/domain` with DB CHECKs generated from it.
- A service layer shared by pages and a JSON API → became module services behind a standalone API.

**Weaknesses, replaced**

- Ideas were mutable documents: edits overwrote content; the only history was an embedded stage array. Replaced by
  immutable revision snapshots and stage transitions.
- Aggregates were overwritten on the idea document (`idea.stats`) as if they were facts. Replaced by a derived,
  labelled, rebuildable `idea_metrics`.
- Evidence was a contribution _kind_ with an optional URL, with no link to what it supports, no stance and no
  source identity. Replaced by sources → evidence → claims, with stance and limitations.
- Evaluations were upserted in place (`findOneAndUpdate`): the history of opinion was lost. Replaced by append-only
  evaluations with supersession.
- "Helpful" marks were an array on the contribution, mutable, with no time. Replaced by `useful` evaluations.
- Only the author could edit or move stages; no co-development, no stewardship. Replaced by proposals, stewards and
  proof-backed transitions.
- No relations between ideas, no claims, no initiatives or outcomes. Added.
- MongoDB could not enforce referential integrity, partial uniqueness or immutability. Replaced by Postgres
  (ADR-1).
- Stateless 30-day JWT sessions could not be revoked. Replaced by server-side sessions.
- Never run against a live database, no tests. Now the suite (100+ tests, contract-checked) runs on PGlite and on
  PostgreSQL 17.

## humanitys-future-archive (Lovable design exploration; TanStack Start, Tailwind v4, shadcn)

**Strong, carry forward** (details in `front-rebuild-prompt-sketch.md`): the "future knowledge institution"
identity with tuned light and dark themes; the idea-page hierarchy (epistemic summary → stage → numbered narrative
sections); claim layers; the evidence drawer with "what it does NOT establish" (now a real field,
`evidence.limitations`); the consequence tree (now claim role `consequence`/`risk` with depth 1–4); the constellation;
the neglected page; community perspectives as labelled judgements; "contribution influence is not intelligence";
the progressive creation prompts (now `IDEA_SECTION_INFO[*].prompt`); the topic taxonomy (seeded as base topics).

**Not carried forward:** all numbers were hard-coded (impact 96, 48,210 votes, weighted support, influence 91/94/…);
evidence items were generated per idea with fictional organisations; rankings were client-side formulas; one
"maturity" track mixed lifecycle and epistemic state; claim status was typed into text; related ideas were an
untyped list; each idea had one topic; reactions and bookmarks lived in localStorage; `/create`, `/profile`,
`/search` and `/about` were linked from the navigation but never built.
