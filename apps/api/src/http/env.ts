import type { AppConfig } from "../config";
import type { Ctx } from "../modules/shared/context";
import type { Logger } from "pino";

export type AppEnv = {
  Variables: {
    ctx: Ctx;
    sessionId: string | null;
    config: AppConfig;
    logger: Logger;
    webRoute?: "static" | "web";
  };
};

export const SESSION_COOKIE = "ip_session";
