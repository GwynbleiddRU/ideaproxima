import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Database } from "../db/client";
import { collectQueueDepth } from "../modules/jobs/metrics";
import { identifyRequest } from "./request";
import { METRICS_PATH, registry } from "./metrics";

export function startMetricsServer(port: number, db: Database) {
  const app = new Hono();
  app.use("*", ...identifyRequest);
  app.get(METRICS_PATH, async (c) => {
    await collectQueueDepth(db);
    return c.body(await registry.metrics(), 200, { "Content-Type": registry.contentType });
  });
  return serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
}
