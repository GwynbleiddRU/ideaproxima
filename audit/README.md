# Browser audit

Playwright checks of the **production build** in a real browser (Chromium), against an isolated server with a
fresh demo database. Your local data (`apps/api/.data`) is never touched.

```bash
npm run test:e2e            # build, then end-to-end flows + accessibility + performance budgets
npm run audit:screenshots   # build, then every page in desktop/mobile × light/dark
npx playwright show-report audit/artifacts/report   # the last run's HTML report (traces for failures)
```

Browsers: run `npx playwright install chromium` once if Playwright asks for them.

## What is checked

| Spec                        | What it proves                                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/browse.spec.ts`        | Reading works without an account: home, lenses and filters, every view of an idea, claim evidence on demand, search, not-found pages, the sign-in detour for contributions, and the API still answering under `/v1`. No console errors. |
| `e2e/hero.spec.ts`          | The home hero fills exactly the visible area under the header, with headline, search and both calls to action fully visible and no horizontal scroll, on seven screens from 360×740 to 1440×900; `/` focuses the search.                |
| `e2e/contribute.spec.ts`    | The whole contribution loop as a newcomer: join → propose an idea → take a stance → evaluate → add a claim → attach evidence (with its limitations) → argue → comment → publish a revision → sign out.                                  |
| `e2e/accessibility.spec.ts` | axe-core WCAG 2.1 AA scans of 14 pages in the light **and** dark theme. Serious and critical violations fail; minor ones are annotated in the report.                                                                                   |
| `e2e/performance.spec.ts`   | First-visit (cold cache) budgets for the entry pages: compressed JS ≤ 160 KB, CSS ≤ 25 KB, LCP ≤ 2.5 s, CLS ≤ 0.05. Measured values go to `artifacts/performance.json`.                                                                 |
| `e2e/screenshots.spec.ts`   | Not a test: the screenshot set for visual review, `artifacts/screenshots/<viewport>-<theme>/<page>.png`.                                                                                                                                |

## How it runs

`playwright.config.ts` starts `server.ts`, which seeds a throwaway PGlite database with the demo data and serves
`apps/web/dist` + `apps/api/dist` on port 3100 (override with `AUDIT_PORT`). Rate limits are disabled there so the
specs can sign in repeatedly. Specs run in one worker because they share the database.

Everything under `artifacts/` is generated (reports, traces, screenshots, metrics) and ignored by git.

## Writing specs

- Select by role and accessible name (`getByRole("button", { name: "Evaluate" })`), as assistive technology does.
  If a selector is hard to write, the UI is probably hard to use.
- Use `watchErrors(page)` from `e2e/helpers.ts` and assert it is empty at the end: a console error is a bug.
- Specs that create data should use unique names (`Date.now().toString(36)`), so reruns against a reused server
  stay independent.
