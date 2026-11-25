import type { Logger } from "pino";
import { sqlState } from "../db/errors";

type ErrorContext =
  | { source: "request"; requestId: string }
  | { source: "uncaughtException" | "unhandledRejection" | "startup" | "shutdown" | "listener" };

export type ErrorReport = ErrorContext & { pgCode?: string };

export interface ErrorReporter {
  report(error: unknown, context: ErrorContext): void;
  flush(): Promise<void>;
}

export interface ErrorTransport {
  send(event: ErrorReport): void;
  flush(): Promise<void>;
}

export function createErrorReporter(logger: Logger, transport?: ErrorTransport): ErrorReporter {
  return {
    report(error, context) {
      // Error messages, stacks and causes can contain SQL, parameters and credentials.
      const event = { ...context, pgCode: sqlState(error) };
      if (context.source === "request") logger.error(event, "unexpected request error");
      else logger.fatal(event, "fatal process error");
      transport?.send(event);
    },
    async flush() {
      await transport?.flush();
    },
  };
}
