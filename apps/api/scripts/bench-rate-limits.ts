import { sql } from "drizzle-orm";
import { queryRows } from "../src/db/client";
import { PostgresRateLimitStore } from "../src/modules/rate-limits/postgres";
import { rateLimitKey } from "../src/modules/rate-limits/store";
import { openTestDatabase } from "../test/database";

// Same disposable, migrated PostgreSQL database lifecycle as the conformance suite.
if (!process.env.TEST_DATABASE_URL)
  throw new Error("Set TEST_DATABASE_URL to a local PostgreSQL test server");
const database = await openTestDatabase();
try {
  const store = new PostgresRateLimitStore(database.handle.db);
  const [server] = await queryRows<{ version: string }>(
    database.handle.db,
    sql`select current_setting('server_version') as version`,
  );
  console.info(
    "PostgreSQL",
    server?.version,
    "sequential same-key consumes, 100 warm-up + 2000 measured per outcome",
  );
  for (const outcome of ["allowed", "denied"] as const) {
    const key = rateLimitKey("write.any", 0, "account", outcome, "benchmark");
    const rule = { limit: outcome === "allowed" ? 10_000 : 1, periodSeconds: 86_400 };
    for (let i = 0; i < 100; i++) await store.consume(key, rule);
    const samples: number[] = [];
    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      const before = performance.now();
      const result = await store.consume(key, rule);
      samples.push(performance.now() - before);
      if (result.allowed !== (outcome === "allowed")) throw new Error("Unexpected decision");
    }
    const elapsed = performance.now() - start;
    samples.sort((a, b) => a - b);
    const statements = samples.length * (outcome === "allowed" ? 1 : 2);
    console.info(outcome, {
      statementsPerSecond: Math.round((statements * 1000) / elapsed),
      meanMs: elapsed / samples.length,
      p50Ms: samples[999],
      p95Ms: samples[1899],
    });
  }
} finally {
  await database.dispose();
}
