import { expect, test } from "@playwright/test";

test("registration waits for the server's retry interval and preserves the form", async ({ page }) => {
  const origin = `http://127.0.0.1:${Number(process.env.AUDIT_PORT ?? 3100) + 1}`;
  await page.goto(origin + "/join");
  const handle = "retry-" + Date.now();
  await page.getByLabel("Name", { exact: true }).fill("Retry test");
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Email").fill(handle + "@example.test");
  await page.getByLabel("Password").fill("long enough for this test");
  // An invalid submission also spends the network budget, without creating a session.
  await page.request.post(origin + "/v1/auth/register", { data: {} });
  const submit = page.getByRole("button", { name: "Create account" });
  const limited = page.waitForResponse((r) => r.url().endsWith("/auth/register") && r.status() === 429);
  await submit.click();
  const response = await limited;
  const headers = response.headers();
  const seconds = Number(headers["retry-after"]);
  expect(headers["ratelimit-policy"]).toBe('"auth.register.1";q=1;w=3, "auth.register.2";q=10;w=86400');
  expect(headers["ratelimit"]).toBe(`"auth.register.1";a=0;w=${seconds}`);
  expect((await response.json()).error.details).toMatchObject({
    policy: "auth.register",
    scope: "network",
    limit: 1,
    periodSeconds: 3,
    retryAfterSeconds: seconds,
  });
  test.info().annotations.push({ type: "Retry-After", description: String(seconds) });
  expect(seconds).toBeGreaterThan(0);
  await expect(page.getByRole("alert")).toContainText(`wait ${seconds} second`);
  await expect(submit).toBeDisabled();
  await page.getByLabel("Password").press("Enter");
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel("Handle")).toHaveValue(handle);
  const success = page.waitForResponse((r) => r.url().endsWith("/auth/register") && r.status() === 201);
  await submit.click();
  await success;
  await expect(page).toHaveURL(origin + "/");
});
