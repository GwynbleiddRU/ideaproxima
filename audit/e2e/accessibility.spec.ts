import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { IDEA, settle, signIn } from "./helpers";

/**
 * Automated WCAG 2.1 AA checks (axe-core) on the main pages, in both colour schemes: contrast is tuned per theme,
 * so both are verified. Serious and critical violations fail the build; minor ones are reported as annotations.
 */
const PAGES: [string, string][] = [
  ["home", "/"],
  ["explore", "/explore?lens=potential"],
  ["idea", `/ideas/${IDEA.slug}`],
  ["idea evidence", `/ideas/${IDEA.slug}/evidence`],
  ["idea discussion", `/ideas/${IDEA.slug}/discussion`],
  ["idea connections", `/ideas/${IDEA.slug}/connections`],
  ["idea practice", `/ideas/${IDEA.slug}/practice`],
  ["idea history", `/ideas/${IDEA.slug}/history`],
  ["topics", "/topics"],
  ["search", "/search?q=energy"],
  ["activity", "/activity"],
  ["principles", "/about"],
  ["sign in", "/sign-in"],
  ["registration", "/join"],
  ["account settings", "/account"],
  ["forgot password", "/forgot-password"],
  ["reset password", "/reset-password#preview"],
  ["verify email", "/verify-email#preview"],
  ["confirm email change", "/confirm-email-change#preview"],
  ["change email", "/change-email"],
  ["profile", "/people/demo-mira"],
];

type Violation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

/** One readable paragraph per violation: rule, help text and up to five offending elements. */
function describeViolation(v: Violation): string {
  const nodes = v.nodes.slice(0, 5).map((n) => {
    const reason = n.failureSummary?.split("\n")[1] ?? "";
    return `   ${n.target.join(" ")} — ${reason}`;
  });
  return [`${v.impact} ${v.id}: ${v.help}`, ...nodes].join("\n");
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${colorScheme})`, () => {
    test.use({ colorScheme });
    for (const [name, path] of PAGES) {
      test(name, async ({ page }) => {
        if (path === "/change-email" || path === "/account") await signIn(page);
        await page.goto(path);
        await settle(page);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        for (const v of results.violations.filter((x) => !blocking.includes(x))) {
          test.info().annotations.push({
            type: `a11y ${v.impact}`,
            description: `${v.id}: ${v.help} (${v.nodes.length})`,
          });
        }
        const report = blocking.map(describeViolation);
        expect(report, report.join("\n\n")).toEqual([]);
      });
    }
  });
}
