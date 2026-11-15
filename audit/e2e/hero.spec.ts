import { expect, test } from "@playwright/test";
import { settle } from "./helpers";

/**
 * The home hero fills exactly the visible area under the header, and everything in it — headline, search and
 * both calls to action — is visible without scrolling, on common screens from small phones to large desktops.
 */
const SCREENS = [
  { name: "desktop 1440×900", width: 1440, height: 900 },
  { name: "laptop 1366×768", width: 1366, height: 768 },
  { name: "small laptop 1280×720", width: 1280, height: 720 },
  { name: "tablet 1024×768", width: 1024, height: 768 },
  { name: "tablet portrait 768×1024", width: 768, height: 1024 },
  { name: "phone 390×844", width: 390, height: 844 },
  { name: "small phone 360×740", width: 360, height: 740 },
];

for (const screen of SCREENS) {
  test(`hero fits the first screen: ${screen.name}`, async ({ page }) => {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await page.goto("/");
    await settle(page);

    const header = await page.locator("header").first().boundingBox();
    const hero = await page.getByRole("region", { name: "What could humanity become?" }).boundingBox();
    expect(header && hero).toBeTruthy();
    // Exactly the visible area under the header (±1px for sub-pixel rounding).
    expect(Math.abs(hero!.height - (screen.height - header!.height))).toBeLessThanOrEqual(1);

    for (const element of [
      page.getByRole("heading", { level: 1 }),
      page.getByRole("searchbox", { name: "Search the archive" }),
      page.getByRole("link", { name: "Explore ideas" }),
      page.getByRole("link", { name: /Propose an idea/ }).last(),
    ]) {
      await expect(element).toBeInViewport({ ratio: 1 });
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0);
  });
}

test("the hero search finds things, and / focuses it", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Search the archive" });
  await expect(search).toBeFocused();
  await search.fill("water");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=water/);
});

test("a click anywhere in the search field, the shortcut hint included, focuses it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await settle(page);
  const search = page.getByRole("searchbox", { name: "Search the archive" });
  const form = page.getByRole("search");
  await form.locator("kbd").click();
  await expect(search).toBeFocused();
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await expect(search).not.toBeFocused();
  await form.locator("svg").first().click();
  await expect(search).toBeFocused();
});

test("the scroll cue leads to the ways to discover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await settle(page);
  await page.getByRole("link", { name: "Ways to discover" }).click();
  await expect(page.getByRole("heading", { name: "Many ways to look, never one ranking" })).toBeInViewport();
});
