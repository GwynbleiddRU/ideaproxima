import { randomUUID } from "node:crypto";
import type { ErrorReport, ErrorTransport } from "./errors";

/** Minimal, opt-in Sentry envelope transport. Only the sanitized event crosses this boundary. */
export function createSentryTransport(dsn: string): ErrorTransport {
  const url = new URL(dsn);
  const parts = url.pathname.replace(/\/$/, "").split("/");
  const projectId = parts.pop()!;
  const endpoint = new URL(url.origin);
  endpoint.pathname = `${parts.join("/")}/api/${projectId}/envelope/`;
  const pending = new Set<Promise<void>>();
  let limitedUntil = 0;

  async function send(event: ErrorReport) {
    const eventId = randomUUID().replaceAll("-", "");
    const body = [
      JSON.stringify({ event_id: eventId, dsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        event_id: eventId,
        timestamp: Date.now() / 1_000,
        platform: "node",
        level: event.source === "request" ? "error" : "fatal",
        message: event.source === "request" ? "Unexpected request error" : "Fatal process error",
        tags: {
          source: event.source,
          pg_code: event.pgCode,
          request_id: event.source === "request" ? event.requestId : undefined,
        },
      }),
      "",
    ].join("\n");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(1_000),
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") ?? "60";
      const seconds = Number(retryAfter);
      const expires = Number.isFinite(seconds) ? Date.now() + seconds * 1_000 : Date.parse(retryAfter);
      limitedUntil = Math.max(limitedUntil, Number.isFinite(expires) ? expires : Date.now() + 60_000);
    }
    await response.body?.cancel();
  }

  return {
    send(event) {
      if (pending.size >= 4 || Date.now() < limitedUntil) return;
      const task = send(event)
        .catch(() => {})
        .finally(() => pending.delete(task));
      pending.add(task);
    },
    async flush() {
      await Promise.all(pending);
    },
  };
}
