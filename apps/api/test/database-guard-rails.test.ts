import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { uniformWeights } from "@ideaproxima/domain";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { queryRows } from "../src/db/client";
import { inTransaction } from "../src/modules/shared/context";
import { dbErrors } from "../src/observability/metrics";
import { openTestDatabase } from "./database";

const config = loadConfig({ NODE_ENV: "test" });
const serializationFailure = sql`do $$ begin raise exception 'fixture' using errcode = '40001'; end $$`;
const deadlock = sql`do $$ begin raise exception 'fixture' using errcode = '40P01'; end $$`;

it.each([
  ["serialization failure", serializationFailure],
  ["deadlock", deadlock],
])("retries a %s outside the savepoint and rolls back its first attempt", async (_name, failure) => {
  const database = await openTestDatabase();
  try {
    const { db } = database.handle;
    await db.execute(sql`create table retry_fixture (id integer primary key)`);
    const attempts: string[] = [];
    await inTransaction({ db, actor: null, weights: uniformWeights }, async (tx) => {
      attempts.push("outer");
      await tx.db.execute(sql`insert into retry_fixture (id) values (1)`);
      await inTransaction(tx, async (nested) => {
        attempts.push("nested");
        if (attempts.length === 2) await nested.db.execute(failure);
      });
    });
    expect(attempts).toEqual(["outer", "nested", "outer", "nested"]);
    expect(await queryRows(db, sql`select retry_fixture.id from retry_fixture`)).toEqual([{ id: 1 }]);
  } finally {
    await database.dispose();
  }
});

it("stops after two attempts and returns the documented retry response", async () => {
  const database = await openTestDatabase();
  try {
    const { db } = database.handle;
    const app = createApp({ db, config });
    let attempts = 0;
    app.get("/retry-fixture", async (c) =>
      inTransaction({ db, actor: null, weights: uniformWeights }, async (tx) => {
        attempts++;
        await tx.db.execute(serializationFailure);
        return c.text("unused");
      }),
    );
    const response = await app.request("/retry-fixture");
    expect(attempts).toBe(2);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.json()).toMatchObject({ error: { code: "unavailable" } });
  } finally {
    await database.dispose();
  }
});

it("sets session timeouts on the driver", async () => {
  const database = await openTestDatabase({
    statementTimeoutMs: 999,
    lockTimeoutMs: 123,
    idleInTransactionTimeoutMs: 2345,
    connectTimeoutMs: 750,
  });
  try {
    const { db } = database.handle;
    expect(await queryRows(db, sql`show statement_timeout`)).toEqual([{ statement_timeout: "999ms" }]);
    expect(await queryRows(db, sql`show lock_timeout`)).toEqual([{ lock_timeout: "123ms" }]);
    expect(await queryRows(db, sql`show idle_in_transaction_session_timeout`)).toEqual([
      { idle_in_transaction_session_timeout: "2345ms" },
    ]);
  } finally {
    await database.dispose();
  }
});

it.skipIf(!process.env.TEST_DATABASE_URL)(
  "returns 503 for real PostgreSQL statement and lock timeouts",
  async () => {
    const database = await openTestDatabase({ statementTimeoutMs: 500, lockTimeoutMs: 100 });
    try {
      const { db } = database.handle;
      const app = createApp({ db, config });
      app.get("/statement-fixture", async (c) => {
        await db.execute(sql`select pg_sleep(5)`);
        return c.text("done");
      });
      app.get("/lock-fixture", async (c) => {
        await db.execute(sql`select pg_advisory_xact_lock(83103)`);
        return c.text("done");
      });
      const assertTimeout = async (path: string) => {
        const response = await app.request(path, { headers: { "X-Request-Id": "timeout-test-id" } });
        expect(response.status).toBe(503);
        expect(response.headers.get("Retry-After")).toBe("1");
        expect(await response.json()).toMatchObject({
          error: { code: "unavailable", requestId: "timeout-test-id" },
        });
      };
      await assertTimeout("/statement-fixture");

      let announceLock!: () => void;
      let releaseLock!: () => void;
      const locked = new Promise<void>((resolve) => {
        announceLock = resolve;
      });
      const released = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      const holding = db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(83103)`);
        announceLock();
        await released;
      });
      try {
        await Promise.race([locked, holding]);
        await assertTimeout("/lock-fixture");
      } finally {
        releaseLock();
        await holding;
      }
      expect((await dbErrors.get()).values).toEqual(
        expect.arrayContaining([
          { labels: { code: "57" }, value: 1 },
          { labels: { code: "55" }, value: 1 },
        ]),
      );
      expect((await app.request("/v1/health")).status).toBe(200);
    } finally {
      await database.dispose();
    }
  },
);
