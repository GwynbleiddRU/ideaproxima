import { sql } from "drizzle-orm";
import { describeRateLimit, gcra, gcraTiming, type RateLimitRule } from "@ideaproxima/domain";
import { queryRows, type Database } from "../../db/client";
import type { RateLimitKey, RateLimitStore } from "./store";

// Use the database clock even after waiting for another writer's row lock.
const debt = sql`extract(epoch from (rate_limits.tat - clock_timestamp())) * 1000000`;

/** Construct with the application pool: a domain transaction must never hold or refund a limiter charge. */
export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly db: Database) {}

  private async readDebt(key: RateLimitKey) {
    const [row] = await queryRows<{ debt: number }>(
      this.db,
      sql`select (${debt})::float8 as debt from rate_limits where rate_limits.key = ${key}`,
    );
    return row?.debt ?? 0;
  }

  async consume(key: RateLimitKey, rule: RateLimitRule, cost = 1) {
    const timing = gcraTiming(rule, cost);
    const charge = sql`${timing.chargeUs}::float8 * interval '1 microsecond'`;
    const [row] = await queryRows<{ debt: number }>(
      this.db,
      sql`
      insert into rate_limits (key, tat) values (${key}, clock_timestamp() + ${charge})
      on conflict (key) do update set tat = greatest(rate_limits.tat, clock_timestamp()) + ${charge}
      where rate_limits.tat <= clock_timestamp() + ${timing.capacityUs - timing.chargeUs}::float8 * interval '1 microsecond'
      returning (${debt})::float8 as debt`,
    );
    if (row) return describeRateLimit(rule.limit, timing, row.debt, 0);

    // Another request can reset the key between the failed upsert and this read. Preserve the original denial.
    const { decision } = gcra(rule, await this.readDebt(key), 0, cost, "peek");
    return { ...decision, allowed: false, retryAfterSeconds: Math.max(1, decision.retryAfterSeconds) };
  }

  async peek(key: RateLimitKey, rule: RateLimitRule) {
    return gcra(rule, await this.readDebt(key), 0, 1, "peek").decision;
  }

  async reset(key: RateLimitKey) {
    await this.db.execute(sql`delete from rate_limits where rate_limits.key = ${key}`);
  }

  async close() {
    // The application owns the shared database pool.
  }
}

export async function purgeRateLimits(db: Database) {
  await db.execute(sql`delete from rate_limits where rate_limits.tat < now() - interval '1 minute'`);
}
