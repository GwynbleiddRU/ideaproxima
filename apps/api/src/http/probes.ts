import { sql } from "drizzle-orm";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import type { Hono } from "hono";
import { findMigrationsFolder, queryRows, type Database } from "../db/client";
import { sqlState } from "../db/errors";
import type { AppEnv } from "./env";
import { recordDatabaseError } from "./errors";

type FailedCheck = "database" | "migrations" | "draining";
type DatabaseCheck = Exclude<FailedCheck, "draining"> | null;
const PROBE_TIMEOUT_MS = 2_000;
let latest: MigrationMeta | undefined;

async function checkDatabase(db: Database, bundled: MigrationMeta): Promise<DatabaseCheck> {
  try {
    const [applied] = await queryRows<{ hash: string; created_at: string | number | bigint }>(
      db,
      sql`select __drizzle_migrations.hash, __drizzle_migrations.created_at
        from drizzle.__drizzle_migrations
        order by __drizzle_migrations.created_at desc, __drizzle_migrations.id desc limit 1`,
    );
    return applied?.hash === bundled.hash && Number(applied.created_at) === bundled.folderMillis
      ? null
      : "migrations";
  } catch (error) {
    const code = sqlState(error);
    if (code === "42P01" || code === "3F000") return "migrations";
    recordDatabaseError(error);
    return "database";
  }
}

export function addProbes(app: Hono<AppEnv>, db: Database, isDraining: () => boolean) {
  const bundled = (latest ??= readMigrationFiles({ migrationsFolder: findMigrationsFolder() }).at(-1));
  if (!bundled) throw new Error("No bundled migrations found");

  // Share one query even after a probe times out, so probes cannot pile up behind a busy pool.
  let pending: Promise<DatabaseCheck> | undefined;
  const databaseCheck = () =>
    (pending ??= new Promise<DatabaseCheck>((resolve) => {
      const timer = setTimeout(() => resolve("database"), PROBE_TIMEOUT_MS);
      timer.unref();
      void checkDatabase(db, bundled).then((result) => {
        clearTimeout(timer);
        pending = undefined;
        resolve(result);
      });
    }));

  app.get("/livez", (c) => c.json({ ok: true }, 200, { "Cache-Control": "no-store" }));
  app.get("/readyz", async (c) => {
    c.header("Cache-Control", "no-store");
    let check: FailedCheck | null = isDraining() ? "draining" : await databaseCheck();
    if (isDraining()) check = "draining";
    return check ? c.json({ ok: false, check }, 503) : c.json({ ok: true });
  });
}
