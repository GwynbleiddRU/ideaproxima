import { expect, test } from "@playwright/test";
import { IDEA, watchErrors } from "./helpers";

test.describe("reading the archive (anonymous)", () => {
  test("a redacted activity keeps its place with a moderation notice", async ({ page }) => {
    await page.route("**/v1/activity?*", (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: "c8b6b0e9-42b6-4916-905a-b21b81a69a69",
              occurredAt: "2026-11-25T12:00:00Z",
              actor: null,
              action: "argument.made",
              ideaId: null,
              idea: null,
              subject: { kind: "argument", id: "b34a70a8-b617-410f-ab43-366b919092b8", hidden: true },
              payload: {},
            },
          ],
          nextCursor: null,
        },
      }),
    );
    await page.goto("/activity");
    await expect(page.getByRole("region", { name: "The record" }).getByRole("listitem")).toContainText(
      "content hidden by moderation",
    );
  });

  test("home presents the lenses, the domains, ways to help and live progress", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What could humanity");
    const lenses = page.getByRole("tablist", { name: "Lenses" });
    await expect(lenses.getByRole("tab", { name: "Highest potential" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await lenses.getByRole("tab", { name: "Neglected" }).click();
    await expect(page.getByRole("tabpanel").getByText(/at-or-below-median attention/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Domains of possibility" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Environment\s+3 ideas/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Move an idea forward/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest progress" })).toBeVisible();
    await expect(page.getByRole("link", { name: IDEA.title }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("topics show real counts and their newest ideas", async ({ page }) => {
    await page.goto("/topics");
    const environment = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: "Environment" }) });
    await expect(environment).toContainText("3 ideas");
    // The topic's own link plus its two newest ideas.
    await expect(environment.getByRole("link")).toHaveCount(3);
    await environment.getByRole("link", { name: "Environment" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Environment");
    await expect(page.getByText("· 3 ideas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Often together with" })).toBeVisible();
  });

  test("explore switches lenses, and each lens says what it measures", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/explore");
    await expect(page.getByText(/Most recently proposed/)).toBeVisible();
    await page.getByRole("navigation", { name: "Lenses" }).getByRole("link", { name: "Neglected" }).click();
    await expect(page).toHaveURL(/lens=neglected/);
    await expect(page.getByText(/at-or-below-median attention/)).toBeVisible();
    await page.getByLabel("Stage").selectOption("imagined");
    await expect(page).toHaveURL(/stage=imagined/);
    expect(errors).toEqual([]);
  });

  test("an idea shows its narrative, its signals and every view", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/explore");
    await page.getByRole("link", { name: IDEA.title }).first().click();
    await expect(page).toHaveURL(new RegExp(`/ideas/${IDEA.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(IDEA.title);
    await expect(page.getByRole("heading", { name: "Assessed quality" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Perspectives" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lifecycle stage" })).toBeVisible();

    const tabs = page.getByRole("navigation", { name: "Idea sections" });
    await tabs.getByRole("link", { name: /Claims & evidence/ }).click();
    await expect(page.getByRole("heading", { name: "Claims & evidence", level: 2 })).toBeVisible();

    await tabs.getByRole("link", { name: /Discussion/ }).click();
    await expect(page.getByRole("heading", { name: "Arguments" })).toBeVisible();

    await tabs.getByRole("link", { name: /Connections/ }).click();
    await expect(page.getByRole("figure", { name: /Connection map/ })).toBeVisible();

    await tabs.getByRole("link", { name: /In practice/ }).click();
    await expect(page.getByRole("heading", { name: "Initiatives & outcomes" })).toBeVisible();

    await tabs.getByRole("link", { name: /History/ }).click();
    await expect(page.getByRole("heading", { name: "Stage history" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a claim marker's evidence opens on demand", async ({ page }) => {
    await page.goto(`/ideas/${IDEA.slug}/evidence`);
    const claim = page.locator("article[id^='claim-']").first();
    const toggle = claim.getByRole("button", { name: /Evidence \(/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(claim.getByText("Does not establish:").first()).toBeVisible();
  });

  test("search finds ideas and people", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("search").first().getByRole("searchbox").fill("water");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=water/);
    await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Ideas/ })).toBeEnabled();
  });

  test("unknown pages and missing ideas show a helpful not-found page", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "Nothing is archived here." })).toBeVisible();
    await page.goto("/ideas/this-idea-does-not-exist");
    await expect(page.getByRole("heading", { name: "Nothing is archived here." })).toBeVisible();
  });

  test("visitors are asked to sign in before contributing, then brought back", async ({ page }) => {
    await page.goto(`/ideas/${IDEA.slug}`);
    await page.getByRole("button", { name: /Worth researching/ }).click();
    await expect(page).toHaveURL(/\/sign-in\?redirect=/);
    await page.getByLabel("Email").fill("demo-mira@demo.ideaproxima.invalid");
    await page.getByLabel("Password").fill("demo-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/ideas/${IDEA.slug}`));
    await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
  });

  test("switching a view in place keeps the reader's place", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const scrollY = () => page.evaluate(() => window.scrollY);
    const scrollTo = (y: number) => page.evaluate((top) => window.scrollTo(0, top), y);

    // Connections: the direction and depth toolbar sits mid-page.
    await page.goto(`/ideas/${IDEA.slug}/connections`);
    await expect(page.getByRole("figure", { name: /Connection map/ })).toBeVisible();
    await scrollTo(250);
    await page.getByRole("radiogroup", { name: "Direction" }).getByText("What it needs").click();
    await expect(page).toHaveURL(/direction=upstream/);
    await page.getByRole("radiogroup", { name: "Depth" }).getByText("1 step", { exact: true }).click();
    await expect(page).toHaveURL(/depth=1/);
    expect(await scrollY()).toBe(250);

    // Explore: filters refine the list where it is.
    await page.goto("/explore");
    await expect(page.getByLabel("Stage")).toBeVisible();
    await scrollTo(120);
    await page.getByLabel("Stage").selectOption("imagined");
    await expect(page).toHaveURL(/stage=imagined/);
    expect(await scrollY()).toBe(120);

    // A topic's lens tabs change the list below them, not the page.
    await page.goto("/topics/environment");
    const order = page.getByRole("navigation", { name: "Order" });
    await expect(order).toBeVisible();
    await scrollTo(100);
    await order.getByRole("link", { name: "Neglected" }).click();
    await expect(page).toHaveURL(/lens=neglected/);
    expect(await scrollY()).toBeGreaterThan(0);

    // Activity: a filter from the sticky rail shows the new feed from its first entry, not the page top.
    await page.goto("/activity");
    const feed = page.getByRole("region", { name: "The record" });
    await expect(feed.getByRole("listitem").first()).toBeVisible();
    await scrollTo(1500);
    await page
      .getByRole("navigation", { name: "Filter the record" })
      .getByRole("link", { name: "Evaluations" })
      .click();
    await expect(page).toHaveURL(/action=evaluation/);
    await expect(feed.getByRole("listitem").first()).toBeInViewport();
    expect(await scrollY()).toBeGreaterThan(0);
  });

  test("the API stays available under /v1 next to the app", async ({ request }) => {
    const index = await request.get("/v1");
    expect((await index.json()).apiVersion).toBe("v1");
    const shell = await request.get("/explore", { headers: { accept: "text/html" } });
    expect(shell.headers()["content-security-policy"]).toContain("default-src 'self'");
  });
});
