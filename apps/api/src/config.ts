import { validateHeaderName } from "node:http";
import { z } from "zod";

function integer(min: number, max = Number.MAX_SAFE_INTEGER) {
  return z
    .string()
    .trim()
    .refine((raw) => /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= max, {
      error: ({ input }) => `expected an integer from ${min} to ${max}, received ${JSON.stringify(input)}`,
    })
    .transform(Number);
}

const boolean = z
  .enum(["true", "false", "1", "0"], { error: "expected true, false, 1 or 0" })
  .transform((raw) => raw === "true" || raw === "1");

const databaseUrl = z.string().refine(
  (raw) => {
    if (raw.startsWith("pglite:")) return raw.slice("pglite:".length).trim().length > 0;
    return /^postgres(?:ql)?:\/\//.test(raw) && URL.canParse(raw);
  },
  { error: "expected a PostgreSQL URL or a nonempty pglite: location" },
);

const headerName = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => {
    if (!value) return true;
    try {
      validateHeaderName(value);
      return true;
    } catch {
      return false;
    }
  }, "expected an HTTP header name");

const origins = z
  .string()
  .transform((raw) =>
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )
  .refine(
    (values) => values.every((value) => /^https?:\/\//.test(value) && URL.parse(value)?.origin === value),
    "expected comma-separated HTTP(S) origins",
  );

const envSettings = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  APP_COMMIT: z
    .string()
    .regex(/^(?:[0-9a-f]{7,64}|unknown)$/i, "expected a Git commit hash or unknown")
    .default("unknown"),
  DATABASE_URL: databaseUrl.default("pglite:./.data/pglite"),
  ALLOW_PGLITE_IN_PRODUCTION: boolean.default(false),
  DB_POOL_MAX: integer(1, 2_147_483_647).default(10),
  DB_STATEMENT_TIMEOUT_MS: integer(0, 2_147_483_647).default(5_000),
  DB_LOCK_TIMEOUT_MS: integer(0, 2_147_483_647).default(3_000),
  DB_IDLE_IN_TX_TIMEOUT_MS: integer(0, 2_147_483_647).default(10_000),
  DB_CONNECT_TIMEOUT_MS: integer(1, 2_147_483_647).default(5_000),
  PORT: integer(0, 65_535).default(3000),
  INTERNAL_PORT: integer(1, 65_535).optional(),
  SHUTDOWN_DELAY_MS: integer(0, 2_147_483_647).default(5_000),
  SHUTDOWN_TIMEOUT_MS: integer(1, 2_147_483_647).default(25_000),
  SESSION_TTL_DAYS: integer(1).default(30),
  COOKIE_SECURE: boolean.optional(),
  ALLOW_INSECURE_COOKIES: boolean.default(false),
  CORS_ORIGINS: origins.default([]),
  TRUST_PROXY_HOPS: integer(0).optional(),
  TRUST_PROXY: boolean.default(false),
  CLIENT_IP_HEADER: headerName.optional(),
  RATE_LIMIT_IPV6_PREFIX: integer(0, 128).default(64),
  RATE_LIMIT_REQUESTS_PER_MINUTE: integer(0).default(600),
  RATE_LIMIT_AUTH_PER_MINUTE: integer(0).default(10),
  RATE_LIMIT_WRITES_PER_MINUTE: integer(0).default(120),
  MAX_BODY_BYTES: integer(1).default(1_048_576),
  PASSWORD_HASH_CONCURRENCY: integer(1).default(3),
  PASSWORD_HASH_QUEUE: integer(0).default(32),
  WEB_ROOT: z.string().optional(),
  LOG_REQUESTS: boolean.optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).optional(),
  SENTRY_DSN: z
    .string()
    .refine((value) => {
      const url = URL.parse(value);
      return (
        url &&
        ["http:", "https:"].includes(url.protocol) &&
        url.hostname &&
        url.username &&
        !url.search &&
        !url.hash &&
        /\/\d+\/?$/.test(url.pathname)
      );
    }, "expected a Sentry HTTP(S) DSN with a key and numeric project ID")
    .optional(),
});

// Run a cross-field check even when unrelated variables were invalid.
function validSettings(...keys: (keyof typeof envSettings.shape)[]) {
  return ({ issues }: { issues: readonly { path?: PropertyKey[] }[] }) =>
    issues.every(({ path }) => path?.[0] && !keys.some((key) => key === path[0]));
}

const envSchema = envSettings
  .refine(
    (env) =>
      env.NODE_ENV !== "production" ||
      !env.DATABASE_URL.startsWith("pglite:") ||
      env.ALLOW_PGLITE_IN_PRODUCTION,
    {
      path: ["DATABASE_URL"],
      error: "pglite: requires ALLOW_PGLITE_IN_PRODUCTION=true in production",
      when: validSettings("NODE_ENV", "DATABASE_URL", "ALLOW_PGLITE_IN_PRODUCTION"),
    },
  )
  .refine(
    (env) => env.NODE_ENV !== "production" || env.COOKIE_SECURE !== false || env.ALLOW_INSECURE_COOKIES,
    {
      path: ["COOKIE_SECURE"],
      error: "false requires ALLOW_INSECURE_COOKIES=true in production",
      when: validSettings("NODE_ENV", "COOKIE_SECURE", "ALLOW_INSECURE_COOKIES"),
    },
  )
  .refine((env) => env.PORT !== env.INTERNAL_PORT, {
    path: ["INTERNAL_PORT"],
    error: "must differ from PORT",
    when: validSettings("PORT", "INTERNAL_PORT"),
  });

export const configVariables = Object.keys(envSettings.shape);

export class ConfigError extends Error {
  constructor(issues: readonly z.ZodIssue[]) {
    super(
      `Invalid configuration:\n${issues.map(({ path, message }) => `- ${path.join(".")}: ${message}`).join("\n")}`,
    );
    this.name = "ConfigError";
  }
}

const passwordHashSettings = envSettings.pick({ PASSWORD_HASH_CONCURRENCY: true, PASSWORD_HASH_QUEUE: true });

function passwordHashLimits(env: z.output<typeof passwordHashSettings>) {
  return { concurrency: env.PASSWORD_HASH_CONCURRENCY, queue: env.PASSWORD_HASH_QUEUE };
}

/** One shared budget for every password operation in this process, including standalone callers. */
export function loadPasswordHashLimits(env: NodeJS.ProcessEnv = process.env) {
  const result = passwordHashSettings.safeParse(env);
  if (!result.success) throw new ConfigError(result.error.issues);
  return passwordHashLimits(result.data);
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn,
) {
  const result = envSchema.safeParse(env);
  if (!result.success) throw new ConfigError(result.error.issues);
  const values = result.data;
  const production = values.NODE_ENV === "production";
  const trustProxyHops = values.TRUST_PROXY_HOPS ?? Number(values.TRUST_PROXY);
  const clientIpHeader = values.CLIENT_IP_HEADER || undefined;
  if (values.TRUST_PROXY) warn("TRUST_PROXY is deprecated. Set TRUST_PROXY_HOPS explicitly.");
  if (production && trustProxyHops === 0 && !clientIpHeader) {
    warn("No trusted client address header is configured. Clients behind a proxy share its rate limits.");
  }

  return {
    environment: values.NODE_ENV ?? "development",
    commit: values.APP_COMMIT,
    http: {
      port: values.PORT,
      internalPort: values.INTERNAL_PORT,
      sessionTtlDays: values.SESSION_TTL_DAYS,
      cookieSecure: values.COOKIE_SECURE ?? production,
      corsOrigins: values.CORS_ORIGINS,
      trustProxyHops,
      clientIpHeader,
      maxBodyBytes: values.MAX_BODY_BYTES,
      webRoot: values.WEB_ROOT || undefined,
      shutdownDelayMs: values.SHUTDOWN_DELAY_MS,
      shutdownTimeoutMs: values.SHUTDOWN_TIMEOUT_MS,
    },
    db: {
      url: values.DATABASE_URL,
      maxConnections: values.DB_POOL_MAX,
      statementTimeoutMs: values.DB_STATEMENT_TIMEOUT_MS,
      lockTimeoutMs: values.DB_LOCK_TIMEOUT_MS,
      idleInTransactionTimeoutMs: values.DB_IDLE_IN_TX_TIMEOUT_MS,
      connectTimeoutMs: values.DB_CONNECT_TIMEOUT_MS,
    },
    rateLimits: {
      requestsPerMinute: values.RATE_LIMIT_REQUESTS_PER_MINUTE,
      authPerMinute: values.RATE_LIMIT_AUTH_PER_MINUTE,
      writesPerMinute: values.RATE_LIMIT_WRITES_PER_MINUTE,
      ipv6Prefix: values.RATE_LIMIT_IPV6_PREFIX,
    },
    passwordHash: passwordHashLimits(values),
    log: {
      requests: values.LOG_REQUESTS ?? values.NODE_ENV !== "test",
      level: values.LOG_LEVEL,
      format: values.LOG_FORMAT ?? (production ? "json" : "pretty"),
      sentryDsn: values.SENTRY_DSN,
    },
    jobs: {},
    mail: {},
    i18n: {},
    moderation: {},
  } as const;
}

export type AppConfig = ReturnType<typeof loadConfig>;
