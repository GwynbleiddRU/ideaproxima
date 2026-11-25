# User guide

For everyone who uses Ideaproxima: people proposing and developing ideas, scientists and engineers looking for
ideas and what they connect to, funders looking for what to back, evaluators, and moderators. It explains what
each thing on the platform is, the exact rules it follows, and how to read the numbers it shows.

This guide describes the platform itself, so it applies to the web interface and to any other client. Where it
helps, examples show the underlying API call; see [Using the API directly](#using-the-api-directly). For where each
thing lives in the web interface, see [Finding your way](#finding-your-way).

## Contents

1. [What Ideaproxima is](#what-ideaproxima-is)
2. [Principles you will notice](#principles-you-will-notice)
3. [Finding your way](#finding-your-way)
4. [Accounts and profiles](#accounts-and-profiles)
5. [Ideas](#ideas)
6. [Revisions: how an idea's text changes](#revisions-how-an-ideas-text-changes)
7. [The lifecycle of an idea](#the-lifecycle-of-an-idea)
8. [Claims](#claims)
9. [Evidence and sources](#evidence-and-sources)
10. [Arguments](#arguments)
11. [Evaluations](#evaluations)
12. [Stances (community perspectives)](#stances-community-perspectives)
13. [Involvement: offering to help, working on it](#involvement-offering-to-help-working-on-it)
14. [Relations between ideas and the idea graph](#relations-between-ideas-and-the-idea-graph)
15. [Initiatives and outcomes](#initiatives-and-outcomes)
16. [Discovering ideas: lenses and search](#discovering-ideas-lenses-and-search)
17. [Discussion](#discussion)
18. [Reading the numbers honestly](#reading-the-numbers-honestly)
19. [Roles, moderation and transparency](#roles-moderation-and-transparency)
20. [What is public and what is private](#what-is-public-and-what-is-private)
21. [Using the API directly](#using-the-api-directly)
22. [Glossary](#glossary)

## What Ideaproxima is

A persistent, open repository of humanity's possible futures: new technologies, scientific directions, social and
political structures, economic models, biological capabilities and ways of cooperating. Its unit of value is not
engagement but the progression of an idea: **imagined → developed → examined → tested → implemented → learned
from**.

It is built so that:

- an idea need not be feasible, proven or popular to be preserved;
- scientists can see what an idea requires, what it would unlock, and which of its claims are established or open;
- funders and organisations can find ideas with real potential, credible evidence and people ready to act;
- when an idea is acted on, the history (who proposed it, who developed it, what was tried, what failed, what was
  learned) is kept.

## Principles you will notice

- **Nothing you contribute is silently overwritten or deleted.** Edits create new revisions. Changing your rating
  supersedes the old one. Withdrawn evidence stays on record with your reason. Moderation hides content; it does
  not erase it.
- **Popularity is not quality.** "Important" stances measure attention. Evaluations measure quality along separate
  dimensions. The two are never combined.
- **No single score.** Potential, feasibility, evidence and the other dimensions are always shown separately,
  each with how many people rated it and how much they disagree.
- **Uncertainty is shown, not hidden.** "Nobody has rated this" is different from a low rating. Disagreement is
  displayed as information.
- **Speculation is allowed.** An idea with enormous potential and no feasibility today is welcome.

## Finding your way

Reading never needs an account. Anything that contributes (a stance, a rating, a claim, a comment) asks you to sign in
first and brings you back to where you were.

A measure with fewer than three evaluations reads **"too early" with dots** (●○○ = one of the three it needs)
instead of a bar: there is nothing wrong with the idea, it simply has not been judged enough yet — which is where an
evaluation of yours counts most.

| Where                      | What you do there                                                                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**                   | Search; one discovery lens at a time (a featured idea and why it is there, plus runners-up); domains with their counts; four ways to help; newest ideas and the latest progress. "Surprise me" opens a random idea.                                                                                        |
| **Explore**                | One lens at a time, each saying what it measures, narrowed by words, a topic or a stage (on a phone, under **Filters**). Active filters show as removable chips.                                                                                                                                           |
| **An idea → Overview**     | The narrative in numbered sections; beside it the assessed quality (a meter per confident dimension, the rest marked "too early"), the lifecycle stage and the next proof it needs, what is known, perspectives you can tick, and the people involved. On a phone the essentials appear under the summary. |
| **Claims & evidence**      | An overview of all claims by status, then each claim grouped by role with its derived status and evidence balance; open its evidence, attach evidence, or assess it.                                                                                                                                       |
| **Discussion**             | Arguments for and against side by side (qualifications below), with responses; and an open comment thread for questions and suggestions.                                                                                                                                                                   |
| **Connections**            | A map of what the idea needs (left) and what it enables (right), and every typed connection; "Connect to another idea" adds one. Phones show the list.                                                                                                                                                     |
| **In practice**            | Who is involved and in what capacity, and every initiative with its outcomes, failures and lessons included.                                                                                                                                                                                               |
| **History**                | Stage changes, every revision with its changes highlighted, proposals awaiting a steward, and the timeline by day, filterable by kind of action.                                                                                                                                                           |
| **Propose an idea**        | Title, a short summary and a topic are required; each optional section says what it is for and shows whether it is written. A preview shows how the idea will appear in lists. Drafts are kept in your browser.                                                                                            |
| **Activity**               | The public ledger by day, filterable by kind of action; repeated actions ("6 people marked … important") are folded into one line. "Moderation log" shows every moderation action and its reason.                                                                                                          |
| **Your profile / Account** | What you can help with, your non-zero contribution counts, and tabs for your ideas, involvements and activity; your name, affiliation, capacities, expertise and password.                                                                                                                                 |

The theme follows your system by default; the footer switches between light, dark and system.

## Accounts and profiles

| Field             | Rules                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Handle            | 3–32 characters: lowercase letters, digits and single hyphens, starting and ending with a letter or digit. Unique, appears in your profile URL. |
| Display name      | 2–80 characters.                                                                                                                                |
| Email             | Unique. Used only to sign in, never shown publicly.                                                                                             |
| Password          | At least 10 characters.                                                                                                                         |
| Bio / affiliation | Up to 2,000 / 200 characters.                                                                                                                   |
| Capacities        | Ways you can advance ideas: research, engineering, funding, entrepreneurship, policy, organizing, communication.                                |

- **Sessions** last 30 days by default. Signing out revokes the session. Changing your password signs out every
  other session.
- **Expertise**: you may declare expertise in a topic. It is recorded as _self-declared_ with a date. Verified
  expertise (e.g. through ORCID) is planned, and the two kinds will always be shown separately.
- **Your profile** shows your expertise, plain counts of your recorded contributions (ideas proposed, accepted
  revisions, claims, evidence, arguments, evaluations, comments, initiatives, "useful" marks received), your ideas
  and your involvements. Counts are not a quality measure. _Contribution influence_, a measure of demonstrated
  contribution quality, is planned. It will be clearly labelled, and it is not a measure of intelligence.

## Ideas

To propose an idea you need a **title** (5–160 characters), a **summary** (20–600 characters) and **1–4 topics**
(the first is the primary topic). You may add up to 12 **tags** (each up to 40 characters, stored lowercase) and
any of eight narrative **sections** (each up to 20,000 characters of Markdown):

| Section                                          | Answers                                                       |
| ------------------------------------------------ | ------------------------------------------------------------- |
| The idea (`overview`)                            | What exactly is proposed?                                     |
| Why it could matter (`motivation`)               | What would this make possible?                                |
| How it might work (`mechanism`)                  | How might it work?                                            |
| What would need to exist first (`prerequisites`) | What technologies, resources or conditions does it depend on? |
| What we don't know (`uncertainties`)             | What is still unknown, and how could one find out?            |
| Challenges & counterarguments (`challenges`)     | What could go wrong? What is the strongest case against?      |
| What it could enable (`consequences`)            | What could it lead to?                                        |
| Origins & prior art (`origins`)                  | Where does the idea come from?                                |

Use **Origins & prior art** to credit people. _The person who submits an idea is not necessarily its originator_,
and an idea first described in a 1986 book should say so.

Proposing an idea records, at the same moment: the idea, its first revision, you as its **originator** (a kind of
steward), and its entry into the lifecycle at **imagined**. Each idea gets a readable address (its **slug**, e.g.
`water-cleaning-nanorobots`). Identical titles get `-2`, `-3`, ….

**Topics**: the base topics are Technology, Science, Biology, Medicine, Environment, Energy, Space, Governance,
Society, Economics, Education and Humanity. Admins can add sub-topics. Filtering by a topic includes its direct
sub-topics.

**Stewards** maintain an idea's narrative: they publish revisions directly and accept or reject proposals. The
originator is the first steward and can appoint co-stewards.

## Revisions: how an idea's text changes

Every change to an idea's title, summary, sections, topics or tags is a new **revision**: a complete, immutable
snapshot with an author, a date and a change note (3–500 characters).

- **Stewards publish** directly. **Everyone else proposes**, and a steward accepts or rejects (optionally with a
  note). The accepted proposal's author is credited as the author of that version.
- **No lost edits.** A revision names the version it started from. If someone else published in the meantime,
  publishing is refused with a conflict: start again from the newer version. A proposal can only be accepted while
  the version it was based on is still current.
- A revision that changes nothing is refused.
- You can withdraw your own pending proposal.
- The full history (who wrote each version, who decided, and every past text) stays readable forever.

### Linking prose to claims

Inside sections, you can anchor a phrase to a structured [claim](#claims) with a Markdown link whose address is
`claim:` followed by the claim's id:

```markdown
Swarms could [recognise individual contaminant molecules](claim:0190f5c2-1234-7abc-8def-0123456789ab) and bind them.
```

Clients can then show that claim's current status and evidence inline. Any other Markdown renderer simply shows a
link.

## The lifecycle of an idea

The **stage** records what has been _done_ with an idea. It is not a measure of how true the idea is: the
epistemic state is shown separately, through claims and evidence.

| Stage        | Meaning                                                                    | Required before moving here                                                         |
| ------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Imagined     | Proposed and preserved.                                                    | Set automatically on proposal.                                                      |
| Developed    | Mechanism, prerequisites, consequences and uncertainties are written down. | A steward's judgement.                                                              |
| Examined     | Independently evaluated and challenged.                                    | At least one evaluation or argument from someone who is **not** a steward.          |
| Tested       | An experiment, prototype or pilot was carried out.                         | At least one experiment, prototype or pilot initiative **with a recorded outcome**. |
| Implemented  | Deployed or enacted in the real world.                                     | At least one deployment or policy initiative that is **active or completed**.       |
| Learned from | Outcomes were recorded with lessons.                                       | At least one outcome **with explicit lessons**.                                     |

- Stewards (or moderators) record transitions, each with a **rationale of at least 10 characters**.
- Transitions may go **backwards**, e.g. when an implementation is withdrawn. The history is a record, not a
  progress bar.
- Every idea shows which requirements are met, so you can see what is missing for the next stage.

## Claims

A **claim** is a single statement that can be independently supported or challenged ("Engineered binding sites
can selectively recognise specific contaminant molecules"). Claims are 10–600 characters and can't be edited:
rewording changes meaning, and evidence was attached to the exact wording. To correct a claim, state a new one.

**Claims are shared between ideas.** When you add a claim to an idea you can link an _existing_ claim instead of
writing a new one. Evidence attached to that claim then informs every idea that relies on it.

Within an idea, a claim plays a **role**:

| Role         | Meaning                                                |
| ------------ | ------------------------------------------------------ |
| Premise      | Something the idea assumes to be true.                 |
| Mechanism    | A step in how the idea would work.                     |
| Prerequisite | Something that must exist or be possible first.        |
| Consequence  | Something that would follow if the idea were realised. |
| Risk         | A possible harmful or unwanted consequence.            |

Consequences and risks can carry a **depth** for the consequence tree: 1 immediate, 2 second-order, 3 new
capability, 4 civilizational.

### Claim status is derived, never typed in

Nobody, not even the author, sets a claim's status. It is computed from people's assessments of the claim on two
dimensions: **evidential support** (1 refuted, 2 doubtful, 3 unknown/untested, 4 supported, 5 established) and
optionally **plausibility**. When you add a claim you may include your own assessment, which counts as one
evaluation among others.

| Status      | Rule (current algorithm `baseline-v0`)                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| Unassessed  | Nobody has assessed its support yet.                                                      |
| Contested   | At least 3 assessments and a normalised spread of 0.3 or more: people seriously disagree. |
| Established | Mean support ≥ 4.5.                                                                       |
| Supported   | Mean support ≥ 3.5.                                                                       |
| Hypothesis  | Mean support ≥ 2.5 and mean plausibility ≥ 3.5: reasoned, but untested.                   |
| Unknown     | Mean support ≥ 2.5 otherwise: nobody knows.                                               |
| Doubtful    | Mean support ≥ 1.5.                                                                       |
| Refuted     | Mean support below 1.5. Refuted claims stay visible, because failures are knowledge.      |

## Evidence and sources

**Evidence** is your assertion that something bears on a claim, in a direction:

- **Stance**: _supports_, _challenges_ or _mixed_.
- **Summary** (10–2,000 characters): what it shows about the claim.
- **Limitations** (optional, up to 2,000): **what it does not establish**. Please fill this in; it is what makes
  evidence trustworthy.
- **Locator** (optional): page, figure, table or section.
- **Basis**, exactly one of: an existing **source**; a new source (registered on the spot); or an **outcome**
  recorded on the platform (a failed pilot is evidence too).

**Sources** (papers, preprints, books, reports, datasets, patents, standards, theses, web pages, news, expert
statements) are deduplicated: registering a source with a DOI (or URL) that already exists returns the existing
one. DOIs are normalised, so `https://doi.org/10.1000/ABC` and `doi:10.1000/abc` are the same source. A source can
be attached to a given claim only once while active.

Others assess each piece of evidence for **quality** (methodological reliability) and **relevance** (how directly
it bears on the claim). You can **withdraw** your own evidence with a reason. It stays on record, but stops
counting.

## Arguments

An **argument** is structured reasoning about an idea, a claim, or another argument (a rebuttal):

- **Stance**: _supports_, _opposes_ (critique, counterargument, rebuttal) or _qualifies_ (accepts with caveats).
- **Title** 5–200 characters, **body** 20–10,000 characters.

Others rate an argument's **strength** (whether or not they agree with it) and can mark it **useful**. You can't
mark your own argument useful. You can withdraw your own argument.

## Evaluations

An **evaluation** is your rating of something on one or more **dimensions**, each on its own scale. Ratings are
optional per dimension. **If you don't know, leave the dimension out**: "I don't know" is never counted as a low
or middle rating.

| Dimension                    | Applies to          | Question                                                    | Scale (1 → 5)                    |
| ---------------------------- | ------------------- | ----------------------------------------------------------- | -------------------------------- |
| Potential impact             | ideas               | If realised, how much would it change what humanity can do? | Marginal → Civilization-scale    |
| Feasibility                  | ideas               | How achievable with foreseeable means?                      | Not foreseeable → Possible today |
| Scientific / logical support | ideas, claims       | How sound is the reasoning?                                 | Unsound → Compelling             |
| Evidence                     | ideas               | How strong is the available evidence?                       | None → Conclusive                |
| Novelty                      | ideas               | How new compared to existing ideas?                         | Well known → Unprecedented       |
| Development                  | ideas               | How thoroughly worked out?                                  | Sketch → Comprehensive           |
| Evidential support           | claims              | Where does the claim stand given the evidence?              | Refuted → Established            |
| Evidence quality             | evidence            | How reliable is it methodologically?                        | Unreliable → Rigorous            |
| Relevance                    | evidence            | How directly does it bear on the claim?                     | Tangential → Decisive            |
| Argument strength            | arguments           | How strong, regardless of agreement?                        | Fallacious → Decisive            |
| Relationship validity        | relations           | Is this relationship accurate?                              | Wrong → Obviously accurate       |
| Useful                       | comments, arguments | Did this move the discussion forward?                       | yes only                         |

You can attach a **confidence** (low, medium, high) to each rating, and a **rationale** (up to 4,000 characters)
to a submission.

- **Re-rating supersedes**: your previous rating stays in the history, marked superseded. Repeating the same rating
  changes nothing.
- **Withdrawing** a rating removes it from the current picture but keeps it in the history.
- Evaluations are **public and attributable**: anyone can read the raw ratings (including past ones) behind every
  summary. This keeps judgements accountable and lets researchers study how opinion changes.

## Stances (community perspectives)

A **stance** is a lightweight perspective on an idea:

| Stance            | Means                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Important         | I think this matters. This is the **attention** signal (the "vote"). |
| Worth researching | This deserves serious research effort.                               |
| Plausible         | I think this could work.                                             |
| Doubtful          | I doubt this could work.                                             |
| Ready today       | This could be pursued with today's means.                            |

Taking a stance is idempotent: doing it twice changes nothing. Taking _plausible_ removes _doubtful_ and vice
versa. Retracting keeps the history. Ideas show each stance as a share of the people who took any stance on that
idea: _community judgements, not objective truth._

## Involvement: offering to help, working on it

Declare how you are involved with an idea in a **capacity** (research, engineering, funding, entrepreneurship,
policy, organizing, communication) with a **status**:

- **Offering**: willing and able to contribute.
- **Active**: currently working on it.
- **Concluded**: previously involved (kept for attribution).

Each idea lists who offers or works on it in which capacity. This is how ideas connect with the scientists,
engineers and funders who can advance them. Changes of status are kept as history.

## Relations between ideas and the idea graph

Ideas connect through **typed relations**. Every relation says _how_ two ideas connect:

| Relation       | Read as                               | Direction     |
| -------------- | ------------------------------------- | ------------- |
| requires       | A cannot be realised without B        | A builds on B |
| applies        | A is a specific application of B      | A builds on B |
| extends        | A builds on, refines or generalises B | A builds on B |
| derived from   | A originated as a variant of B        | A builds on B |
| alternative to | different approaches to the same goal | symmetric     |
| complements    | stronger in combination               | symmetric     |
| conflicts with | mutually incompatible                 | symmetric     |

There is no untyped "related to" link. An idea can't relate to itself, and the same relation can't exist twice
(for symmetric types, A–B and B–A are the same). Others rate a relation's **validity**. The proposer, stewards of
either idea, or moderators can retract it.

**Traversing the graph** answers the questions scientists and funders actually ask:

- **Downstream: "If this is realised, what does it unlock?"** Every idea that builds on it (requires, applies,
  extends, derived from), up to 4 steps away.
- **Upstream: "What must exist first?"** Everything it builds on.
- **Both:** the whole neighbourhood across all relation types.

## Initiatives and outcomes

An **initiative** is real-world action on an idea: research, experiment, prototype, pilot, deployment, policy,
funding, or other. It has a title (5–200), a description (20–10,000), and optionally an organisation, a URL and
start/end dates.

- **Status** moves forward only: planned → active → completed, or planned/active → discontinued. Completed and
  discontinued are final (start a new initiative instead).
- **Historical initiatives** (things that happened before the platform existed) can be recorded directly as
  completed.
- An **outcome** records what an initiative produced: _succeeded_, _partially succeeded_, _failed_ or
  _inconclusive_, with a summary and, ideally, **lessons**. Planned initiatives cannot have outcomes yet.
  Outcomes are permanent and can be cited as evidence on claims. Failures are recorded with the same care as
  successes.
- The initiative's creator, the idea's stewards and moderators manage status and outcomes.

## Discovering ideas: lenses and search

Ideas are discovered through **lenses**, each measuring something different and saying so. Filters (topic,
stage, tag, text query) combine with any lens.

| Lens              | What it ranks by (current rules)                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Newest            | Most recently proposed.                                                                                         |
| Most supported    | Number of people marking the idea _important_. Popularity, not quality, not truth.                              |
| Emerging          | New _important_ stances in the last 30 days.                                                                    |
| Best evidenced    | Assessed evidence strength (ideas with at least one rating), regardless of popularity.                          |
| Highest potential | Assessed potential impact, regardless of feasibility. Moonshots belong here.                                    |
| Most feasible     | Assessed feasibility.                                                                                           |
| Most developed    | Share of narrative sections written, then number of claims.                                                     |
| Neglected         | Assessed potential of at least 0.6 on the 0–1 scale (mean ≥ 3.4 of 5) **and** attention at or below the median. |
| Contested         | Widest disagreement among evaluators (dimensions with at least 3 ratings).                                      |
| Needs review      | Fewer than 3 independent evaluators.                                                                            |
| In practice       | Tested, implemented or learned from, most recent first.                                                         |

**Search** looks across ideas (title and summary), claims, sources and people at once, with English word
stemming ("nanorobots" finds "nanorobot").

## Discussion

**Comments** are threaded conversation on an idea, of three kinds: comment, question, suggestion (2–10,000
characters). A comment can reply to another and can be anchored to a claim, a piece of evidence or an argument.
Comments cannot be edited, which keeps conversations honest. Anything that should count as knowledge (a critique,
a source, a counterargument) belongs in an argument, evidence or claim, where others can assess it.

## Reading the numbers honestly

- Every number shown for an idea is **derived** and names the algorithm that produced it (currently
  `baseline-v0`, a deliberately simple baseline). It can be recomputed from the recorded facts at any time.
- A rating summary has a **value** (0–1, for meters), a **mean** (on the 1–5 scale), a **dispersion** (0 =
  everyone agrees, 0.5 = evenly split between the extremes) and **n**, the number of current ratings. **Below 3
  ratings, treat it as too early to tell.**
- **Attention** counts _important_ stances only. It says what people care about, nothing about quality.
- **Contestation** is the widest disagreement among dimensions rated by at least 3 people.
- **Completeness** is the share of the eight sections written with at least 80 characters.
- Everyone's rating currently counts equally. Weighting by demonstrated contribution quality is planned. When
  it arrives, raw and weighted values will be shown side by side.

## Roles, moderation and transparency

| Role      | Can                                                                                                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member    | Propose ideas, propose revisions, contribute claims, evidence, arguments, relations, initiatives and comments, evaluate, take stances, declare involvement. Within ideas they steward: publish revisions, decide proposals, appoint co-stewards, record stage transitions. |
| Moderator | Everything a member can, plus: act as a steward of any idea, hide and restore content, deactivate and reactivate **member** accounts.                                                                                                                                      |
| Admin     | Everything a moderator can, plus: manage topics, change roles, deactivate any account (except their own).                                                                                                                                                                  |

- **Hiding** content (ideas, claims, evidence, arguments, comments, initiatives) makes it invisible to everyone
  except moderators. It is never deleted. Hidden comments keep their place in threads with their text removed.
- **Deactivating** an account ends its sessions and prevents signing in. Everything the person contributed stays
  in the archive, attributed to them.
- **Every moderation action is public**, with its reason, in the moderation log (the activity feed filtered to
  `moderation.`). Role changes are public too.
- Moderators keep the archive usable. They do not decide what is true.

## What is public and what is private

- **Public:** your handle, display name, bio, affiliation, capacities, expertise, everything you contribute
  (ideas, revisions, claims, evidence, arguments, comments, relations, initiatives, outcomes), your evaluations
  and stances (including past ones), your involvements, and your activity history.
- **Private:** your email address and password, and your sessions. Password changes are not published.
- **Abuse protection:** sign-in and registration attempts are rate-limited per network address, and writes are
  rate-limited per account. Too many requests return _rate_limited_ with a time to wait.

## Display language

Open the language picker in the header or account settings, choose a language, and apply it. The choice stays
on this device and is also saved to your account when you are signed in. Use a URL such as `/explore?hl=ar`
to preview a language on that page. Beta languages fall back to English where interface text is still being
translated. Ideas and other contributions remain in the language their authors used.

## Using the API directly

Researchers and integrators can use the API without any interface. The base path is `/v1`. The complete list of
endpoints with every field is the [API reference](../developer/api-reference.md).

Use `GET /v1/locales` to find supported product languages. To preview one, add `?locale=ru` to vocabulary or
topic requests, or send an `Accept-Language` header. Accounts can save a preference through `PATCH /v1/me`.
Available translations appear in the requested language. Vocabulary and errors use English for missing
translations. Topics use their canonical text. The API leaves contributions in the language their authors used.

```bash
# Discover: the most neglected ideas in environment
curl "http://localhost:3000/v1/ideas?lens=neglected&topic=environment"

# Sign in (returns a token; browsers get an HttpOnly cookie instead)
curl -X POST http://localhost:3000/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"you@example.org","password":"your password"}'

# Propose an idea
curl -X POST http://localhost:3000/v1/ideas \
  -H "content-type: application/json" -H "authorization: Bearer $TOKEN" \
  -d '{"title":"Open global registry of failed experiments","summary":"Researchers publish null and negative results so nobody repeats what did not work.","topics":["science"]}'

# What would realising an idea unlock?
curl "http://localhost:3000/v1/ideas/molecular-manufacturing/graph?direction=downstream&depth=3"

# The raw ratings behind a summary, including superseded ones
curl "http://localhost:3000/v1/evaluations?targetKind=idea&targetId=$IDEA_ID&history=all"
```

## Glossary

- **Activity ledger**: the append-only record of every action, by whom and when. Idea timelines, profiles and the
  moderation log are views of it.
- **Algorithm label**: the name of the procedure that produced a derived number (e.g. `baseline-v0`).
- **Attention**: the count of _important_ stances. Popularity only.
- **Claim**: an atomic, assessable statement; shared across ideas.
- **Derived value**: anything computed from recorded facts; disposable and recomputable.
- **Dimension**: one independent axis of evaluation (impact, feasibility, …).
- **Evidence**: an assertion that a source or outcome bears on a claim, with a stance and limitations.
- **Fact**: something that happened or was recorded; never rewritten.
- **Initiative / outcome**: real-world action on an idea, and what it produced.
- **Lens**: a way of ordering ideas that states what it measures.
- **Revision**: an immutable snapshot of an idea's text.
- **Stance**: a lightweight community perspective (important, worth researching, plausible, doubtful, ready today).
- **Steward**: someone who maintains an idea's narrative.
- **Supersede**: replace a current rating/stance/involvement with a newer one while keeping the old one in history.
