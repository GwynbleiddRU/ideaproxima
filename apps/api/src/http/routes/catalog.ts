import { Hono } from "hono";
import { sql } from "drizzle-orm";
import {
  ActivityQuery,
  CreateTopicRequest,
  SearchQuery,
  TopicTranslationRequest,
  buildOpenApiDocument,
  type ApiIndexResponse,
  type HealthResponse,
} from "@ideaproxima/contracts";
import { LOCALES } from "@ideaproxima/i18n";
import * as catalog from "../../modules/catalog/service";
import * as history from "../../modules/history/service";
import { search } from "../../modules/search/service";
import type { AppEnv } from "../env";
import { recordDatabaseError } from "../errors";
import { localizedResponseHeaders, requestLocale } from "../locale";
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
    locales: "/v1/locales",
    ideas: "/v1/ideas",
    topics: "/v1/topics",
    search: "/v1/search?q={query}",
    activity: "/v1/activity",
  },
};

export const catalogRoutes = new Hono<AppEnv>()
  .get("/", (c) => c.json(API_INDEX))
  .get("/openapi.json", (c) => c.json((openApiDocument ??= buildOpenApiDocument())))
  // Public contract: this endpoint reports database connectivity only.
  .get("/health", async (c) => {
    try {
      await c.get("ctx").db.execute(sql`select 1`);
      return c.json<HealthResponse>({ ok: true, database: "up" });
    } catch (error) {
      recordDatabaseError(error);
      return c.json<HealthResponse>({ ok: false, database: "down" }, 503);
    }
  })
  .get("/locales", (c) =>
    c.json(LOCALES.map(({ tag, name, direction, status }) => ({ tag, name, direction, status }))),
  )
  .get("/vocabulary", (c) => {
    localizedResponseHeaders(c);
    return c.json(catalog.vocabulary(requestLocale(c)));
  })
  .get("/topics", async (c) => {
    const topics = await catalog.listTopics(c.get("ctx"), requestLocale(c));
    localizedResponseHeaders(c);
    return c.json(topics);
  })
  .post("/topics", async (c) =>
    c.json(await catalog.createTopic(c.get("ctx"), await jsonBody(c, CreateTopicRequest)), 201),
  )
  .get("/topics/:slug", async (c) => {
    const topic = await catalog.getTopic(c.get("ctx"), c.req.param("slug"), requestLocale(c));
    localizedResponseHeaders(c);
    return c.json(topic);
  })
  .put("/topics/:slug/translations/:locale", async (c) =>
    c.json(
      await catalog.putTopicTranslation(
        c.get("ctx"),
        c.req.param("slug"),
        c.req.param("locale"),
        await jsonBody(c, TopicTranslationRequest),
      ),
    ),
  )
  .get("/search", async (c) => {
    const q = queryOf(c, SearchQuery);
    return c.json(await search(c.get("ctx"), q.q, Math.min(q.limit, 25)));
  })
  .get("/activity", async (c) => {
    const q = queryOf(c, ActivityQuery);
    return c.json(await history.globalActivity(c.get("ctx"), q.limit, q.cursor, q.action));
  });
