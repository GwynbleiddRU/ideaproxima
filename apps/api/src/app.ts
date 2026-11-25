import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Logger } from "pino";
import { uniformWeights, type WeightPolicy } from "@ideaproxima/domain";
import type { AppConfig } from "./config";
import type { Database } from "./db/client";
import { SESSION_COOKIE, type AppEnv } from "./http/env";
import { errorResponse, handleError } from "./http/errors";
import { clientAddress } from "./http/client-address";
import { rateLimit } from "./http/rate-limit";
import { setRequestLocale } from "./http/locale";
import { addProbes } from "./http/probes";
import { catalogRoutes } from "./http/routes/catalog";
import { identityRoutes } from "./http/routes/identity";
import { ideaRoutes } from "./http/routes/ideas";
import { resourceRoutes } from "./http/routes/resources";
import { webApp } from "./http/web";
import { resolveSession } from "./modules/identity/service";
import { createLogger } from "./observability/logger";
import { identifyRequest, observeRequest } from "./observability/request";
import { METRICS_PATH } from "./observability/metrics";
import { createErrorReporter, type ErrorReporter } from "./observability/errors";

export interface AppDeps {
  db: Database;
  config: AppConfig;
  logger?: Logger;
  errorReporter?: ErrorReporter;
  isDraining?: () => boolean;
  /** Evaluator weighting for derived metrics. Defaults to the uniform baseline. */
  weights?: WeightPolicy;
  /** Directory of the built web app to serve at `/` (see http/web.ts). Null or absent: API only. */
  webRoot?: string | null;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Builds the HTTP application. Returns a standard fetch handler (`app.fetch`), so the same API can run as a
 * standalone Node server (src/main.ts), inside a frontend framework's route handler, or in tests via
 * `app.request()` without opening a port.
 *
 * Middleware order matters: request identity → observability → security headers → web app files → CORS → body size limit → network
 * limit → session and locale resolution → auth and write limits → routes. API middleware only runs under /v1.
 * Versioning: additive changes (new fields, endpoints) stay in
 * v1; breaking changes get /v2 alongside, sharing the same services.
 */
export function createApp(deps: AppDeps) {
  const { config } = deps;
  const { http } = config;
  const weights = deps.weights ?? uniformWeights;
  const logger = deps.logger ?? createLogger(config.log);
  const errorReporter = deps.errorReporter ?? createErrorReporter(logger);
  const app = new Hono<AppEnv>();

  app.use("*", ...identifyRequest);
  app.use("*", observeRequest(logger, config.log.requests, errorReporter));
  app.use("*", secureHeaders());
  addProbes(app, deps.db, deps.isDraining ?? (() => false));
  // Keep the public endpoint absent even for browsers that would otherwise receive the SPA shell.
  app.use(METRICS_PATH, async (c) => c.notFound());
  if (deps.webRoot) app.use("*", webApp(deps.webRoot));
  if (http.corsOrigins.length) {
    app.use(
      "*",
      cors({
        origin: http.corsOrigins,
        credentials: true,
        allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
        exposeHeaders: ["X-Request-Id"],
      }),
    );
  }
  app.use(
    "*",
    bodyLimit({
      maxSize: http.maxBodyBytes,
      onError: (c) =>
        errorResponse(c, 413, "payload_too_large", "request_body_too_large", { maximum: http.maxBodyBytes }),
    }),
  );

  app.use("/v1/*", async (c, next) => {
    c.set("config", config);
    await next();
  });
  app.use(
    "/v1/*",
    rateLimit({
      name: "requests",
      perMinute: config.rateLimits.requestsPerMinute,
      key: clientAddress,
    }),
  );

  // Resolve the actor once per API request: Bearer token (API clients) or HttpOnly cookie (browsers).
  app.use("/v1/*", async (c, next) => {
    const header = c.req.header("authorization");
    const token = header?.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : getCookie(c, SESSION_COOKIE);
    const session = token && /^[A-Za-z0-9_-]{43}$/.test(token) ? await resolveSession(deps.db, token) : null;
    c.set("ctx", {
      db: deps.db,
      actor: session?.actor ?? null,
      weights,
      metricsRefreshMode: config.jobs.metricsRefreshMode,
    });
    c.set("sessionId", session?.sessionId ?? null);
    setRequestLocale(c, session?.locale);
    await next();
  });

  // Credential endpoints are limited per client address; every other write per account (or address).
  const authLimit = rateLimit({
    name: "authentication",
    perMinute: config.rateLimits.authPerMinute,
    key: (c) => `auth:${clientAddress(c)}`,
  });
  app.use("/v1/auth/login", authLimit);
  app.use("/v1/auth/register", authLimit);
  app.use(
    "/v1/*",
    rateLimit({
      name: "writes",
      perMinute: config.rateLimits.writesPerMinute,
      key: (c) => {
        if (!WRITE_METHODS.has(c.req.method)) return null;
        const actor = c.get("ctx").actor;
        return actor ? `write:person:${actor.id}` : `write:addr:${clientAddress(c)}`;
      },
    }),
  );

  app.onError(handleError);
  app.notFound((c) => errorResponse(c, 404, "not_found", "unknown_endpoint"));

  // Without a web app (API-only deployments), send people who open the server in a browser to the API index.
  // With one, the web middleware answers `/` first.
  app.get("/", (c) => c.redirect("/v1"));
  app.route("/v1", catalogRoutes);
  app.route("/v1", identityRoutes);
  app.route("/v1", ideaRoutes);
  app.route("/v1", resourceRoutes);
  return app;
}

export type App = ReturnType<typeof createApp>;
