import { Hono } from "hono";
import { sql } from "drizzle-orm";
import {
  ActivityQuery,
  CreateTopicRequest,
  SearchQuery,
  buildOpenApiDocument,
  type ApiIndexResponse,
  type HealthResponse,
} from "@ideaproxima/contracts";
import * as catalog from "../../modules/catalog/service";
import * as history from "../../modules/history/service";
import { search } from "../../modules/search/service";
import type { AppEnv } from "../env";
import { jsonBody, queryOf } from "../input";

let openApiDocument: ReturnType<typeof buildOpenApiDocument> | null = null;

const API_INDEX: ApiIndexResponse = {
  name: "Ideaproxima API",
  description: "A collective repository of humanity's possible futures.",
  apiVersion: "v1",
  links: {
    openapi: "/v1/openapi.json",
    health: "/v1/health",
    vocabulary: "/v1/vocabulary",
    ideas: "/v1/ideas",
    topics: "/v1/topics",
    search: "/v1/search?q={query}",
    activity: "/v1/activity",
  },
};

export const catalogRoutes = new Hono<AppEnv>()
  .get("/", (c) => c.json(API_INDEX))
  .get("/openapi.json", (c) => c.json((openApiDocument ??= buildOpenApiDocument())))
  // Readiness: 200 only when the database answers. Use it for load-balancer and container health checks.
  .get("/health", async (c) => {
    try {
      await c.get("ctx").db.execute(sql`select 1`);
      return c.json<HealthResponse>({ ok: true, database: "up" });
    } catch {
      return c.json<HealthResponse>({ ok: false, database: "down" }, 503);
    }
  })
  .get("/vocabulary", (c) => c.json(catalog.vocabulary()))
  .get("/topics", async (c) => c.json(await catalog.listTopics(c.get("ctx"))))
  .post("/topics", async (c) =>
    c.json(await catalog.createTopic(c.get("ctx"), await jsonBody(c, CreateTopicRequest)), 201),
  )
  .get("/topics/:slug", async (c) => c.json(await catalog.getTopic(c.get("ctx"), c.req.param("slug"))))
  .get("/search", async (c) => {
    const q = queryOf(c, SearchQuery);
    return c.json(await search(c.get("ctx"), q.q, Math.min(q.limit, 25)));
  })
  .get("/activity", async (c) => {
    const q = queryOf(c, ActivityQuery);
    return c.json(await history.globalActivity(c.get("ctx"), q.limit, q.cursor, q.action));
  });
