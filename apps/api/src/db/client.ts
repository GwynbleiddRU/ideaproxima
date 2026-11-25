import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Schema = typeof schema;
/** Driver-agnostic database handle. Transactions (`db.transaction(tx => …)`) yield the same type. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export interface DatabaseHandle {
  db: Database;
  driver: "pglite" | "postgres";
  migrate(): Promise<void>;
  close(force?: boolean): Promise<void>;
}

export interface DatabaseOptions {
  maxConnections?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  idleInTransactionTimeoutMs?: number;
  connectTimeoutMs?: number;
}

/**
 * Opens a database from a URL:
 *   pglite:memory              in-memory Postgres (tests)
 *   pglite:<directory>         file-backed embedded Postgres (local development, zero infrastructure)
 *   postgres://… / postgresql://…   a real PostgreSQL server (staging, production)
 *
 * Both drivers run the same schema and the same SQL migrations, so behaviour in tests matches production
 * (PGlite *is* Postgres compiled to WASM, not an emulation).
 */
export async function openDatabase(url: string, options: DatabaseOptions = {}): Promise<DatabaseHandle> {
  const migrationsFolder = findMigrationsFolder();
  const timeouts = Object.entries({
    statement_timeout: options.statementTimeoutMs,
    lock_timeout: options.lockTimeoutMs,
    idle_in_transaction_session_timeout: options.idleInTransactionTimeoutMs,
  }).filter((entry): entry is [string, number] => entry[1] !== undefined);

  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const location = url.slice("pglite:".length);
    if (location !== "memory") mkdirSync(location, { recursive: true });
    const client = location === "memory" ? new PGlite() : new PGlite(location);
    try {
      // set_config(..., false) is the parameterized form of session-level SET.
      for (const [name, value] of timeouts) {
        await client.query("select pg_catalog.set_config($1, $2, false)", [name, String(value)]);
      }
    } catch (error) {
      await client.close();
      throw error;
    }
    const db = drizzle(client, { schema });
    return {
      db: db as unknown as Database,
      driver: "pglite",
      migrate: () => migrate(db, { migrationsFolder }),
      close: () => client.close(),
    };
  }

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, {
      max: options.maxConnections ?? 10,
      ...(options.connectTimeoutMs === undefined
        ? {}
        : { connect_timeout: options.connectTimeoutMs / 1_000 }),
      connection: Object.fromEntries(timeouts),
      onnotice: () => {},
    });
    const db = drizzle(client, { schema });
    return {
      db: db as unknown as Database,
      driver: "postgres",
      migrate: () => migrate(db, { migrationsFolder }),
      close: (force) => client.end(force ? { timeout: 0 } : undefined),
    };
  }

  throw new Error("Unsupported DATABASE_URL. Use pglite:memory, pglite:<dir> or postgres://…");
}

/** Works both from source (src/db) and from the bundled build (dist). */
export function findMigrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../drizzle"),
    resolve(here, "../drizzle"),
    resolve(process.cwd(), "drizzle"),
  ];
  const found = candidates.find((dir) => existsSync(resolve(dir, "meta/_journal.json")));
  if (!found) throw new Error(`Migrations folder not found (looked in ${candidates.join(", ")})`);
  return found;
}

/** Runs raw SQL and returns rows regardless of driver (postgres-js returns an array, PGlite returns { rows }). */
export async function queryRows<T>(db: Database, query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as unknown;
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
