import { Server } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import type { ServerType } from "@hono/node-server";
import type { Logger } from "pino";
import type { AppConfig } from "../config";
import type { DatabaseHandle } from "../db/client";
import type { ErrorReporter } from "./errors";

async function withinDeadline(work: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([work.then(() => true), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export function createLifecycle(http: AppConfig["http"], logger: Logger, reporter: ErrorReporter) {
  const active = new Set<Promise<unknown>>();
  let draining = false;
  let fatal = false;

  function exitFatally(
    error: unknown,
    source: "uncaughtException" | "unhandledRejection" | "startup" | "shutdown" | "listener",
  ) {
    if (fatal) return;
    fatal = true;
    draining = true;
    reporter.report(error, { source });
    void reporter.flush().finally(() => process.exit(1));
  }
  process.on("uncaughtException", (error) => exitFatally(error, "uncaughtException"));
  process.on("unhandledRejection", (error) => exitFatally(error, "unhandledRejection"));

  return {
    isDraining: () => draining,
    exitFatally,
    async trackRequest<T>(result: T | Promise<T>): Promise<T> {
      // A disconnected client can leave its handler running after the socket has closed.
      const task = Promise.resolve(result);
      active.add(task);
      try {
        return await task;
      } finally {
        active.delete(task);
      }
    },
    watch(
      servers: readonly ServerType[],
      database: DatabaseHandle,
      worker?: { stop(): Promise<void>; release(): Promise<void> },
    ) {
      for (const server of servers) server.on("error", (error) => exitFatally(error, "listener"));

      const shutdown = async () => {
        if (draining) return;
        draining = true;
        logger.info("server draining");
        if (worker) active.add(worker.stop());
        await delay(http.shutdownDelayMs);
        const closed = Promise.all(
          servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
        );
        const drained = await withinDeadline(
          closed.then(() => Promise.allSettled(active)),
          http.shutdownTimeoutMs,
        );
        if (!drained) {
          logger.warn("shutdown request deadline exceeded");
          for (const server of servers) {
            if (server instanceof Server) server.closeAllConnections();
          }
          // A handler can be holding the last pool connection. Keep cleanup bounded;
          // the database lease is also reclaimable after a hard process failure.
          if (worker && !(await withinDeadline(worker.release(), 1000).catch(() => false))) {
            logger.warn("unfinished job leases will expire in the database");
          }
        }
        await database.close(!drained);
        await reporter.flush();
        if (!fatal) process.exit(0);
      };
      const onSignal = () => void shutdown().catch((error) => exitFatally(error, "shutdown"));
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
    },
  };
}
