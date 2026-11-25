import "./load-env";
import { uniformWeights } from "@ideaproxima/domain";
import { loadConfig } from "./config";
import { openDatabase } from "./db/client";
import { startWorker } from "./modules/jobs/runner";
import { createErrorReporter } from "./observability/errors";
import { startMetricsServer } from "./observability/internal-server";
import { createLifecycle } from "./observability/lifecycle";
import { createLogger } from "./observability/logger";

const config = loadConfig();
const logger = createLogger(config.log);
if (config.jobs.mode === "worker") {
  const transport = config.log.sentryDsn
    ? (await import("./observability/sentry")).createSentryTransport(config.log.sentryDsn)
    : undefined;
  const lifecycle = createLifecycle(
    { ...config.http, shutdownDelayMs: 0 },
    logger,
    createErrorReporter(logger, transport),
  );
  try {
    const database = await openDatabase(config.db.url, {
      ...config.db,
      statementTimeoutMs: config.jobs.statementTimeoutMs,
    });
    const worker = await startWorker(
      { db: database.db, actor: null, weights: uniformWeights },
      config.jobs,
      logger,
    );
    const servers = config.http.internalPort
      ? [startMetricsServer(config.http.internalPort, database.db)]
      : [];
    lifecycle.watch(servers, database, worker);
    logger.info({ jobs: config.jobs }, "job worker started");
  } catch (error) {
    lifecycle.exitFatally(error, "startup");
  }
} else {
  logger.info({ mode: config.jobs.mode }, "Dedicated worker requires JOBS_MODE=worker");
}
