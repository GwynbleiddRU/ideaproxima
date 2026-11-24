# 13 — The public web: search engines, link previews, policies, browser telemetry

Part of the [production-readiness program](README.md). Prompt for the implementing agent:
`prompts/api/13-public-web-prompt.md`.

| Status     | Not started                                                                                                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depends on | Everything up to step 30: [05](05-localization.md) A–C2 (catalogues), [06](06-multilingual-content-and-search.md) (content languages), [07](07-moderation-core.md) B (the content policy), [09](09-read-scalability.md) C (cache rules) |
| Unblocks   | [10](10-deployment-and-operations.md) (it deploys and alerts on what this plan adds); the launch                                                                                                                                        |
| Size       | 2 sessions (steps 31 and 32) · 4–6 engineer-days                                                                                                                                                                                        |

## Outcome

An idea shared in a chat app shows its title and summary; search engines in every target region index ideas,
topics and profiles, and receive real 404s for anything missing or hidden; the content policy, terms, privacy
notice, help and contact details are readable inside the product; browser errors and real-user performance
reach the operators; and the interface is tested in the three browser engines people actually use
([audit](api-audit.md): WEB-1 to WEB-4).

The API audit looked at `/v1`. This plan covers what the 2026-11-18 review found in how the web app is
delivered.

## Phase A — Pages that crawlers and link previews can read (step 31)

**Today** (`apps/api/src/http/web.ts`): every client route receives the same `index.html` with status 200.
Link previews never run JavaScript, so a shared idea shows only the generic page title; crawlers that render
little or no JavaScript (several of the search engines that matter in the target regions) see an empty shell;
a missing or hidden idea is a "soft 404" (status 200). Worse, the shell is only served when the request's
`Accept` header contains `text/html`, and several preview bots send `Accept: */*`, so they receive the API's
JSON 404.

### Design

- **A route table the server knows.** Export the client route patterns from one module in the web app
  (`apps/web/src/app/routes.ts`, used by the router) and give the server the same list (a shared constant in
  `packages/contracts`, or a generated JSON file). A test fails if the router and the server's list differ.
  A `GET` for a known pattern is a document whatever its `Accept` header; an unknown path is a 404 (the
  shell with status 404, so the web app's not-found page still renders).
- **Entity pages are rendered on the server, as an anonymous reader would see them.** For `/ideas/:idea`,
  `/topics/:slug`, `/people/:handle`, `/claims/:claim` and `/sources/:source`, a new middleware
  (`http/pages.ts`) loads the entity through the same service functions as the API, with an anonymous
  context, so every visibility rule applies. It is mounted **after** the network limiter (L1 of plan 03) and
  before session resolution: these responses cost a query or two, unlike static files, and must never depend
  on who is signed in. Static files and the shell for client-only routes stay in `webApp()`, with no
  database work.
- **Status codes.** A missing or hidden entity answers 404 with `<meta name="robots" content="noindex">`. An
  idea requested by id answers 200 with a canonical link to its slug URL; an old slug is not a concept here
  (slugs never change).
- **Head.** Into placeholders in `apps/web/index.html` (comments the build preserves; a test checks they are
  present in `dist/index.html`) the server writes: `<title>`; `<meta name="description">` (the summary, cut at
  a word boundary near 160 characters); `<link rel="canonical">` with an absolute URL built from
  `PUBLIC_BASE_URL` (plan 04); Open Graph (`og:type`, `og:title`, `og:description`, `og:url`,
  `og:site_name`, `og:image`, `og:locale` from the content language when known); `twitter:card` `summary`;
  and JSON-LD (`schema.org/CreativeWork` for ideas with `name`, `description`, `inLanguage`,
  `dateCreated`, `dateModified`, `about` as topic names and `author` as people; `Person` for profiles).
- **Body.** Inside `#root`, a minimal static rendition for readers without JavaScript: the title as `h1`, the
  summary, the topics as links, and a link to the full page. `createRoot()` replaces it on mount; nothing is
  hydrated.
- **This is user text going into HTML.** Every value is HTML-escaped for attributes and text; JSON-LD is
  serialised with `<`, `>`, `&`, U+2028 and U+2029 escaped (`<` …) so a title cannot close the script
  element. Tests feed hostile titles (`</script><script>alert(1)</script>`, `"><img src=x onerror=…>`,
  right-to-left overrides) through every field.
- **CSP stays valid.** The CSP hashes bare `<script>` blocks of `index.html` (the theme bootstrap). JSON-LD
  uses `<script type="application/ld+json">`, which the hash pattern does not match and browsers never
  execute; the bootstrap script must stay byte-identical. A test asserts the rendered page's inline scripts
  are exactly the allowed ones.
- **Utility routes are not indexed.** `account`, `sign-in`, `join`, `new`, `ideas/:idea/edit` and search
  result pages carry `noindex`.
- **Caching** follows plan 09's classes: entity pages use the public content class with an `ETag`, compressed
  like other dynamic responses; 404s are `no-store`. The page URLs are among those `setVisibility()` purges
  from the edge (plan 09's `cache.purge`), so a hidden idea's page leaves the CDN at once.
- **`robots.txt`**: allow the public pages; disallow `/v1/` and the utility routes; name the sitemap.
- **Sitemaps**: `/sitemap.xml` is a sitemap index; `/sitemaps/ideas-<n>.xml`, `topics.xml` and
  `people-<n>.xml` list visible entities, at most 50,000 URLs per file, with `lastmod` (an idea's newest
  accepted revision). Pages are keyset ranges. Apply the short public-content TTL and enqueue a purge for the affected shard when eligibility changes. Test against a previously warmed sitemap. Profiles are listed only once they have a
  visible contribution.
- **Languages.** URLs carry no locale (plan 05), so there is no `hreflang`. `<html lang>` stays the
  interface's; the content's language goes into `og:locale`, JSON-LD `inLanguage`, and the `lang` attribute
  of the static body block.
- **A preview image.** A static 1200 × 630 image in `apps/web/public/` with the site name, previewed in
  `designs/` and approved by the owner (decision 19 in the program).

### Verification

- Status: 200 for visible entities, 404 for missing and hidden ones (also with `Accept: */*`), 404 for an
  unknown path, 200 for every client-only route.
- Head and body content per entity kind; canonical for an id URL; escaping with hostile input in every field.
- `robots.txt` and the sitemaps: well-formed XML, limits respected, no hidden or held entity listed.
- A static file still costs no database query; an entity page costs a bounded number (assert with a counting
  wrapper); entity pages are limited by `net.requests`.
- The browser audit still passes (the static body block is replaced on mount; no layout shift budget broken).
- A plain HTTP fetch of an idea page, without JavaScript, contains its title and summary (the link-preview
  test).

## Phase B — Policies, help, contact, telemetry, browsers (step 32)

### Policy and help pages

- **Routes:** `/policies/content`, `/policies/terms`, `/policies/privacy`, `/contact`, and `/help`.
- **One source for each text**, in `docs/user/`: `content-policy.md` (written by plan 07, step 19),
  `terms.md`, `privacy.md`, `contact.md` and `user-guide.md`. The web build imports them as raw text (Vite
  `?raw`) and renders them with the existing `Markdown` component, so the repository and the product never
  disagree. Translations, when they exist, are `docs/user/<name>.<locale>.md`; without one, the English text
  is shown with a one-line note in the reader's language. Legal texts that are translated say which version
  prevails (the owner's call).
- **Skeletons.** `terms.md`, `privacy.md` and `contact.md` do not exist yet. Create them as skeletons with
  every owner-supplied part marked `TODO(owner): …` (the operator's identity, contact address for users,
  legal notices and authorities, governing law, the contribution licence). Plan 14 refuses a "ready" verdict
  while any `TODO(owner)` remains in these files.
- **Links:** the footer links to all five pages; registration links the terms and privacy notice beside the
  acceptance control of plan 04; the report dialog links the content policy; notices of plan 07 link the
  content policy by absolute URL.
- **Rendering rules:** relative links between these documents become in-app links; any other relative link
  (into the repository) is a test failure, because readers of the product cannot follow it.
- Mock-ups first: the policy page layout and the footer.

### Browser telemetry

Without it, a JavaScript error that breaks the editor in one browser, or a page that takes eight seconds on
mobile networks in one region, is invisible until someone complains.

- **`POST /v1/telemetry`**, catalogued, `mutates: false`, its own L2 policy `telemetry` (network scope,
  30 per minute), no session needed. The body is a strict schema: `{ kind: "error", message, asset, line,
column, route, release }` (message cut at 300 characters, `asset` a file name under `/assets/`, `route` the
  matched pattern, never a URL) or `{ kind: "vitals", route, lcp, inp, cls, ttfb, connection, release }`.
  Nothing else is accepted: no URLs with ids, no user text, no user agent string beyond what the request
  already carries.
- The server stores nothing in the database. It counts `web_errors_total{route, release}`, observes
  `web_vitals_seconds{metric, route}` and `web_cls{route}` histograms, and logs error reports at `warn` with
  the request id.
- The web app reports uncaught errors (`error`, `unhandledrejection`, the router's error component) and
  samples vitals at 10 % of page loads, sending with `navigator.sendBeacon` at most once per page per kind.
  Measuring INP correctly is subtle; the `web-vitals` package (small, no network access of its own) is an
  acceptable dependency under the dependency policy, or an equivalent `PerformanceObserver` implementation
  with tests.
- Plan 10 adds the alert (error rate per release) and the dashboard panels.

### Browsers

- The browser audit's end-to-end project runs on Chromium, Firefox and WebKit, plus a phone viewport on
  WebKit (`audit/playwright.config.ts`); screenshots and the performance budget stay on Chromium. CI installs
  the three engines; run them as a matrix so the pipeline does not get three times slower.
- Fix what fails. Anything that cannot be fixed is listed in the user guide's browser support note.

### Verification

- Each policy page renders in English and falls back correctly for a locale without a translation; no
  repository link survives in rendered pages; footer and registration links resolve.
- Telemetry: a valid report is counted; an invalid one is 400; the limit answers 429; a report never appears
  in the database; the web app sends one report for a thrown error (unit test) and none when the endpoint
  fails.
- `npm run test:e2e` green on all three engines.

## Documentation to update

`docs/developer/developer-guide.md` (server-rendered page metadata, the route table, the policy-page
mechanism, telemetry, browser support), `docs/developer/operations.md` (`PUBLIC_BASE_URL` for canonical
links, the new metrics, how to verify a link preview), `docs/agents/architecture.md` (amend ADR-20: the server
renders metadata for entity pages), `docs/user/user-guide.md` (browser support), `audit/README.md`
(engines), the roadmap (P1-6, the search-engine item, is done).

## Risks

- **Injection through metadata.** User text reaches HTML attributes and a script element. The escaping is
  tested with hostile input in every field, and the CSP stays strict.
- **Database work on page views.** Entity pages are cached at the edge for 30 seconds and limited by
  `net.requests`; static files remain free.
- **Drift between the router and the server's route list.** A test compares them.
- **Placeholder text shipped as policy.** Plan 14 blocks the launch while a `TODO(owner)` remains.

## Decisions for the owner

1. The site description and the preview image (program decision 19).
2. The texts of the terms, the privacy notice and the contact page (program decisions 8 and 16).
