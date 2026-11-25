import { once } from "node:events";
import { createServer } from "node:http";
import { expect, it, vi } from "vitest";
import { DomainError } from "@ideaproxima/domain";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { openDatabase } from "../src/db/client";
import { createErrorReporter } from "../src/observability/errors";
import { createLogger } from "../src/observability/logger";
import { createSentryTransport } from "../src/observability/sentry";

const config = loadConfig({ NODE_ENV: "test", LOG_FORMAT: "json" });

it("reports an unexpected request error and excludes expected domain failures", async () => {
  const db = await openDatabase("pglite:memory");
  try {
    const logger = createLogger(config.log, { write: () => {} });
    const send = vi.fn();
    const reporter = createErrorReporter(logger, { send, flush: async () => {} });
    const app = createApp({ db: db.db, config, logger, errorReporter: reporter });
    app.get("/expected", () => {
      throw new DomainError("not_found", "Expected fixture");
    });
    app.get("/unexpected", () => {
      throw Object.assign(new Error("private parameters"), { code: "XX000" });
    });
    expect((await app.request("/expected")).status).toBe(404);
    expect(
      (await app.request("/unexpected", { headers: { "X-Request-Id": "report-fixture-id" } })).status,
    ).toBe(500);
    expect(send.mock.calls).toEqual([
      [{ source: "request", requestId: "report-fixture-id", pgCode: "XX000" }],
    ]);
  } finally {
    await db.close();
  }
});

it("sends a redacted envelope to the configured Sentry endpoint and respects Retry-After", async () => {
  const deliveries: { path?: string; contentType?: string; body: string }[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += String(chunk);
    deliveries.push({ path: request.url, contentType: request.headers["content-type"], body });
    response.writeHead(429, { "Retry-After": "30" }).end();
  });
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const dsn = `http://key@127.0.0.1:${address.port}/prefix/42`;
    const logger = createLogger(config.log, { write: () => {} });
    const reporter = createErrorReporter(logger, createSentryTransport(dsn));
    reporter.report(new Error("credentials and statement"), {
      source: "request",
      requestId: "report-fixture-id",
    });
    await reporter.flush();
    reporter.report(new Error("another private message"), { source: "unhandledRejection" });
    await reporter.flush();
    expect(deliveries).toHaveLength(1);
    const [delivery] = deliveries;
    expect(delivery).toMatchObject({
      path: "/prefix/api/42/envelope/",
      contentType: "application/x-sentry-envelope",
    });
    const [header, item, event] = delivery!.body
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(header).toMatchObject({ dsn, event_id: event.event_id });
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({
      level: "error",
      message: "Unexpected request error",
      tags: { source: "request", request_id: "report-fixture-id" },
    });
    expect(delivery!.body).not.toContain("credentials and statement");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
