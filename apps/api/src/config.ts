import { randomBytes } from "node:crypto";
import {
  RATE_LIMIT_POLICIES,
  resolveRateLimitPolicy,
  type RateLimitPolicyName,
  type TrustTier,
} from "@ideaproxima/domain";
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

const policyNames = Object.keys(RATE_LIMIT_POLICIES) as RateLimitPolicyName[];
const tiers: TrustTier[] = ["anonymous", "restricted", "new", "member", "established", "staff"];
const positiveInteger = z.number().int().positive();
const rules = z.array(
  z.strictObject({
    limit: positiveInteger,
    periodSeconds: positiveInteger,
    burst: positiveInteger.optional(),
  }),
);
const overrides = z.partialRecord(
  z.enum(policyNames),
  z.strictObject({
    anonymous: rules.optional(),
    new: rules.optional(),
    member: rules.optional(),
    established: rules.optional(),
  }),
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
  JOBS_MODE: z.enum(["inline", "worker", "off"]).default("inline"),
  METRICS_REFRESH_MODE: z.enum(["sync", "async"]).default("sync"),
  JOBS_CONCURRENCY: integer(1, 1024).default(4),
  JOBS_QUEUES: z
    .string()
    .default("default,mail")
    .transform((value, ctx) => {
      const seen = new Set<string>();
      const queues = [];
      for (const item of value.split(",")) {
        const match = /^([a-z][a-z0-9_.-]*)(?:=([1-9]\d*))?$/.exec(item.trim());
        if (!match || seen.has(match[1]!) || (match[2] && !Number.isSafeInteger(Number(match[2])))) {
          ctx.addIssue({
            code: "custom",
            message: "expected distinct queue names with optional positive caps, e.g. default,moderation=2",
          });
          return z.NEVER;
        }
        seen.add(match[1]!);
        queues.push({ name: match[1]!, cap: match[2] ? Number(match[2]) : undefined });
      }
      return queues;
    }),
  JOBS_STATEMENT_TIMEOUT_MS: integer(0, 2_147_483_647).default(60_000),
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
  TRUST_REQUIRE_VERIFIED_EMAIL: boolean.default(false),
  CLIENT_IP_HEADER: headerName.optional(),
  RATE_LIMIT_IPV6_PREFIX: integer(0, 128).default(64),
  RATE_LIMITS: z.enum(["on", "off"]).default("on"),
  RATE_LIMIT_STORE: z.enum(["memory", "postgres"]).default("memory"),
  RATE_LIMIT_KEY_SECRET: z.string().trim().min(1).optional(),
  REGISTRATION_CHALLENGE: z.enum(["pow", "none"]).optional(),
  CHALLENGE_SECRET: z.string().trim().min(32).optional(),
  RATE_LIMIT_SCALE: z.coerce.number().positive().default(1),
  RATE_LIMIT_OVERRIDES: z
    .string()
    .transform((raw, ctx) => {
      try {
        return overrides.parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "expected JSON with known policies, base tiers and positive integer rules",
        });
        return z.NEVER;
      }
    })
    .default({}),
  REGISTRATION_MODE: z.enum(["immediate", "verified-first"]).default("immediate"),
  PASSWORD_BREACH_CHECK: z.enum(["off", "hibp"]).default("off"),
  PUBLIC_BASE_URL: z
    .url({ protocol: /^https?$/ })
    .refine(
      (value) => URL.parse(value)?.origin === value.replace(/\/$/, ""),
      "expected a public HTTP(S) origin",
    )
    .optional(),
  MAIL_TRANSPORT: z.enum(["smtp", "log"]).optional(),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
  MAIL_FROM: z.email().optional(),
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
  .refine((env) => env.NODE_ENV !== "production" || !!env.PUBLIC_BASE_URL, {
    path: ["PUBLIC_BASE_URL"],
    error: "required in production",
  })
  .refine(
    (env) =>
      (env.MAIL_TRANSPORT ?? (env.NODE_ENV === "production" ? "smtp" : "log")) !== "smtp" ||
      (!!env.SMTP_URL && !!env.MAIL_FROM),
    { path: ["SMTP_URL"], error: "SMTP_URL and MAIL_FROM are required for SMTP" },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== "production" ||
      env.MAIL_TRANSPORT !== "log" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(URL.parse(env.PUBLIC_BASE_URL ?? "")?.hostname ?? ""),
    { path: ["MAIL_TRANSPORT"], error: "public production deployments require SMTP" },
  )
  .refine(
    (env) => env.NODE_ENV !== "production" || env.REGISTRATION_CHALLENGE === "none" || !!env.CHALLENGE_SECRET,
    {
      path: ["CHALLENGE_SECRET"],
      error: "required for proof of work in production",
      when: validSettings("NODE_ENV", "REGISTRATION_CHALLENGE", "CHALLENGE_SECRET"),
    },
  )
  .refine(
    (env) =>
      (env.NODE_ENV !== "production" && env.RATE_LIMIT_STORE !== "postgres") || !!env.RATE_LIMIT_KEY_SECRET,
    {
      path: ["RATE_LIMIT_KEY_SECRET"],
      error: "required in production or with the PostgreSQL rate-limit store",
      when: validSettings("NODE_ENV", "RATE_LIMIT_STORE", "RATE_LIMIT_KEY_SECRET"),
    },
  )
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
  const policyRules = new Map<
    TrustTier,
    Map<RateLimitPolicyName, ReturnType<typeof resolveRateLimitPolicy>>
  >();
  for (const tier of tiers) {
    const resolved = new Map<RateLimitPolicyName, ReturnType<typeof resolveRateLimitPolicy>>();
    for (const name of policyNames) {
      try {
        resolved.set(
          name,
          resolveRateLimitPolicy(name, tier, values.RATE_LIMIT_OVERRIDES, values.RATE_LIMIT_SCALE),
        );
      } catch (error) {
        throw new ConfigError([
          {
            code: "custom",
            path: ["RATE_LIMIT_OVERRIDES"],
            message: `check RATE_LIMIT_SCALE and ${name} for ${tier}: ${(error as Error).message}`,
          },
        ]);
      }
    }
    policyRules.set(tier, resolved);
  }
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
      requireVerifiedEmail: values.TRUST_REQUIRE_VERIFIED_EMAIL,
      enabled: values.RATE_LIMITS === "on",
      store: values.RATE_LIMIT_STORE,
      keySecret: values.RATE_LIMIT_KEY_SECRET ?? randomBytes(32).toString("hex"),
      rules: (name: RateLimitPolicyName, tier: TrustTier) => policyRules.get(tier)!.get(name)!,
      ipv6Prefix: values.RATE_LIMIT_IPV6_PREFIX,
    },
    passwordHash: passwordHashLimits(values),
    registrationChallenge: {
      mode: values.REGISTRATION_CHALLENGE ?? (production ? "pow" : "none"),
      secret: values.CHALLENGE_SECRET ?? randomBytes(32).toString("hex"),
    },
    log: {
      requests: values.LOG_REQUESTS ?? values.NODE_ENV !== "test",
      level: values.LOG_LEVEL,
      format: values.LOG_FORMAT ?? (production ? "json" : "pretty"),
      sentryDsn: values.SENTRY_DSN,
    },
    jobs: {
      mode: values.JOBS_MODE,
      metricsRefreshMode: values.METRICS_REFRESH_MODE,
      concurrency: values.JOBS_CONCURRENCY,
      queues: values.JOBS_QUEUES,
      statementTimeoutMs: values.JOBS_STATEMENT_TIMEOUT_MS,
    },
    registrationMode: values.REGISTRATION_MODE,
    passwordBreachCheck: values.PASSWORD_BREACH_CHECK,
    mail: {
      transport: values.MAIL_TRANSPORT ?? (production ? ("smtp" as const) : ("log" as const)),
      from: values.MAIL_FROM ?? "development@localhost.test",
      smtpUrl: values.SMTP_URL,
      baseUrl: values.PUBLIC_BASE_URL ?? "http://127.0.0.1:3000",
    },
    i18n: {},
    moderation: {},
  } as const;
}

export type AppConfig = ReturnType<typeof loadConfig>;
