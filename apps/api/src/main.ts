import "./load-env";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { openDatabase } from "./db/client";
import { resolveWebRoot } from "./http/web";

const config = loadConfig();
const database = await openDatabase(config.databaseUrl);
// Embedded PGlite databases are migrated on boot for a zero-step local setup. Real Postgres is migrated
// explicitly (`npm run db:migrate`) as a deploy step, never implicitly by an app instance.
if (database.driver === "pglite") await database.migrate();

// The built web app, served from the same origin. src/main.ts and dist/main.js are both one level below
// apps/api, so this resolves to apps/web/dist either way.
const webRoot = resolveWebRoot(config.webRoot, new URL("../../web/dist", import.meta.url));
const app = createApp({ db: database.db, config, webRoot });
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  const base = `http://localhost:${info.port}`;
  console.info(
    webRoot
      ? `ideaproxima on ${base} (web app + API at /v1, ${database.driver})`
      : `ideaproxima API on ${base}/v1 (${database.driver}; web app not built)`,
  );
});

const shutdown = async () => {
  server.close();
  await database.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
