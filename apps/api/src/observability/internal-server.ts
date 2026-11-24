import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { identifyRequest } from "./request";
import { METRICS_PATH, registry } from "./metrics";

export function startMetricsServer(port: number) {
  const app = new Hono();
  app.use("*", ...identifyRequest);
  app.get(METRICS_PATH, async (c) =>
    c.body(await registry.metrics(), 200, { "Content-Type": registry.contentType }),
  );
  return serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
}
