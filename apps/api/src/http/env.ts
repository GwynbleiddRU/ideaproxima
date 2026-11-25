import type { AppConfig } from "../config";
import type { Ctx } from "../modules/shared/context";
import type { ErrorReporter } from "../observability/errors";

export type AppEnv = {
  Variables: {
    ctx: Ctx;
    sessionId: string | null;
    config: AppConfig;
    errorReporter: ErrorReporter;
    webRoute?: "static" | "web";
  };
};

export const SESSION_COOKIE = "ip_session";
