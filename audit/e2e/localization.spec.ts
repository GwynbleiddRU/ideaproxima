import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { IDEA, settle, watchErrors } from "./helpers";

const ideaPath = `/ideas/${IDEA.slug}`;

test("an anonymous reader can switch language on a canonical idea URL", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ideaPath);
  await page.getByRole("button", { name: "Display language" }).click();
  const picker = page.getByRole("dialog");
  await expect(picker.getByRole("radio")).toHaveCount(12);
  await picker.getByRole("radio", { name: /العربية/ }).check();
  await picker.getByRole("button", { name: "Apply language" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page
      .getByText(/\d+ ادعاءات/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(picker).toHaveCount(0, { timeout: 5000 });
  await expect(page).toHaveURL(new RegExp(`${ideaPath}$`));
  const heading = page.getByRole("heading", { name: IDEA.title, exact: true });
  await expect(heading).toHaveAttribute("dir", "auto");
  expect(await heading.evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.goto(`${ideaPath}?hl=ru`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText("Замысел", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Язык интерфейса" }).click();
  await picker.getByRole("radio", { name: /日本語/ }).check();
  await picker.getByRole("button", { name: "Apply language" }).click();
  await expect(page).toHaveURL(/\?hl=ja$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  expect(errors).toEqual([]);
});

test("the account picker saves its preference and an explicit URL overrides it", async ({ page }) => {
  const handle = `locale-${Date.now().toString(36)}`;
  const response = await page.request.post("/v1/auth/register", {
    data: {
      displayName: "Locale Reader",
      handle,
      email: `${handle}@example.test`,
      password: "strong-demo-password",
      locale: "ru",
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/account");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.getByRole("button", { name: "Язык интерфейса" }).last().click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("radio", { name: /हिन्दी/ }).check();
  await page.route("**/v1/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Try again." } } })
      : route.continue(),
  );
  await picker.getByRole("button", { name: "Apply language" }).click();
  await expect(picker.getByRole("alert")).toHaveText("Could not change the display language. Try again.");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.unroute("**/v1/me");
  await picker.getByRole("button", { name: "Apply language" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  const me = await (await page.request.get("/v1/me")).json();
  expect(me.preferences.locale).toBe("hi");
  await page.evaluate(() => localStorage.removeItem("ip-locale"));
  await page.goto("/account?hl=ja");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.goto("/account");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
});

test("the Arabic fixture reaches discovery, the idea layout and each idea tab", async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("ip-locale", "ar"));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).locator("em")).toHaveText("البشرية؟");
  await expect(page.getByPlaceholder("ابحث في الأفكار والادعاءات")).toBeVisible();
  await settle(page);
  await page.screenshot({ path: info.outputPath("home.png"), fullPage: true });

  await page.getByRole("link", { name: "استكشف الأفكار", exact: true }).click();
  await expect(page.getByRole("heading", { name: "استكشف الأفكار" })).toBeVisible();
  await page.getByRole("button", { name: "عوامل التصفية" }).click();
  const filters = page.getByRole("dialog", { name: "عوامل التصفية" });
  await expect(filters.getByPlaceholder("Filter by words in title or text")).toBeVisible();
  await page.keyboard.press("Escape");
  await settle(page);
  await page.screenshot({ path: info.outputPath("explore.png"), fullPage: true });

  await page.goto(ideaPath);
  await expect(page.getByRole("heading", { name: IDEA.title, exact: true })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "أقسام الفكرة" });
  for (const [path, tab, heading] of [
    ["overview", "نظرة عامة", "الجودة المقدّرة"],
    ["evidence", "الادعاءات والأدلة", "الادعاءات والأدلة"],
    ["discussion", "النقاش", "الحجج"],
    ["connections", "الروابط", "الروابط"],
    ["practice", "في الواقع", "المبادرات والنتائج"],
    ["history", "السجل", "سجل المراحل"],
  ] as const) {
    await sections.getByRole("link", { name: new RegExp(tab) }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    if (path === "connections") {
      await expect(page.getByRole("radio", { name: "خطوتان" })).toBeChecked();
    }
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await settle(page);
    await page.screenshot({ path: info.outputPath(`${path}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`Arabic idea page stays readable and accessible in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${ideaPath}?hl=ar`);
    await settle(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual(
      [],
    );
    await page.screenshot({ path: test.info().outputPath(`idea-ar-${colorScheme}.png`), fullPage: true });
  });
}
