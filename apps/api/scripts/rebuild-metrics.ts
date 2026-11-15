// Recomputes every derived metric from raw facts. Run after changing the metrics algorithm, or any time to prove
// that derived data is disposable. Uses the baseline (uniform) weight policy.
import "../src/load-env";
import { uniformWeights } from "@ideaproxima/domain";
import { loadConfig } from "../src/config";
import { openDatabase } from "../src/db/client";
import { rebuildAllIdeaMetrics } from "../src/modules/metrics/service";

const database = await openDatabase(loadConfig().databaseUrl);
await database.migrate();
const n = await rebuildAllIdeaMetrics({ db: database.db, actor: null, weights: uniformWeights });
await database.close();
console.info(`Rebuilt metrics for ${n} ideas.`);
