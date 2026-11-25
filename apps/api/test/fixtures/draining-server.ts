import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { createApp } from "../../src/app";
import { loadConfig } from "../../src/config";
import { openDatabase } from "../../src/db/client";
import { createErrorReporter } from "../../src/observability/errors";
import { createLifecycle } from "../../src/observability/lifecycle";
import { createLogger } from "../../src/observability/logger";

const config = loadConfig({
  NODE_ENV: "test",
  LOG_FORMAT: "json",
  SHUTDOWN_DELAY_MS: process.argv[2],
  SHUTDOWN_TIMEOUT_MS: process.argv[3],
});
const logger = createLogger(config.log);
const errorReporter = createErrorReporter(logger);
const lifecycle = createLifecycle(config.http, logger, errorReporter);
const database = await openDatabase("pglite:memory", config.db);
await database.migrate();
const app = createApp({ db: database.db, config, errorReporter, logger, isDraining: lifecycle.isDraining });

let release!: () => void;
const released = new Promise<void>((resolve) => {
  release = resolve;
});
app.get("/slow-fixture", async (c) => {
  process.send?.({ type: "inFlight" });
  await released;
  await database.db.execute(sql`select 1`);
  logger.info("fixture request finished");
  return c.text("finished with database");
});

const server = serve(
  {
    fetch: (request, env) => lifecycle.trackRequest(app.fetch(request, env)),
    port: 0,
    hostname: "127.0.0.1",
  },
  ({ port }) => {
    process.send?.({ type: "listening", port });
  },
);
lifecycle.watch([server], {
  ...database,
  async close(force) {
    await database.close(force);
    logger.info({ force }, "fixture database closed");
  },
});
process.on("message", (message) => {
  if (message === "terminate") process.emit("SIGTERM", "SIGTERM");
  if (message === "release") release();
  if (message === "uncaughtException") throw new Error("private fatal fixture body");
  if (message === "unhandledRejection") void Promise.reject(new Error("private fatal fixture body"));
});
