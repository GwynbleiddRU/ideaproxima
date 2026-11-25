import "../src/load-env";
import { uniformWeights } from "@ideaproxima/domain";
import { loadConfig } from "../src/config";
import { openDatabase } from "../src/db/client";
import { jobStates } from "../src/db/schema";
import { isUuid } from "../src/lib/ids";
import { listJobs, purgeJobs, retryFailed } from "../src/modules/jobs/operator";
import type { Ctx } from "../src/modules/shared/context";

async function command(ctx: Ctx, args: string[]) {
  const [action, flag, value] = args;
  if (action === "list" && (args.length === 1 || (args.length === 3 && flag === "--state"))) {
    const state = jobStates.find((s) => s === (value ?? "failed"));
    if (state) return console.info(JSON.stringify(await listJobs(ctx, state), null, 2));
  }
  if (action === "retry") {
    if (args.length === 2 && flag && isUuid(flag)) return console.info(await retryFailed(ctx, { id: flag }));
    if (args.length === 3 && flag === "--kind" && value)
      return console.info(await retryFailed(ctx, { kind: value }));
  }
  if (action === "purge" && args.length === 1) return console.info("Purged jobs:", await purgeJobs(ctx));
  throw new Error(
    "Usage: jobs list [--state pending|running|done|failed] | retry <id> | retry --kind <kind> | purge",
  );
}

const config = loadConfig();
const database = await openDatabase(config.db.url, {
  ...config.db,
  statementTimeoutMs: config.jobs.statementTimeoutMs,
});
try {
  await command({ db: database.db, actor: null, weights: uniformWeights }, process.argv.slice(2));
} finally {
  await database.close();
}
