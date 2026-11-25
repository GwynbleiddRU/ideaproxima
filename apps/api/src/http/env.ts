import type { Locale } from "@ideaproxima/i18n";
import type { AppConfig } from "../config";
import type { LoginFailureBudget } from "../modules/identity/service";
import type { Ctx } from "../modules/shared/context";
import type { ErrorReporter } from "../observability/errors";

export type AppEnv = {
  Variables: {
    ctx: Ctx;
    sessionId: string | null;
    locale?: Locale;
    config: AppConfig;
    loginFailureBudget?: LoginFailureBudget;
    errorReporter: ErrorReporter;
    webRoute?: "static" | "web";
  };
};

export const SESSION_COOKIE = "ip_session";
