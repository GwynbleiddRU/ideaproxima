import "./load-env";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { openDatabase } from "./db/client";
import { resolveWebRoot } from "./http/web";
import { createLogger } from "./observability/logger";
import { startMetricsServer } from "./observability/internal-server";

const warnings: string[] = [];
const config = loadConfig(process.env, (warning) => warnings.push(warning));
const logger = createLogger(config.log);
for (const warning of warnings) logger.warn(warning);

const database = await openDatabase(config.db.url);
// Embedded PGlite databases are migrated on boot for a zero-step local setup. Real Postgres is migrated
// explicitly (`npm run db:migrate`) as a deploy step, never implicitly by an app instance.
if (database.driver === "pglite") await database.migrate();

// The built web app, served from the same origin. src/main.ts and dist/main.js are both one level below
// apps/api, so this resolves to apps/web/dist either way.
const webRoot = resolveWebRoot(config.http.webRoot, new URL("../../web/dist", import.meta.url));
const app = createApp({ db: database.db, config, webRoot, logger });
const server = serve({ fetch: app.fetch, port: config.http.port }, (info) => {
  logger.info({ port: info.port, driver: database.driver, web: Boolean(webRoot) }, "server listening");
});
const metricsServer =
  config.http.internalPort === undefined ? undefined : startMetricsServer(config.http.internalPort);

const shutdown = async () => {
  server.close();
  metricsServer?.close();
  await database.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
