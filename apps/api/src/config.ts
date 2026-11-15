/**
 * Runtime configuration from environment variables. Every value has a safe local-development default; see
 * apps/api/.env.example and docs/developer/operations.md for the production checklist.
 */
export interface AppConfig {
  /** pglite:<dir> (default, zero-infrastructure), pglite:memory, or postgres://… */
  databaseUrl: string;
  port: number;
  sessionTtlDays: number;
  /** Secure (HTTPS-only) cookies. Defaults to true in production. */
  cookieSecure: boolean;
  /** Origins allowed to call the API from a browser with credentials. Empty = same-origin only. */
  corsOrigins: string[];
  /** Log one line per request. */
  logRequests: boolean;
  /** Trust X-Forwarded-For for the client address (only behind a reverse proxy you control). */
  trustProxy: boolean;
  /** Maximum JSON request body size in bytes. */
  maxBodyBytes: number;
  /** Built web app to serve: a directory, "off", or undefined for the default (apps/web/dist when built). */
  webRoot: string | undefined;
  /** Per-minute request budgets. 0 disables a limit. In-memory: per process, reset on restart. */
  rateLimits: {
    /** Login and registration attempts per client address. */
    authPerMinute: number;
    /** Mutating requests per account (or per client address when anonymous). */
    writesPerMinute: number;
  };
}

const int = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
};
const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined || value === "" ? fallback : value === "true" || value === "1";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === "production";
  return {
    databaseUrl: env.DATABASE_URL || "pglite:./.data/pglite",
    port: int(env.PORT, 3000),
    sessionTtlDays: int(env.SESSION_TTL_DAYS, 30),
    cookieSecure: bool(env.COOKIE_SECURE, production),
    corsOrigins: (env.CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    logRequests: bool(env.LOG_REQUESTS, env.NODE_ENV !== "test"),
    trustProxy: bool(env.TRUST_PROXY, false),
    maxBodyBytes: int(env.MAX_BODY_BYTES, 1_048_576),
    webRoot: env.WEB_ROOT || undefined,
    rateLimits: {
      authPerMinute: int(env.RATE_LIMIT_AUTH_PER_MINUTE, 10),
      writesPerMinute: int(env.RATE_LIMIT_WRITES_PER_MINUTE, 120),
    },
  };
}
