import type { AppConfig } from "../config";
import type { Ctx } from "../modules/shared/context";

export type AppEnv = {
  Variables: {
    ctx: Ctx;
    sessionId: string | null;
    config: AppConfig;
  };
};

export const SESSION_COOKIE = "ip_session";
