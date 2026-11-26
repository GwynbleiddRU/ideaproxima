import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ConfigError, configVariables, loadConfig } from "../src/config";

describe("runtime configuration", () => {
  it("keeps development defaults and accepts explicit settings", () => {
    const defaults = loadConfig({});
    expect(defaults.http).toMatchObject({ port: 3000, internalPort: undefined, cookieSecure: false });
    expect(defaults.db.url).toBe("pglite:./.data/pglite");
    expect(defaults.registrationChallenge.mode).toBe("none");
    expect(defaults.log).toEqual({ requests: true, level: "info", format: "pretty" });
    expect(defaults).toMatchObject({
      jobs: {
        mode: "inline",
        metricsRefreshMode: "sync",
        concurrency: 4,
        queues: [
          { name: "default", cap: undefined },
          { name: "mail", cap: undefined },
        ],
        statementTimeoutMs: 60000,
      },
      mail: {},
      i18n: {},
      moderation: {},
    });
    expect(loadConfig({ JOBS_MODE: "worker", JOBS_QUEUES: "default,moderation=2" }).jobs.queues[1]).toEqual({
      name: "moderation",
      cap: 2,
    });
    expect(() => loadConfig({ JOBS_QUEUES: "default,default=2" })).toThrow(/JOBS_QUEUES/);
    expect(() => loadConfig({ METRICS_REFRESH_MODE: "later" })).toThrow(/METRICS_REFRESH_MODE/);

    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "0",
      INTERNAL_PORT: "9100",
      CORS_ORIGINS: "https://example.test, http://localhost:3000",
      COOKIE_SECURE: "1",
      CLIENT_IP_HEADER: "X-Real-IP",
      RATE_LIMITS: "off",
      PASSWORD_HASH_CONCURRENCY: "1",
      PASSWORD_HASH_QUEUE: "0",
      LOG_LEVEL: "debug",
      LOG_FORMAT: "json",
    });
    expect(config.http).toMatchObject({
      port: 0,
      internalPort: 9100,
      cookieSecure: true,
      clientIpHeader: "x-real-ip",
      corsOrigins: ["https://example.test", "http://localhost:3000"],
    });
    expect(config.passwordHash).toEqual({ concurrency: 1, queue: 0 });
    expect(config.rateLimits.enabled).toBe(false);
    expect(config.log).toEqual({ requests: false, level: "debug", format: "json" });
  });

  it("validates the public origin and SMTP configuration before serving traffic", () => {
    const local = loadConfig({});
    expect(local.registrationMode).toBe("immediate");
    expect(local.mail.transport).toBe("log");
    expect(() => loadConfig({ PUBLIC_BASE_URL: "broken" })).toThrow(ConfigError);
    expect(() => loadConfig({ PUBLIC_BASE_URL: "https://user:secret@example.test" })).toThrow(
      /PUBLIC_BASE_URL/,
    );
    expect(() => loadConfig({ MAIL_TRANSPORT: "smtp", SMTP_URL: "https://example.test" })).toThrow(
      /SMTP_URL/,
    );
    expect(() => loadConfig({ MAIL_TRANSPORT: "smtp" })).toThrow(/MAIL_FROM/);
    expect(() =>
      loadConfig({ NODE_ENV: "production", PUBLIC_BASE_URL: "https://example.test", MAIL_TRANSPORT: "log" }),
    ).toThrow(/MAIL_TRANSPORT/);
  });

  it("aggregates parse failures and production guards in one error", () => {
    let error: unknown;
    try {
      loadConfig({
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
        PORT: "9100",
        INTERNAL_PORT: "9100",
        CLIENT_IP_HEADER: "bad header",
        CORS_ORIGINS: "https://example.test/a-path",
        RATE_LIMITS: "1O",
        PASSWORD_HASH_QUEUE: "2.5",
        LOG_LEVEL: "inf0",
      });
    } catch (failure) {
      error = failure;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const message = (error as ConfigError).message;
    for (const variable of [
      "DATABASE_URL",
      "COOKIE_SECURE",
      "INTERNAL_PORT",
      "CLIENT_IP_HEADER",
      "CORS_ORIGINS",
      "RATE_LIMITS",
      "PASSWORD_HASH_QUEUE",
      "LOG_LEVEL",
    ])
      expect(message).toContain(`- ${variable}:`);
    expect(message).toContain("RATE_LIMIT_KEY_SECRET");
    expect(message).toContain("CHALLENGE_SECRET");
    expect(() => loadConfig({ LOG_REQUESTS: "flase" })).toThrow(/LOG_REQUESTS/);
    expect(() => loadConfig({ DATABASE_URL: "mysql://user:example-secret@localhost/db" })).toThrow(
      /^Invalid configuration:\n- DATABASE_URL: expected a PostgreSQL URL or a nonempty pglite: location$/,
    );
  });

  it("requires explicit production overrides and warns when only the socket address is trusted", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/ALLOW_PGLITE_IN_PRODUCTION/);
    expect(() =>
      loadConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://localhost/db", COOKIE_SECURE: "0" }),
    ).toThrow(/ALLOW_INSECURE_COOKIES/);
    const mail = {
      PUBLIC_BASE_URL: "https://example.test",
      SMTP_URL: "smtps://localhost",
      MAIL_FROM: "accounts@example.test",
    };
    const warn = vi.fn();
    const local = loadConfig(
      {
        NODE_ENV: "production",
        RATE_LIMIT_KEY_SECRET: "test",
        ...mail,
        REGISTRATION_CHALLENGE: "none",
        DATABASE_URL: "pglite:memory",
        ALLOW_PGLITE_IN_PRODUCTION: "true",
        COOKIE_SECURE: "false",
        ALLOW_INSECURE_COOKIES: "true",
      },
      warn,
    );
    expect(local.http.cookieSecure).toBe(false);
    expect(local.log.format).toBe("json");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("share its rate limits"));

    warn.mockClear();
    const config = loadConfig(
      {
        NODE_ENV: "production",
        RATE_LIMIT_KEY_SECRET: "test",
        ...mail,
        CHALLENGE_SECRET: "x".repeat(32),
        DATABASE_URL: "postgresql://localhost/db",
        TRUST_PROXY_HOPS: "1",
      },
      warn,
    );
    expect(config.http.cookieSecure).toBe(true);
    expect(config.registrationChallenge.mode).toBe("pow");
    expect(warn).not.toHaveBeenCalled();
    loadConfig(
      {
        NODE_ENV: "production",
        ...mail,
        DATABASE_URL: "postgres://localhost/db",
        CLIENT_IP_HEADER: "x-real-ip",
        REGISTRATION_CHALLENGE: "none",
        RATE_LIMIT_KEY_SECRET: "test",
      },
      warn,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("validates policy overrides and the maximum graph cost before serving requests", () => {
    for (const raw of [
      "broken",
      '{"bad":{}}',
      '{"read.heavy":{"anonymous":[{"limit":2,"periodSeconds":60}]}}',
      '{"auth.login":{"member":[]}}',
    ]) {
      expect(() => loadConfig({ RATE_LIMIT_OVERRIDES: raw })).toThrow(/RATE_LIMIT_OVERRIDES/);
    }
    expect(() => loadConfig({ RATE_LIMIT_SCALE: "0.01" })).toThrow(/RATE_LIMIT_SCALE/);
    expect(() => loadConfig({ RATE_LIMIT_STORE: "postgres" })).toThrow(/RATE_LIMIT_KEY_SECRET/);
  });

  it("documents every schema variable in the example and the operations configuration table", () => {
    const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    const operations = readFileSync(
      new URL("../../../docs/developer/operations.md", import.meta.url),
      "utf8",
    );
    const config = operations.split("## Configuration")[1]!.split("\n## ")[0]!;
    const exampleKeys = new Set(
      Array.from(example.matchAll(/^(?:# )?([A-Z][A-Z0-9_]+)=/gm), (match) => match[1]),
    );
    const tableKeys = new Set(Array.from(config.matchAll(/^\| `([A-Z][A-Z0-9_]+)`/gm), (match) => match[1]));
    expect(configVariables.filter((name) => !exampleKeys.has(name))).toEqual([]);
    expect(configVariables.filter((name) => !tableKeys.has(name))).toEqual([]);
  });

  it("validates shutdown, database and error-reporting settings together", () => {
    const config = loadConfig({
      APP_COMMIT: "0b237de",
      SHUTDOWN_DELAY_MS: "0",
      SHUTDOWN_TIMEOUT_MS: "300",
      DB_POOL_MAX: "4",
      DB_STATEMENT_TIMEOUT_MS: "0",
      DB_LOCK_TIMEOUT_MS: "100",
      DB_IDLE_IN_TX_TIMEOUT_MS: "200",
      DB_CONNECT_TIMEOUT_MS: "350",
      SENTRY_DSN: "https://key@example.test/1",
    });
    expect(config.commit).toBe("0b237de");
    expect(config.http).toMatchObject({ shutdownDelayMs: 0, shutdownTimeoutMs: 300 });
    expect(config.db).toMatchObject({
      maxConnections: 4,
      statementTimeoutMs: 0,
      lockTimeoutMs: 100,
      idleInTransactionTimeoutMs: 200,
      connectTimeoutMs: 350,
    });
    expect(config.log.sentryDsn).toBe("https://key@example.test/1");
    expect(() =>
      loadConfig({
        DB_POOL_MAX: "0",
        SHUTDOWN_TIMEOUT_MS: "0",
        SENTRY_DSN: "https://private@example.test/invalid",
      }),
    ).toThrow(/DB_POOL_MAX:[\s\S]*SHUTDOWN_TIMEOUT_MS:[\s\S]*SENTRY_DSN: expected/);
    expect(() => loadConfig({ SENTRY_DSN: "https://private@example.test/invalid" })).toThrow(
      /^Invalid configuration:\n- SENTRY_DSN: expected a Sentry HTTP\(S\) DSN with a key and numeric project ID$/,
    );
  });
});
