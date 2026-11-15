/**
 * Loads `apps/api/.env` into `process.env` when the file exists. Variables already set in the environment win,
 * so a container's or CI's configuration is never overridden by a stray file. A missing file is the normal case
 * (containers, CI, production) and stays silent.
 *
 * Imported first, for its side effect, by every entry point (src/main.ts and scripts/*). The path is resolved
 * from this module rather than the working directory, so it is the same file under `tsx` (src/) and in the
 * bundle (dist/).
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
