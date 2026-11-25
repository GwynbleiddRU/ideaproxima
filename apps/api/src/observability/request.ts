import type { MiddlewareHandler } from "hono";
import { requestId } from "hono/request-id";
import { matchedRoutes } from "hono/route";
import type { Logger } from "pino";
import type { AppEnv } from "../http/env";
import { uuidv7 } from "../lib/ids";
import type { ErrorReporter } from "./errors";
import { httpDuration, httpInFlight, httpRequests } from "./metrics";

const REQUEST_ID_HEADER = "X-Request-Id";
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const HTTP_METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);

// Hono's default validation also accepts short IDs and "=". Supply the validated ID ourselves.
export const identifyRequest: [MiddlewareHandler, MiddlewareHandler] = [
  requestId({
    headerName: "",
    generator: (c) => {
      const inbound = c.req.header(REQUEST_ID_HEADER);
      return inbound && VALID_REQUEST_ID.test(inbound) ? inbound : uuidv7();
    },
  }),
  async (c, next) => {
    c.header(REQUEST_ID_HEADER, c.get("requestId"));
    await next();
  },
];

export function observeRequest(
  logger: Logger,
  logRequests: boolean,
  errorReporter: ErrorReporter,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set("errorReporter", errorReporter);
    const start = performance.now();
    httpInFlight.inc();
    try {
      await next();
    } finally {
      httpInFlight.dec();
    }

    const durationMs = performance.now() - start;
    const method = c.req.method;
    const webRoute = c.get("webRoute");
    const matched = webRoute ? undefined : matchedRoutes(c).findLast((match) => match.method !== "ALL");
    const route = matched?.path ?? "unmatched";
    const { status, headers, body } = c.res;
    const metricMethod = HTTP_METHODS.has(method) ? method : "OTHER";
    httpRequests.inc({ method: metricMethod, route, status });
    httpDuration.observe(
      { method: metricMethod, route, status_class: `${Math.floor(status / 100)}xx` },
      durationMs / 1000,
    );

    const level = webRoute === "static" ? "debug" : "info";
    if (logRequests && logger.isLevelEnabled(level)) {
      const length = headers.get("content-length");
      logger[level](
        {
          requestId: c.get("requestId"),
          method: metricMethod,
          route,
          status,
          durationMs,
          actorId: c.get("ctx")?.actor?.id ?? null,
          bytesOut: body === null || method === "HEAD" ? 0 : length === null ? null : Number(length),
        },
        "request completed",
      );
    }
  };
}
