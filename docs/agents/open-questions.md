# Open questions

Each entry has the question, why it matters, and the **current default** (what the code does today). Changing a
default is fine; record the decision here and in the relevant document.

## Domain

1. **Untyped "related to" edges.** Users will sometimes know two ideas are related without knowing how.
   _Default:_ not allowed. Every edge must say how ideas connect (requires, applies, extends, …). Similarity is meant
   to come from search/embeddings. Revisit if contributors routinely mis-type relations.
2. **Correcting claims.** Claims are immutable (evidence was attached to the exact wording). Typos are annoying.
   _Default:_ no edit. Options: a short edit window for the author while no evidence or evaluations exist; or a
   `supersedes_claim_id` with evidence migration by consent.
3. **Duplicate claims and ideas.** _Default:_ nothing prevents near-duplicates. Options: semantic suggestions at
   creation time (pgvector); a moderator-driven merge that records `merged_into` and re-points links (ideas are
   never deleted).
4. **Epistemic maturity track.** _Default:_ not derived yet. The UI shows the lifecycle stage and claim statuses.
   Belongs to the scoring work.
5. **Is `learned_from` a stage or a flag?** It is reachable after `tested` or `implemented`, and a failed test is
   also "learned from". _Default:_ a stage that requires an outcome with lessons; transitions may go backwards.
6. **Community-driven stage transitions.** _Default:_ stewards and moderators only, with proof rules. Option:
   "transition proposals" endorsed by N independent reviewers.
7. **Moderators publishing revisions.** The policy lets moderators publish narrative revisions on any idea (to
   rescue abandoned or vandalised ideas). Is that overreach? _Default:_ allowed, and logged.
8. **Initiatives spanning several ideas** (a lab programme testing three ideas). _Default:_ one idea per
   initiative.
9. **Relations as claims with evidence.** "A requires B" can be evaluated for validity but cannot carry evidence.
   _Default:_ if evidence matters, state it as a claim on the idea.
10. **Topic limits and hierarchy depth.** _Default:_ 1–4 topics per idea; hierarchy of any depth, but filters include
    only direct children.
11. **Idea language and translation.** Product-language negotiation and API catalogues are implemented in
    [plan 05](production/05-localization.md). Idea content has no language field yet. [Plan 06](production/06-multilingual-content-and-search.md)
    covers content language and search. The launch locale set and release status are owner decision 2.
12. **Licensing of contributions.** Data dumps for researchers (a public good) need an explicit licence (e.g.
    CC BY-SA). _Default:_ unspecified. Decide before public launch, and record acceptance per account.
13. **AI-assisted contributions.** The concept implies AI help must be labelled and never counted as human
    judgement. _Default:_ not modelled. Add a provenance field on revisions, claims, evidence and arguments before
    shipping any AI feature.
14. **Organisation accounts** (labs, NGOs, companies, foundations). _Default:_ free-text `initiatives.organization`.

## Signals and scoring

15. **Public or private evaluations.** _Default:_ public and attributable (`GET /evaluations`), for accountability
    and research. Social pressure may bias ratings. Alternatives: pseudonymous display with public aggregates.
16. **Provisional thresholds:** `MIN_RATINGS_FOR_CONFIDENCE = 3`, neglected impact ≥ 0.6 with at-or-below-median
    attention, contested SD ≥ 0.3. These are placeholders for the scoring work.
17. **Perceived vs structured evidence.** The `evidence` dimension (human perception) coexists with structured
    evidence. _Default:_ both kept. The scoring agent decides how lenses combine them.
18. **Self-assessment.** Stewards may rate their own ideas, and authors assess their own claims. _Default:_
    allowed (it is data). Detectable via time-ranged stewardship; down-weighting is a scoring decision.

## Platform

19. **Legal erasure vs append-only history.** Triggers forbid deletes. A court-ordered erasure or GDPR request needs
    an operator procedure: in one transaction, `ALTER TABLE … DISABLE TRIGGER`, redact or delete, re-enable, and
    record a ledger entry. Not an API feature. Person erasure should normally anonymise `people` (mutable) and keep
    contributions attributed to "a former contributor". _Default:_ the procedure is documented in
    `docs/developer/operations.md` ("Legally required erasure"), recorded as `moderation.erased`. Still open: who may
    authorise it, and whether to publish a redacted notice.
20. **Rate limiting across instances.** _Default:_ in-memory, per-process limits on authentication and writes
    (ADR-17), plus account deactivation by moderators. Open: a shared limiter for multi-instance deployments, spam
    heuristics (new-account throttling, link counting), CAPTCHA on registration.
21. **Authentication breadth.** _Default:_ email + password, server-side sessions. Needed: email verification,
    password reset, OAuth and ORCID (important for scientists and for verified expertise).
22. **Concurrency on real Postgres.** _Resolved 2026-11-15:_ the suite runs on PostgreSQL 17 (`npm run test:pg`, CI
    job), which exposed real races, now fixed with advisory locks (ADR-16) and covered by
    `apps/api/test/concurrency.test.ts`. Keep running it when touching transactions.
23. **Semantic search and graph analytics.** _Default:_ Postgres FTS and recursive CTEs. pgvector fits the same
    database. A graph sidecar only if deep or global analytics are needed.
24. **Synchronous metric refresh.** Fine now; move to a queue when write volume per idea grows (architecture
    scaling notes).
25. **Code licence.** The repository has no LICENSE file yet. Choosing one (and the separate licence for
    _contributions_, question 12) is the owner's decision before publishing.
26. **Decisions the production-readiness program is waiting for.** The program proposes a default for each and
    keeps the list in one place: [`production/README.md`](production/README.md#decisions-for-the-owner). They
    include the twelve languages, the content policy and its reason codes, what automated moderation may hide,
    the registration mode, and the providers. Its plans also say which of the questions above they settle
    (11, 13, 19, 20, 21, 23, 24).
