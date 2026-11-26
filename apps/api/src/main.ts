import "./load-env";
import { serve } from "@hono/node-server";
import { uniformWeights } from "@ideaproxima/domain";
import { startWorker } from "./modules/jobs/runner";
import { workerMail } from "./modules/mail/sender";
import { version } from "../package.json";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { openDatabase } from "./db/client";
import { resolveWebRoot } from "./http/web";
import { createLogger } from "./observability/logger";
import { startMetricsServer } from "./observability/internal-server";
import { createErrorReporter } from "./observability/errors";
import { createLifecycle } from "./observability/lifecycle";

const warnings: string[] = [];
const config = loadConfig(process.env, (warning) => warnings.push(warning));
const logger = createLogger(config.log);
for (const warning of warnings) logger.warn(warning);

const sentry = config.log.sentryDsn
  ? (await import("./observability/sentry")).createSentryTransport(config.log.sentryDsn)
  : undefined;
const errorReporter = createErrorReporter(logger, sentry);
const lifecycle = createLifecycle(config.http, logger, errorReporter);

try {
  const database = await openDatabase(config.db.url, config.db);
  // PGlite is migrated on boot for local setup. PostgreSQL migrations run as a release step.
  if (database.driver === "pglite") await database.migrate();

  // src/main.ts and dist/main.js both resolve this URL to the built web app.
  const webRoot = resolveWebRoot(config.http.webRoot, new URL("../../web/dist", import.meta.url));
  const app = createApp({
    db: database.db,
    config,
    webRoot,
    logger,
    errorReporter,
    isDraining: lifecycle.isDraining,
  });
  const server = serve(
    { fetch: (request, env) => lifecycle.trackRequest(app.fetch(request, env)), port: config.http.port },
    (info) => {
      logger.info(
        {
          version,
          commit: config.commit,
          driver: database.driver,
          config: {
            environment: config.environment,
            http: {
              ...config.http,
              port: info.port,
              corsOrigins: config.http.corsOrigins.length,
              webRoot: webRoot ? "[redacted]" : "off",
            },
            db: { ...config.db, url: "[redacted]" },
            rateLimits: { enabled: config.rateLimits.enabled, store: config.rateLimits.store },
            jobs: config.jobs,
            passwordHash: config.passwordHash,
            log: { ...config.log, sentryDsn: sentry ? "[redacted]" : undefined },
          },
        },
        "server listening",
      );
    },
  );
  const servers = [server];
  if (config.http.internalPort !== undefined)
    servers.push(startMetricsServer(config.http.internalPort, database.db));
  const worker =
    config.jobs.mode === "inline"
      ? await startWorker(
          { db: database.db, actor: null, weights: uniformWeights, mail: workerMail(config) },
          config.jobs,
          logger,
        )
      : undefined;
  lifecycle.watch(servers, database, worker);
} catch (error) {
  lifecycle.exitFatally(error, "startup");
}
