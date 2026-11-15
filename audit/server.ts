/**
 * A fresh, isolated ideaproxima for browser tests: a throwaway PGlite database seeded with the demo data,
 * serving the production build (apps/web/dist + apps/api/dist; `npm run build` first) on port 3100.
 * Rate limits are off so tests can sign in repeatedly. It never touches apps/api/.data.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = mkdtempSync(join(tmpdir(), "ipx-audit-"));
const env = {
  ...process.env,
  DATABASE_URL: `pglite:${dataDir}`,
  PORT: process.env.AUDIT_PORT ?? "3100",
  NODE_ENV: "production",
  COOKIE_SECURE: "false",
  LOG_REQUESTS: "false",
  RATE_LIMIT_AUTH_PER_MINUTE: "0",
  RATE_LIMIT_WRITES_PER_MINUTE: "0",
  WEB_ROOT: join(root, "apps/web/dist"),
};

const seed = spawnSync(process.execPath, [join(root, "apps/api/dist/seed.js"), "--demo"], {
  env,
  stdio: "inherit",
});
if (seed.status !== 0) {
  console.error("Seeding failed. Did you run `npm run build`?");
  process.exit(seed.status ?? 1);
}

const server = spawn(process.execPath, [join(root, "apps/api/dist/main.js")], { env, stdio: "inherit" });

let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  server.kill();
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 3 });
}
server.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, cleanup);
process.on("exit", cleanup);
