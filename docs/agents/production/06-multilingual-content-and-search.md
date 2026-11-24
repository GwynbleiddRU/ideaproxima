# 06 — Multilingual content and search

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/06-multilingual-content-and-search-prompt.md`.

| Status     | Not started                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [05](05-localization.md) A–C2 (the locale list, `packages/i18n`, the web runtime); phase B also [07](07-moderation-core.md) A (`setVisibility()`) |
| Unblocks   | Language routing in [07](07-moderation-core.md) and [08](08-ai-moderation.md); [11](11-semantic-search.md)                                        |
| Size       | 3 sessions (steps 15, 17, 18) · 11–15 engineer-days                                                                                               |

## Outcome

An idea written in Russian, Chinese or Arabic gets a readable URL, is found by a search in its own language
with the inflections and word boundaries that language needs, declares what language it is in, and can be
filtered by it, with no PostgreSQL extension ([audit](api-audit.md): I18N-1, I18N-2, I18N-3, I18N-6,
PERF-4; open question 11).

## Design

### 1. Content has a language

Record canonical BCP 47 tags (`ru`, `ja`; Chinese can include its script: `zh-Hans`,
`zh-Hant`), with `und` for "not determined":

| Content                                                      | Where the language comes from                                                                                               | Stored                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Idea narrative                                               | **Declared** by the author; the editor preselects the interface language and suggests a correction when detection disagrees | `IdeaContent.language` in the revision (a fact) and the projection `ideas.language` |
| Claims, evidence, arguments, comments, initiatives, outcomes | Sent by the client if known, otherwise **detected** at write time, otherwise inherited from the idea, otherwise `und`       | A `language` column on each table, written once at insert                           |

- The new columns are not in any guard's list of changeable columns, so the history guards make them
  immutable: "the language recorded when this was written" is itself a fact. Existing rows get `und` from the
  column default. Changing an idea's language is a revision, with history, like any other content change.
- Any well-formed tag is accepted and stored. The twelve product languages are "first-class" (dedicated search
  analysis, moderation evaluation); every other language is indexed with the generic analyser.
- **Detection** (`modules/search/language.ts`), in this order: script rules first (Hangul → `ko`; Kana → `ja`;
  Han alone can be Chinese or Japanese and does not identify Simplified Chinese; Devanagari is shared by
  multiple languages), then a statistical
  detector restricted to plausible candidates. Below 20 characters or below the confidence threshold, do not
  guess: inherit or return `und`. The detector is a pure JavaScript or WASM library with no native build
  (candidates on npm: `eld`, `tinyld`, `franc`); choose it by accuracy on a fixture of short and long texts in
  the twelve languages that is committed with the tests.
- Contract: `language` on idea DTOs and on every text contribution DTO; an optional `language` in create
  requests; `GET /v1/ideas?language=ru,en` (no default: the API returns all languages unless asked).
- The web app defaults lenses to the reader's content languages (interface language plus English; editable in
  account settings as `preferences.contentLanguages`) with a visible, one-click "all languages" control. The
  archive is one graph: relations and shared claims cross languages, so languages are a filter, never a wall.

### 2. Slugs that keep the title's script

`slugify()` in `packages/domain/src/rules/content.ts`:

1. Normalise (NFKC), lower-case.
2. For Latin letters only: strip diacritics and expand `ß → ss`, `æ → ae`, `ø → o`, `đ → d`, `ł → l`.
3. Keep letters, combining marks and digits of every script (`\p{L}\p{M}\p{N}`); marks matter, because
   Devanagari and Arabic words are unreadable without them. Collapse everything else to `-`.
4. Truncate to 80 grapheme clusters (`Intl.Segmenter`), never mid-cluster; trim hyphens; fall back to `idea`
   only when nothing is left.

Today's `idea`, `idea-2` and `stra-enbahn-fur-…` become `водородные-двигатели-для-дальних-полётов`,
`利用纳米机器人清除血液中的污染物` and `strassenbahn-fur-guterverkehr-uber-nacht`. There is no language-specific
transliteration (German `ü` becomes `u`, not `ue`): one rule for all Latin-script languages.

- Uniqueness without the O(n) scan: under the existing advisory lock, test the base and `-2` … `-5` in one
  indexed query; if all are taken, append six base-36 characters derived from the new idea's id.
- `findIdea()` normalises the incoming reference the same way (browsers send percent-encoded UTF-8, some in
  decomposed form).
- Existing slugs never change: a published URL is permanent.
- Topic slugs and handles stay ASCII: they are identifiers chosen by admins and members, and Unicode there
  invites look-alike impersonation.
- No transliteration to Latin: it is lossy, needs dictionaries for Chinese and Japanese, and readers expect
  their own script. Because percent-encoded URLs are ugly when pasted, the web app adds a "copy short link"
  that uses the idea's id, which the API already accepts in place of the slug.

### 3. A derived search index

Search needs things fact tables cannot hold: a language-specific analysis, pre-segmented text for languages
without spaces, and the freedom to re-analyse everything when the analyser improves. So search gets its own
**derived table**, written only by `modules/search` and rebuildable from facts, exactly like `idea_metrics` is
for metrics.

```sql
create table search_documents (
  subject_kind text not null,          -- idea | claim | argument | source | person
  subject_id   uuid not null,
  language     text not null,          -- language the analysis used ('und' = generic)
  tsv          tsvector not null,      -- language-specific: title weight A, body weight B
  tsv_simple   tsvector not null,      -- 'simple' configuration over folded, segmented text
  visible      boolean not null default true,
  sort_at      timestamptz not null,   -- the subject's creation time, for tie-breaking
  analyzer     text not null,          -- version label, e.g. 'fts-v1'
  indexed_at   timestamptz not null default now(),
  primary key (subject_kind, subject_id)
);
create index search_documents_tsv_idx        on search_documents using gin (tsv);
create index search_documents_tsv_simple_idx on search_documents using gin (tsv_simple);
create index search_documents_filter_idx     on search_documents (subject_kind, language) where visible;
```

The generated columns `ideas.search` and `claims.search` and their indexes are dropped once the new index
serves all queries.

**Analysis per language** (`modules/search/analysis.ts`; PostgreSQL configurations verified present on
version 17):

| Language                 | `tsv` configuration                      | Text preparation before indexing and querying                                      |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `en`                     | `english`                                | —                                                                                  |
| `es` `pt` `fr` `de`      | `spanish` `portuguese` `french` `german` | —                                                                                  |
| `id`                     | `indonesian`                             | —                                                                                  |
| `ru`                     | `russian`                                | `ё → е`                                                                            |
| `ar`                     | `arabic`                                 | Remove tatweel and short-vowel marks; unify alef and ya variants                   |
| `hi`                     | `hindi`                                  | Normalise nukta forms                                                              |
| `zh-Hans` `zh-Hant` `ja` | `simple`                                 | Word segmentation with `Intl.Segmenter` (ICU dictionaries), plus character bigrams |
| `ko`                     | `simple`                                 | Space-delimited words, plus bigrams inside each word (particles attach to nouns)   |
| anything else, `und`     | `simple`                                 | Unicode word boundaries                                                            |

`tsv_simple` is built for every document from the same text after case folding and, for Latin script, accent
folding. It is the cross-language safety net: exact word forms, names, technical terms, prefix matching, and
queries typed without accents (`energia` finds `energía`).

`Intl.Segmenter` was checked on Node 24 with full ICU: it segments Chinese and Japanese into words. The
production image (`node:22-alpine` today) was not checked and must have the same data: add a start-up self-test that segments a known Chinese sentence and
fails readiness if the result is one token.

**Querying.** The language of a short query is unknowable, but its script is not:

1. Detect the scripts in the query.
2. Build one `tsquery` per plausible analyser: Cyrillic → `russian`; Arabic → `arabic`; Devanagari → `hindi`;
   Han or Kana → segmented `simple`; Hangul → `simple` with bigrams; Latin → the reader's interface language if
   it is a Latin-script language, plus `english`.
3. Always add the `simple` query against `tsv_simple`.
4. Match `tsv @@ (q₁ || q₂ …) or tsv_simple @@ q_simple`; rank language matches above `simple` matches
   (`ts_rank_cd` weighted 1.0 and 0.5), then by `sort_at`.

Use `websearch_to_tsquery` so quotes and `-term` keep working. People are matched by prefix
(`to_tsquery('simple', 'term:*')`) on handle and display name; sources by title, with an exact match on DOI.
That removes both `ILIKE '%…%'` scans (PERF-4) without needing `pg_trgm`.

**Maintenance.** `search.index(tx, subject)` runs inside the transaction of every write that creates or changes
searchable text or visibility (propose, publish or accept a revision; state a claim; make an argument; register
a source; register or update a profile; hide, restore, redact, hold, release — all of which go through
`setVisibility()` of [07](07-moderation-core.md), in place since step 16). It is one upsert and microseconds of
segmentation, so it stays synchronous and search reflects a write immediately. `npm run search:rebuild`
(`dist/rebuild-search.js`) reindexes everything; a nightly job reindexes a sample and reports drift, like
`metrics.reconcile`.

**Endpoints.** `GET /v1/search` gains `kind` (to page one kind), `language`, and cursor pagination per kind;
`GET /v1/ideas?q=` joins the index instead of the generated column. Both keep their response shapes apart from
the additions.

Extension-free on purpose: it works identically on PGlite, the compose PostgreSQL and any managed service.
`pg_trgm`, PGroonga or `zhparser` would search some languages better and can replace an analyser later without
changing the table or the API, because the analyser is versioned and the index is rebuildable.

### 4. Limits that are fair across scripts

Maximum lengths stay as they are (generous, measured in UTF-16 units). **Minimums** switch to a weighted
length in which Han, Kana and Hangul characters count double, so "summary ≥ 20" asks for ten characters of
Chinese rather than twenty. One function in the domain package, used by the request schemas through a shared
refinement.

### 5. Database locale

Case-insensitive behaviour must not depend on how the database was created. Document and check at readiness:
the database encoding is UTF-8 and its locale provider is ICU or the built-in `C.UTF-8` of PostgreSQL 17.
The minimum supported PostgreSQL version becomes 16 (17 is what CI tests).

### Later, not in this plan: reading across languages

Two capabilities build on this plan and on the inference service from [08](08-ai-moderation.md):

- **Cross-language retrieval** by meaning: [11 — Semantic search](11-semantic-search.md).
- **Machine translation of content** as _derived data_: a `content_translations` table keyed by content hash
  and target language, written by a job, always displayed as "machine translation by <model>", never indexed
  as original text, never evaluated or cited as the author's words. Choose the model when the feature is
  scheduled (check the licence: several strong translation models are non-commercial).

## Phases

| Phase | Scope                                                                                                                                        | Days |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| A     | Language columns and DTO fields; declared idea language; detection with its fixture; `language` filter; Unicode slugs                        | 4–5  |
| B     | `search_documents`, analysis and query modules, index maintenance on every write path, rebuild command, cut-over, drop the generated columns | 5–7  |
| C     | Weighted minimums; database locale check; web: `lang`/`dir` on content, language chips and filter, short links; docs                         | 2–3  |

## Verification

- Domain unit tests: `slugify` for each script (including combining marks, emoji, right-to-left text, very
  long titles) and idempotence; weighted length.
- A search fixture with titles and claims in all twelve languages. For each: an inflected or differently
  segmented query finds the document (the audit's failing cases become passing tests: `двигатель` finds
  "двигатели", `纳米机器人` finds the longer title), an unaccented query finds accented text, and a query in one
  language does not return unrelated documents in another.
- Index integrity: after `search:rebuild` the table equals the incrementally maintained one; hidden and held
  subjects are never returned to non-moderators; the readiness self-test fails on a fake segmenter.
- Detection: accuracy on the fixture at or above 95 % for texts over 100 characters, and no wrong answer
  (only `und` or inheritance) below 20 characters.
- `npm run check`, `npm run test:pg` (new SQL), `npm run test:e2e`.

## Documentation to update

`docs/agents/data-model.md` (the new derived table and its single writer; language columns),
`docs/agents/README.md` (non-negotiable 3 now reads "each derived table has exactly one writer module"),
`docs/agents/architecture.md` (an ADR: extension-free multilingual search), `docs/agents/open-questions.md`
(11 and 23), `docs/developer/operations.md` (rebuild command, PostgreSQL version and locale),
`docs/user/user-guide.md` (search and languages).

## Risks

- **Segmentation quality.** ICU's dictionaries are good, not perfect, and Korean without a morphological
  analyser relies on bigrams. The index is versioned and rebuildable precisely so this can improve.
- **Wrong language detection** indexes a text with the wrong stemmer. `tsv_simple` still finds exact forms, and
  declared languages (ideas) bypass detection.
- **Index growth.** Two GIN indexes per document; measure on the load-test dataset of
  [09](09-read-scalability.md) before launch.

## Decisions for the owner

1. Whether lenses default to the reader's languages (default) or to all languages.
