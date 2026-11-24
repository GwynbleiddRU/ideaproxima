# 05 — Localisation: the product in 12 languages

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/05-localization-prompt.md`.

| Status     | Not started                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Depends on | [01](01-operational-foundations.md) (configuration, logs); phase D on every interface change before step 38                                   |
| Unblocks   | Every later plan's strings and error reasons; [06](06-multilingual-content-and-search.md); localised e-mail in [04](04-accounts-and-trust.md) |
| Size       | 5 sessions (steps 6–9 and 38) · 15–22 engineer-days, plus about one reviewer-day per language                                                 |

## Outcome

Every word the product itself says (interface, vocabulary, topics, errors, e-mail) is available in twelve
languages, including a right-to-left one, with correct plurals, dates and numbers; missing translations fall
back to English and fail CI rather than production; and adding a thirteenth language is a catalogue, a
constant and a review, with no code change ([audit](api-audit.md): I18N-4, I18N-5, I18N-7).

What people _write_ (ideas, claims, comments) is the subject of
[06 — Multilingual content and search](06-multilingual-content-and-search.md). The two are different problems
and this plan keeps them apart.

## The twelve languages

| Tag       | Language             | Script     | Direction | Plural forms | Why it is in the first set                                              |
| --------- | -------------------- | ---------- | --------- | ------------ | ----------------------------------------------------------------------- |
| `en`      | English              | Latin      | LTR       | 2            | Source language; the working language of science                        |
| `zh-Hans` | Chinese (Simplified) | Han        | LTR       | 1            | Largest research output and online population                           |
| `es`      | Spanish              | Latin      | LTR       | 3            | Second most spoken native language; Europe and the Americas             |
| `ar`      | Arabic               | Arabic     | **RTL**   | 6            | 400M+ speakers; forces right-to-left support from the start             |
| `pt-BR`   | Portuguese (Brazil)  | Latin      | LTR       | 3            | Brazil's research and investment community; serves `pt-PT` as fallback  |
| `id`      | Indonesian           | Latin      | LTR       | 1            | 200M+ speakers, fast-growing online population                          |
| `fr`      | French               | Latin      | LTR       | 3            | Europe, Canada and francophone Africa                                   |
| `ja`      | Japanese             | Kana + Han | LTR       | 1            | High R&D intensity; low English use                                     |
| `ru`      | Russian              | Cyrillic   | LTR       | 4            | Large scientific community; the roadmap's first non-English language    |
| `de`      | German               | Latin      | LTR       | 2            | Research and funding centre; the longest strings (a layout stress test) |
| `hi`      | Hindi                | Devanagari | LTR       | 2            | 600M+ speakers; third-largest research output by country                |
| `ko`      | Korean               | Hangul     | LTR       | 1            | Among the highest R&D spending per GDP; low English use                 |

The set covers five scripts, both directions and every plural shape from one form to six, so the architecture
is exercised by the first release rather than discovered later. It is a **default for the owner to confirm**:
swapping a language (candidates: Italian, Dutch, Turkish, Vietnamese, Polish, Ukrainian, Bengali, Persian)
changes one constant and one catalogue. One external constraint is worth knowing when choosing: the moderation
model recommended in [08](08-ai-moderation.md) covers all twelve, while the alternative policy model evaluated
there officially lists twelve languages that include Italian and Dutch but not Hindi or Indonesian.

`LOCALES` lives in `packages/i18n/src/locales.ts`: tag, endonym ("Русский", "العربية"), direction, status
(`released` or `beta`), fallback chain, `Intl` locale (for example `ar-u-nu-latn`: Latin digits, the convention
for scientific content). Each language is `beta` until a native reviewer signs off its catalogue.

## Principles

1. **Three things are localised three ways.** Product language is translated by us (this plan). Content is
   written by people, tagged with its language and never silently translated (plan 06). Formats (dates,
   numbers, plurals, lists) come from the platform's `Intl` APIs, and the API stays format-neutral: ISO 8601
   timestamps, plain numbers.
2. **Keys and codes never change with language.** Stage keys, lens keys, error codes, topic slugs and handles
   are identifiers. Only labels are translated.
3. **Only catalogue endpoints are localised.** `/v1/vocabulary`, `/v1/topics`, error messages and e-mail vary
   with the locale. Every other response is locale-neutral, which keeps them cacheable and testable. Names
   inside references (a topic's `name` in an idea) stay canonical English; clients map slugs to localised names
   from `/v1/topics`.
4. **English is the source and the fallback.** A missing translation renders in English, is reported in CI for
   `released` locales, and never throws at run time.
5. **One vocabulary still.** Translations of the vocabulary live beside it and are generated from it; the
   interface does not grow a second copy of any label.
6. **A machine draft is not a release.** Catalogues may be drafted by a model with the glossary and context;
   a language is `released` only after a native speaker has reviewed it. A "future knowledge institution" is
   judged by its sentences.

## Design

### A shared package

```text
packages/i18n/                      new workspace: pure data and small pure functions, no I/O
  src/locales.ts                    LOCALES, DEFAULT_LOCALE, isRtl(), intlLocale()
  src/negotiate.ts                  negotiateLocale(preferences, supported): RFC 4647 lookup + aliases
  src/translator.ts                 createTranslator(locale) → t(key, params)   (ICU MessageFormat)
  src/vocabulary.ts                 localizeVocabulary(vocabulary, locale)
  catalogs/<tag>/vocabulary.*       stages.imagined.label, dimensions.impact.scale.anchors.5, lenses.neglected.description …
  catalogs/<tag>/topics.*           topics.energy.name, topics.energy.description
  catalogs/<tag>/errors.*           errors.handle_taken, validation.too_small.string …
  catalogs/<tag>/emails.*           (used by plan 04)
  glossary/<tag>.json               agreed translations of core terms, for translators
apps/web/src/locales/<tag>/ui.*     interface strings (web only)
```

Dependency direction: `domain ← i18n ← api, web`. `contracts` does not depend on it.

**Message syntax: ICU MessageFormat** everywhere (plurals, select, named arguments). It is the industry
standard, translators and models know it, and Russian and Arabic plurals cannot be expressed with "one/many"
pairs.

**Library: Lingui 6** (`@lingui/core` on both sides, `@lingui/react` in the web app, `@lingui/cli` to compile
catalogues). Reasons: catalogues are compiled at build time, so no message parser ships to the browser (the
runtime is a few kilobytes against a 160 KB first-visit budget); `<Trans>` handles sentences with links and
emphasis; PO catalogues carry translator context and work with every translation tool; the core runs in Node,
so the API and the web app share one toolchain. Two facts to handle (checked on npm, 2026-11-17): Lingui 6.12
requires Node ≥ 22.19, so the repository's `engines` floor moves from 22.18 to 22.19; and its macros need a
Babel plugin in the Vite 8 build. **Use explicit message ids, not macros** (`t("idea.propose.title")`), which
avoids the build plugin entirely and gives type-checked keys (`MessageId = keyof` the English catalogue).
Fallback if the half-day spike in phase B finds a blocking incompatibility: FormatJS (`intl-messageformat`,
catalogues precompiled with `formatjs compile --ast`), same catalogue layout and the same checks.

### Vocabulary: generated keys, overlaid translations

The English strings stay where they are, inline in `packages/domain/src/vocabulary` (they are the source text
and the fallback, and every existing consumer keeps working).

- `scripts/i18n/extract-vocabulary.ts` walks the object returned by `catalog.vocabulary()` and writes the
  English catalogue: for each group and item, the fields `label`, `description`, `question`, `prompt`,
  `phrase`, `inverse` and scale anchors become keys such as `stages.imagined.label`. About 310 keys.
- A test fails when the generated English catalogue is stale, the same pattern as the generated API reference.
- `localizeVocabulary(vocabulary, locale)` returns the same shape with translated strings where they exist.
  The API uses it for `/v1/vocabulary`; the web app uses it behind a `useVocabulary()` hook, loaded with the
  active locale's chunk. Direct reads such as `DIMENSIONS[key].label` in the web app are replaced by the hook
  (`apps/web/src/lib/vocabulary.ts` is the choke point).

### API

**Negotiation**, in this order: `?locale=` (explicit, cache-friendly) → the signed-in account's saved locale →
`Accept-Language` → `en`. `negotiateLocale()` handles quality values and aliases: `zh`, `zh-CN`, `zh-SG` →
`zh-Hans` (and, until Traditional Chinese exists, `zh-TW` and `zh-HK` too); `pt`, `pt-PT` → `pt-BR`; `es-*` →
`es`; `in` → `id`. A middleware stores the result on the request (`c.set("locale", …)`); localised responses
carry `Content-Language`. Whenever this URL can negotiate on `Accept-Language`, include it in `Vary` even on
the default-language response to a request with no header. Account-specific negotiation is private. Test a
shared-cache hit in each order with two locales and with the header absent.

**Contract changes** (all additive except the error reasons, which land before the freeze in
[12](12-public-api.md)):

| Change                                                     | Detail                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /v1/locales` (new)                                    | `[{ tag, name, direction, status }]`, for language switchers             |
| `GET /v1/vocabulary?locale=`                               | Localised strings; the response gains `locale`                           |
| `GET /v1/topics?locale=`, `GET /v1/topics/:slug?locale=`   | Localised `name` and `description`, falling back to the topic's own text |
| `MeResponse.preferences.locale`, `PATCH /v1/me { locale }` | The account's saved language (`accounts.locale`, nullable = negotiate)   |
| `RegisterRequest.locale` (optional)                        | Remembers the language the person signed up in                           |
| Error envelope                                             | `error.details.reason` (stable), localised `error.message`; see below    |

**Errors become keys.** Today a service throws `DomainError("conflict", "That handle is taken.")`. After:

```ts
throw new DomainError("conflict", "handle_taken"); // (code, reason, params?, details?)
throw new DomainError("invariant_violated", "stage_requirement_unmet", { stage, requirement });
```

- `ErrorReason` is a union type derived from the keys of the English error catalogue in the domain package
  (`packages/domain/src/errors.en.ts`), so an unknown reason does not compile and the domain package still
  renders an English `message` by itself (logs, scripts, tests).
- `handleError()` renders the message in the request's locale and returns
  `{ code, message, details: { reason, …params } }`. Clients may show the message or map the reason themselves.
- Validation issues become `{ path, code, message, params }`. Map zod's issue codes ourselves
  (`too_small`, `too_big`, `invalid_format`, `invalid_value`, `invalid_type`, `custom` with a reason in
  `params`) to catalogue messages such as `validation.too_small.string` with `{ minimum }`. Do **not** use
  zod's global locale setting: it is process-wide and requests in different languages run concurrently.
- About 90 throw sites change. It is mechanical and the compiler finds every one.

**Topics.** `topic_translations(topic_id, locale, name, description, primary key (topic_id, locale))`, mutable
catalogue data like `topics`. The twelve base topics are seeded from `catalogs/<tag>/topics.*` by the existing
idempotent seed; admins translate topics they create through `PUT /v1/topics/:slug/translations/:locale`.

### Web

- **Locale resolution:** `?hl=<tag>` (explicit, also for support and screenshots) → `localStorage` → the
  account's saved locale → `navigator.languages` → `en`. No locale prefix in URLs: idea URLs stay canonical and
  shareable across languages. A language switcher in the header menu and in account settings.
- **Loading:** one lazy chunk per locale containing the compiled interface and vocabulary catalogues. The
  inline bootstrap script in `index.html` (already allowed by hash in the CSP) reads the stored locale and sets
  `lang` and `dir` on `<html>` before first paint, next to the theme. Budget: a locale adds roughly 20–30 KB
  compressed (about 1,000 interface messages and 310 vocabulary strings); the performance audit must pass in a
  non-English locale.
- **Formatting:** `lib/format.ts` stops pinning `en`. Formatters are created for the active `Intl` locale and
  recreated when it changes. The English-only `plural()` disappears in favour of ICU plurals; "just now",
  "Today" and "Yesterday" come from `Intl.RelativeTimeFormat` with `numeric: "auto"`; compact units from
  `Intl.NumberFormat` with `style: "unit"`; lists from `Intl.ListFormat`.
- **Right to left:** convert the 63 physical declarations to logical properties (`margin-inline-start`,
  `inset-inline-end`, `text-align: start` …); mirror directional icons under `[dir="rtl"]`; make the lifecycle
  track, meters and the relation graph follow the inline direction; never mirror user content.
- **Scripts:** the bundled fonts cover Latin, Cyrillic and Greek only. For Han, Kana, Hangul, Arabic and
  Devanagari use per-script system font stacks selected with `:lang()`, with no web fonts (a CJK font is
  megabytes). Disable letter-spacing for scripts that join or stack (it appears in 11 stylesheets and breaks
  Arabic), and do not rely on uppercase or italics, which do not exist in most of these scripts.
- **Content inside the interface:** any block of user text gets `lang` and `dir` from its own language once
  plan 06 provides it, `dir="auto"` until then. A Russian idea in an Arabic interface must still read left to
  right.
- **Guard rail:** an ESLint rule forbidding string literals in JSX and in the props that render text, enabled
  directory by directory as each area is extracted, so English cannot creep back in.
- **Preview first.** The language switcher, a right-to-left idea page and the typography for one CJK and one
  Indic script are mocked up in `designs/` and approved by the owner before implementation, as with every
  larger interface change in this project.

### Translation workflow and its checks

1. English catalogues are the source. Every interface message has a translator note (where it appears, what
   its placeholders are).
2. `packages/i18n/glossary/<tag>.json` fixes the translation of core terms (idea, claim, evidence, stance,
   steward, lens, each stage, "contested", "neglected") before any catalogue is drafted, so the vocabulary is
   consistent across 1,400 messages.
3. A drafting agent translates one language per session with the glossary and notes; the output is `beta`.
4. A native reviewer corrects the catalogue (about one working day for ~16,000 words) and the language becomes
   `released`.
5. `npm run i18n:check`, part of `npm run check`, fails when, for a `released` locale: a key is missing or
   unknown; a message does not parse; its placeholders differ from the English source; a plural lacks a
   category the language requires (`Intl.PluralRules`); or the generated vocabulary catalogue is stale. For
   `beta` locales it reports the same as warnings. `npm run i18n:status` prints coverage per locale.
6. A pseudo-locale (`en-XA`: accented, 40 % longer, bracketed) is available in development and used by one
   screenshot run, so truncation and hard-coded strings are visible without reading a foreign language.

## Phases

| Phase | Scope                                                                                                                                                          | Days |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| A     | `packages/i18n`; negotiation; error reasons and localised errors; vocabulary extraction and overlay; topics; `/v1/locales`; saved locale                       | 4–6  |
| B     | Web: spike, i18n runtime, switcher, bootstrap `lang`/`dir`, formats, logical properties, script fonts; shell and auth pages extracted; previews approved first | 4–6  |
| C1    | Extract the interface, first half: home and explore → the idea layout and its six tabs                                                                         | 3–4  |
| C2    | Extract the interface, second half: editor → topics, search, activity → people, account, dialogs, toasts and error messages                                    | 2–3  |
| D     | Glossaries; draft the eleven languages; `i18n:check` in CI; pseudo-locale; end-to-end, accessibility and performance runs in `de`, `ar`, `ja`                  | 2–3  |

Phase C is split into two sessions, C1 and C2, because extraction touches every component. Phases A to C2
are steps 6 to 9 of the sequence, before any other interface work, so every later string goes straight into
the English catalogue. Phase D is step 38, after the last interface change (plans 13 and 10 included), so
the eleven drafts cover every string the product has at launch. Native review runs after phase D and gates
only the `released` flag of each language.

## Verification

- Unit: negotiation (quality values, aliases, unsupported tags); translator fallback; catalogue checks, with a
  deliberately broken fixture per failure mode; `localizeVocabulary` keeps the shape.
- API: `/v1/vocabulary?locale=ru` is contract-valid and localised; the same request in two locales run
  concurrently never mixes languages; every `ErrorReason` has an English message (type-level) and a key in
  each `released` catalogue (`i18n:check`); validation errors carry codes and parameters.
- Web: the browser audit switches language, asserts `lang` and `dir`, and runs axe in `ar` in both themes;
  screenshots in `de`, `ar`, `ja` and the pseudo-locale; the first-visit budget holds in `ru`.
- `npm run check`, `npm run test:e2e`.

## Documentation to update

`docs/agents/architecture.md` (a new ADR: localisation model; update the layer diagram with `packages/i18n`),
`docs/agents/README.md` (non-negotiable 8, "one vocabulary", gains its translation rule),
`docs/agents/open-questions.md` (question 11), `docs/developer/developer-guide.md` (a section "Text and
languages": how to add a message, a language, a vocabulary term), `docs/user/user-guide.md`,
`docs/agents/roadmap.md` (P1-10).

## Risks

- **Translation quality.** The mitigation is the glossary plus native review, and shipping languages as `beta`
  honestly labelled rather than pretending.
- **Extraction churn.** Touching 61 files invites regressions: extract per area, keep each change
  reviewable, and let the lint rule and the pseudo-locale screenshots catch what was missed.
- **Bundle growth.** Catalogues are per-locale chunks; verify with the existing performance budget rather than
  by estimate.
- **Layout under long or vertical-metric-heavy scripts.** German and Russian overflow buttons and tabs; Arabic
  and Devanagari need more line height. The three-locale screenshot run exists to catch this.

## Decisions for the owner

1. The twelve languages (default above) and which are required to be `released` at launch.
2. Who reviews each language.
3. Digits in Arabic: Latin (default) or Arabic-Indic.
