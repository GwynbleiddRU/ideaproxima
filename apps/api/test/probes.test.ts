import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { openDatabase } from "../src/db/client";
import { openTestDatabase } from "./database";

const config = loadConfig({ NODE_ENV: "test" });

it("keeps liveness independent of the database and preserves the health 503 contract", async () => {
  const database = await openDatabase("pglite:memory");
  try {
    const app = createApp({ db: database.db, config });
    expect(await (await app.request("/readyz")).json()).toEqual({ ok: false, check: "migrations" });
    const execute = vi.spyOn(database.db, "execute").mockRejectedValue(new Error("disconnected"));
    const response = await app.request("/livez", { headers: { "X-Request-Id": "liveness-id" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("liveness-id");
    expect(await response.json()).toEqual({ ok: true });
    expect(execute).not.toHaveBeenCalled();
    const readiness = await app.request("/readyz");
    expect(readiness.status).toBe(503);
    expect(await readiness.json()).toEqual({ ok: false, check: "database" });
    const health = await app.request("/v1/health");
    expect(health.status).toBe(503);
    expect(await health.json()).toEqual({ ok: false, database: "down" });
  } finally {
    await database.close();
  }
});

it("requires the newest bundled migration and keeps public health independent of the ledger", async () => {
  const database = await openTestDatabase();
  try {
    const { db } = database.handle;
    const app = createApp({ db, config });
    const ready = await app.request("/readyz");
    expect(ready.status).toBe(200);
    expect(ready.headers.get("Cache-Control")).toBe("no-store");
    expect(await ready.json()).toEqual({ ok: true });
    await db.execute(sql`delete from drizzle.__drizzle_migrations
      where __drizzle_migrations.id = (
        select latest.id from drizzle.__drizzle_migrations as latest
        order by latest.created_at desc limit 1
      )`);
    const behind = await app.request("/readyz");
    expect(behind.status).toBe(503);
    expect(await behind.json()).toEqual({ ok: false, check: "migrations" });
    expect(await (await app.request("/v1/health")).json()).toEqual({ ok: true, database: "up" });
  } finally {
    await database.dispose();
  }
});
