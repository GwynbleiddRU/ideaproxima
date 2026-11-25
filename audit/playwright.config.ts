import { defineConfig, devices } from "@playwright/test";

/**
 * Browser audit of the production build: end-to-end flows, accessibility scans, performance budgets and a
 * screenshot set. Runs against an isolated server (audit/server.ts) with a fresh demo database.
 *
 *   npm run test:e2e           build, then every project except screenshots
 *   npm run audit:screenshots  build, then the screenshot set (audit/artifacts/screenshots)
 */
const PORT = Number(process.env.AUDIT_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./artifacts/test-results",
  // One shared database: specs that write data run in order.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "./artifacts/report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx tsx server.ts",
    url: `http://localhost:${PORT}/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "e2e",
      testIgnore: /screenshots\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "screenshots",
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
