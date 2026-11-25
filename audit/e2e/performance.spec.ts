import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { IDEA, settle } from "./helpers";

/**
 * Cold-cache load metrics for the main entry pages, with budgets. Measured on localhost, so the numbers
 * isolate what the app itself costs (bytes, rendering) from network latency. Results: audit/artifacts/performance.json.
 */
const BUDGET = {
  /** Compressed JavaScript transferred on first visit. */
  jsKb: 160,
  cssKb: 25,
  lcpMs: 2500,
  cls: 0.05,
};

interface Metrics {
  page: string;
  jsKb: number;
  cssKb: number;
  fontKb: number;
  requests: number;
  fcpMs: number;
  lcpMs: number;
  cls: number;
  domContentLoadedMs: number;
}

async function measure(page: Page, path: string): Promise<Metrics> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(path);
  await settle(page);
  const raw = await page.evaluate(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const sum = (re: RegExp) =>
      resources.filter((r) => re.test(r.name)).reduce((s, r) => s + r.transferSize, 0);
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {
      js: sum(/\.js(\?|$)/),
      css: sum(/\.css(\?|$)/),
      font: sum(/\.woff2(\?|$)/),
      requests: resources.length,
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
      lcp: w.__lcp,
      cls: w.__cls,
      dcl: nav.domContentLoadedEventEnd,
    };
  });
  const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;
  return {
    page: path,
    jsKb: kb(raw.js),
    cssKb: kb(raw.css),
    fontKb: kb(raw.font),
    requests: raw.requests,
    fcpMs: Math.round(raw.fcp),
    lcpMs: Math.round(raw.lcp),
    cls: Math.round(raw.cls * 1000) / 1000,
    domContentLoadedMs: Math.round(raw.dcl),
  };
}

const results: Metrics[] = [];

for (const path of ["/", "/explore", `/ideas/${IDEA.slug}`, `/ideas/${IDEA.slug}?hl=ru`]) {
  test(`first visit to ${path} stays within budget`, async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    const metrics = await measure(page, path);
    await context.close();
    results.push(metrics);
    test.info().annotations.push({ type: "metrics", description: JSON.stringify(metrics) });
    expect(metrics.jsKb, "compressed JS (KB)").toBeLessThanOrEqual(BUDGET.jsKb);
    expect(metrics.cssKb, "compressed CSS (KB)").toBeLessThanOrEqual(BUDGET.cssKb);
    expect(metrics.lcpMs, "largest contentful paint (ms)").toBeLessThanOrEqual(BUDGET.lcpMs);
    expect(metrics.cls, "cumulative layout shift").toBeLessThanOrEqual(BUDGET.cls);
  });
}

test.afterAll(() => {
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "artifacts", "performance.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ measuredAt: new Date().toISOString(), budget: BUDGET, results }, null, 2) + "\n",
  );
});
