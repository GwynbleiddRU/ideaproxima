/**
 * Test runner used by `npm test` and `npm run test:pg`.
 *
 *   npm test                       all tests on in-process PGlite
 *   npm run test:pg                all tests on a real PostgreSQL server (docker compose up -d postgres)
 *   npm test -- apps/api/test/x    a subset (endpoint coverage is only enforced for full runs)
 *
 * Besides running Vitest it enforces ENDPOINT COVERAGE: the integration harness records every catalogued endpoint
 * it calls, and a full run fails if any endpoint in the catalogue was never exercised. Together with the contract
 * check in the harness this keeps the API, its tests and its documentation in lockstep.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENDPOINTS } from "@ideaproxima/contracts";

const args = process.argv.slice(2);
const postgres = args.includes("--postgres");
const vitestArgs = args.filter((a) => a !== "--postgres");
const fullRun = vitestArgs.every((a) => a.startsWith("-"));

const dir = mkdtempSync(join(tmpdir(), "ipx-contract-"));
const coverageFile = join(dir, "endpoints.txt");
writeFileSync(coverageFile, "");

const env: NodeJS.ProcessEnv = { ...process.env, CONTRACT_COVERAGE_FILE: coverageFile };
if (postgres) env.TEST_DATABASE_URL ??= "postgres://ideaproxima:ideaproxima@localhost:5433/postgres";
else delete env.TEST_DATABASE_URL;

const result = spawnSync("npx", ["vitest", "run", ...vitestArgs], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
let status = result.status ?? 1;

if (status === 0 && fullRun) {
  const exercised = new Set(readFileSync(coverageFile, "utf8").split(/\r?\n/).filter(Boolean));
  const missing = Object.keys(ENDPOINTS).filter((name) => !exercised.has(name));
  if (missing.length) {
    console.error(
      `\nEndpoint coverage: ${missing.length} catalogued endpoint(s) never exercised by the tests:`,
    );
    for (const name of missing) console.error(`  - ${name}`);
    status = 1;
  } else {
    console.info(
      `\nEndpoint coverage: all ${Object.keys(ENDPOINTS).length} catalogued endpoints exercised and contract-checked.`,
    );
  }
}

rmSync(dir, { recursive: true, force: true });
process.exit(status);
