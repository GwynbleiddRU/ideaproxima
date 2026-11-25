import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ConfigError, configVariables, loadConfig } from "../src/config";

describe("runtime configuration", () => {
  it("keeps development defaults and accepts explicit settings", () => {
    const defaults = loadConfig({});
    expect(defaults.http).toMatchObject({ port: 3000, internalPort: undefined, cookieSecure: false });
    expect(defaults.db.url).toBe("pglite:./.data/pglite");
    expect(defaults.log).toEqual({ requests: true, level: "info", format: "pretty" });
    expect(defaults).toMatchObject({ jobs: {}, mail: {}, i18n: {}, moderation: {} });

    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "0",
      INTERNAL_PORT: "9100",
      CORS_ORIGINS: "https://example.test, http://localhost:3000",
      COOKIE_SECURE: "1",
      CLIENT_IP_HEADER: "X-Real-IP",
      RATE_LIMIT_AUTH_PER_MINUTE: "0",
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
    expect(config.rateLimits.authPerMinute).toBe(0);
    expect(config.log).toEqual({ requests: false, level: "debug", format: "json" });
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
        RATE_LIMIT_AUTH_PER_MINUTE: "1O",
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
      "RATE_LIMIT_AUTH_PER_MINUTE",
      "PASSWORD_HASH_QUEUE",
      "LOG_LEVEL",
    ])
      expect(message).toContain(`- ${variable}:`);
    expect(message).toContain('received "1O"');
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
    const warn = vi.fn();
    const local = loadConfig(
      {
        NODE_ENV: "production",
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
        DATABASE_URL: "postgresql://localhost/db",
        TRUST_PROXY_HOPS: "1",
      },
      warn,
    );
    expect(config.http.cookieSecure).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    loadConfig(
      { NODE_ENV: "production", DATABASE_URL: "postgres://localhost/db", CLIENT_IP_HEADER: "x-real-ip" },
      warn,
    );
    expect(warn).not.toHaveBeenCalled();
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
