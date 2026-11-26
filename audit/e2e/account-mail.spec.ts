import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

for (const mode of ["immediate", "verified-first"])
  test("account mail through the browser in " + mode + " mode", async ({ page }) => {
    // This process owns its own mailbox and in-memory database, including the real inline worker.
    const port = Number(process.env.AUDIT_PORT ?? 3100) + 2;
    const origin = "http://127.0.0.1:" + port;
    const server = spawn(
      process.execPath,
      [fileURLToPath(new URL("../../apps/api/dist/main.js", import.meta.url))],
      {
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          DATABASE_URL: "pglite:memory",
          JOBS_MODE: "inline",
          REGISTRATION_MODE: mode,
          REGISTRATION_CHALLENGE: "none",
          RATE_LIMITS: "off",
          MAIL_TRANSPORT: "log",
          PUBLIC_BASE_URL: origin,
          LOG_REQUESTS: "false",
          SHUTDOWN_DELAY_MS: "0",
        },
        stdio: ["ignore", "pipe", "inherit"],
        windowsHide: true,
      },
    );
    const links: string[] = [];
    const lines = createInterface({ input: server.stdout });
    lines.on("line", (line) => {
      if (line.startsWith(origin + "/")) links.push(line.trim());
    });
    const nextLink = async (path: string) => {
      const find = () => links.findLast((link) => new URL(link).pathname === path);
      await expect.poll(find, { timeout: 15000 }).toBeTruthy();
      return find()!;
    };
    const email = "browser@example.test",
      password = "long browser password",
      newEmail = "updated@example.test";
    async function login(address: string, pass: string) {
      await page.goto(origin + "/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(address);
      await page.getByLabel("Password", { exact: true }).fill(pass);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
    }
    try {
      await expect
        .poll(
          async () => {
            try {
              return (await page.request.get(origin + "/readyz")).status();
            } catch {
              return 0;
            }
          },
          { timeout: 20000 },
        )
        .toBe(200);
      await page.goto(origin + "/join");
      await page.getByLabel("Name", { exact: true }).fill("Browser Reader");
      await page.getByLabel("Handle").fill("browser-reader");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Create account" }).click();
      if (mode === "verified-first")
        await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
      else {
        await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
        await page.goto(origin + "/account");
        await expect(page.getByRole("button", { name: "Resend verification email" })).toBeVisible();
      }
      await page.goto(await nextLink("/verify-email"));
      await page.getByRole("button", { name: "Verify email address" }).click();
      await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
      if (mode === "verified-first") await login(email, password);
      await page.goto(origin + "/account");
      await page.getByRole("link", { name: "Change email address" }).click();
      await page.getByLabel("New email address").fill(newEmail);
      await page.getByLabel("Current password").fill(password);
      await page.getByRole("button", { name: "Send confirmation link" }).click();
      await expect(page.getByRole("heading", { name: "Check your new inbox" })).toBeVisible();
      await page.goto(await nextLink("/confirm-email-change"));
      await page.getByRole("button", { name: "Confirm email change" }).click();
      await expect(page.getByRole("heading", { name: "Email address updated" })).toBeVisible();
      await page.goto(origin + "/account");
      await expect(page.getByText(newEmail, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await page.goto(origin + "/sign-in");
      await page.getByRole("link", { name: "Forgot your password?" }).click();
      await page.getByLabel("Email address").fill(newEmail);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
      const url = await nextLink("/reset-password");
      await page.goto(url);
      await page.getByLabel("New password").fill("new browser password");
      await page.getByRole("button", { name: "Reset password" }).click();
      await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
      await page.goto(url);
      await page.getByLabel("New password").fill("another browser password");
      await page.getByRole("button", { name: "Reset password" }).click();
      await expect(page.getByRole("heading", { name: "This link has already been used" })).toBeVisible();
      await login(newEmail, "new browser password");
    } finally {
      lines.close();
      if (server.exitCode === null && server.signalCode === null) {
        const exited = once(server, "exit");
        server.kill();
        await exited;
      }
    }
  });
