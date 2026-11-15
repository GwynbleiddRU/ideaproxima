import { expect, test } from "@playwright/test";
import { IDEA, watchErrors } from "./helpers";

test.describe("reading the archive (anonymous)", () => {
  test("home presents the lenses, the lifecycle and live activity", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("What could humanity");
    await expect(page.getByRole("heading", { name: "Highest potential" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How an idea moves" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByRole("link", { name: IDEA.title }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("explore switches lenses, and each lens says what it measures", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Newest", level: 2 })).toBeVisible();
    await page.getByRole("navigation", { name: "Lenses" }).getByRole("link", { name: "Neglected" }).click();
    await expect(page).toHaveURL(/lens=neglected/);
    await expect(page.getByText("What this measures:")).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Community perspective" })).toBeVisible();

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
    await claim.getByRole("button", { name: /Evidence \(/ }).click();
    await expect(claim.getByRole("button", { name: "Hide evidence" })).toBeVisible();
  });

  test("search finds ideas and people", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("search").first().getByRole("searchbox").fill("water");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=water/);
    await expect(page.getByRole("heading", { name: /Ideas \(\d+\)/ })).toBeVisible();
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

  test("the API stays available under /v1 next to the app", async ({ request }) => {
    const index = await request.get("/v1");
    expect((await index.json()).apiVersion).toBe("v1");
    const shell = await request.get("/explore", { headers: { accept: "text/html" } });
    expect(shell.headers()["content-security-policy"]).toContain("default-src 'self'");
  });
});
