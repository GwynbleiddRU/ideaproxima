import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { IDEA, settle, signIn } from "./helpers";

/**
 * The screenshot set for visual review: every main page, desktop and mobile, light and dark.
 * Output: audit/artifacts/screenshots/<viewport>-<theme>/<page>.png
 */
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "artifacts", "screenshots");

const PAGES: { name: string; path: string; signedIn?: boolean }[] = [
  { name: "01-home", path: "/" },
  { name: "02-explore", path: "/explore" },
  { name: "03-explore-neglected", path: "/explore?lens=neglected" },
  { name: "04-idea-overview", path: `/ideas/${IDEA.slug}` },
  { name: "05-idea-evidence", path: `/ideas/${IDEA.slug}/evidence` },
  { name: "06-idea-discussion", path: `/ideas/${IDEA.slug}/discussion` },
  { name: "07-idea-connections", path: `/ideas/${IDEA.slug}/connections` },
  { name: "08-idea-practice", path: `/ideas/${IDEA.slug}/practice` },
  { name: "09-idea-history", path: `/ideas/${IDEA.slug}/history` },
  { name: "10-topics", path: "/topics" },
  { name: "11-topic", path: "/topics/environment" },
  { name: "12-search", path: "/search?q=energy" },
  { name: "13-activity", path: "/activity" },
  { name: "14-principles", path: "/about" },
  { name: "15-profile", path: "/people/demo-mira" },
  { name: "16-sign-in", path: "/sign-in" },
  { name: "17-new-idea", path: "/new", signedIn: true },
  { name: "18-idea-signed-in", path: `/ideas/${IDEA.slug}`, signedIn: true },
  { name: "19-account", path: "/account", signedIn: true },
  { name: "20-not-found", path: "/no-such-page" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`${viewportName} ${colorScheme}`, () => {
      test.use({ viewport, colorScheme, deviceScaleFactor: viewportName === "mobile" ? 2 : 1 });
      for (const shot of PAGES) {
        test(shot.name, async ({ page }) => {
          if (shot.signedIn) await signIn(page);
          await page.goto(shot.path);
          await settle(page);
          await page.screenshot({
            path: join(OUT, `${viewportName}-${colorScheme}`, `${shot.name}.png`),
            fullPage: true,
          });
        });
      }
    });
  }
}

test("evaluation dialog", async ({ page }) => {
  await signIn(page);
  await page.goto(`/ideas/${IDEA.slug}`);
  await settle(page);
  await page.getByRole("button", { name: "Evaluate", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: join(OUT, "desktop-light", "21-evaluate-dialog.png") });
});
