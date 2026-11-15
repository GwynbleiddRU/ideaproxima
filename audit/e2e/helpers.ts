import { expect, type Page } from "@playwright/test";

export const DEMO = {
  email: "demo-mira@demo.ideaproxima.invalid",
  password: "demo-password-123",
  handle: "demo-mira",
};
export const IDEA = { slug: "water-cleaning-nanorobots", title: "Water-cleaning nanorobots" };

/**
 * Collects console errors and uncaught exceptions. The one expected browser message — the 401 from `GET /v1/me`
 * that tells the app a visitor is anonymous — is ignored; anything else fails the test.
 */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/status of 401/.test(text) && /\/v1\/me\b/.test(message.location().url ?? "")) return;
    if (/status of 401/.test(text) && !message.location().url) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Signs in through the API; the session cookie lands in the page's browser context. */
export async function signIn(page: Page, credentials: { email: string; password: string } = DEMO) {
  const response = await page.request.post("/v1/auth/login", { data: credentials });
  expect(response.ok()).toBe(true);
}

/** Waits until the page has rendered its data and fonts (for stable screenshots and measurements). */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}
