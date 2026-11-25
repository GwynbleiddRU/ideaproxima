import { randomBytes } from "node:crypto";
import { openDatabase, type DatabaseHandle, type DatabaseOptions } from "../src/db/client";

export interface TestDatabase {
  handle: DatabaseHandle;
  /** "pglite" (default, in-process) or "postgres" (a real server, when TEST_DATABASE_URL is set). */
  driver: DatabaseHandle["driver"];
  dispose(): Promise<void>;
}

/**
 * A fresh, fully migrated database for one test file.
 *
 *  - Default: in-memory PGlite (real Postgres compiled to WASM). Fast, zero infrastructure.
 *  - With TEST_DATABASE_URL (e.g. postgres://ideaproxima:ideaproxima@localhost:5433/postgres, see
 *    docker-compose.yml): a throwaway database is created on that server, migrated, and dropped afterwards.
 *    This exercises what PGlite cannot: multiple connections, row locks, advisory locks and real races.
 *    `npm run test:pg` sets the variable for you.
 */
export async function openTestDatabase(options: DatabaseOptions = {}): Promise<TestDatabase> {
  const serverUrl = process.env.TEST_DATABASE_URL;
  if (!serverUrl) {
    const handle = await openDatabase("pglite:memory", options);
    await handle.migrate();
    return { handle, driver: handle.driver, dispose: () => handle.close() };
  }

  const name = `ipx_test_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const { default: postgres } = await import("postgres");
  const admin = () => postgres(serverUrl, { max: 1, onnotice: () => {} });

  const create = admin();
  await create.unsafe(`create database "${name}"`);
  await create.end();

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const handle = await openDatabase(url.toString(), { maxConnections: 4, ...options });
  await handle.migrate();
  return {
    handle,
    driver: handle.driver,
    async dispose() {
      await handle.close();
      const drop = admin();
      await drop.unsafe(`drop database if exists "${name}" with (force)`);
      await drop.end();
    },
  };
}
