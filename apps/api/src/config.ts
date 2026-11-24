import { validateHeaderName } from "node:http";

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
  trustProxyHops: number;
  clientIpHeader?: string;
  rateLimitIpv6Prefix: number;
  /** Maximum JSON request body size in bytes. */
  maxBodyBytes: number;
  /** Built web app to serve: a directory, "off", or undefined for the default (apps/web/dist when built). */
  webRoot: string | undefined;
  /** Per-minute request budgets. 0 disables a limit. In-memory: per process, reset on restart. */
  rateLimits: {
    requestsPerMinute: number;
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

function integerSetting(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}.`);
  return n;
}

/** One shared budget for every password operation in this process. */
export function loadPasswordHashLimits(env: NodeJS.ProcessEnv = process.env) {
  return {
    concurrency: integerSetting(env, "PASSWORD_HASH_CONCURRENCY", 3, 1),
    queue: integerSetting(env, "PASSWORD_HASH_QUEUE", 32),
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === "production";
  const legacyProxy = bool(env.TRUST_PROXY, false);
  if (legacyProxy) console.warn("TRUST_PROXY is deprecated. Set TRUST_PROXY_HOPS explicitly.");
  const clientIpHeader = env.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined;
  if (clientIpHeader) validateHeaderName(clientIpHeader);
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
    trustProxyHops: integerSetting(env, "TRUST_PROXY_HOPS", legacyProxy ? 1 : 0),
    clientIpHeader,
    rateLimitIpv6Prefix: integerSetting(env, "RATE_LIMIT_IPV6_PREFIX", 64, 0, 128),
    maxBodyBytes: int(env.MAX_BODY_BYTES, 1_048_576),
    webRoot: env.WEB_ROOT || undefined,
    rateLimits: {
      requestsPerMinute: integerSetting(env, "RATE_LIMIT_REQUESTS_PER_MINUTE", 600),
      authPerMinute: int(env.RATE_LIMIT_AUTH_PER_MINUTE, 10),
      writesPerMinute: int(env.RATE_LIMIT_WRITES_PER_MINUTE, 120),
    },
  };
}
