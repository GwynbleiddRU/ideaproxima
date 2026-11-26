import { index, pgTable, text } from "drizzle-orm/pg-core";
import { tstz } from "./_columns";

// Disposable operational state. A custom migration makes this table UNLOGGED.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  tat: tstz("tat").notNull(),
});

// Replay receipts must survive a restart even when limiter budgets reset.
export const usedRegistrationChallenges = pgTable(
  "used_registration_challenges",
  {
    salt: text("salt").primaryKey(),
    expiresAt: tstz("expires_at").notNull(),
  },
  (table) => [index("used_registration_challenges_expiry_idx").on(table.expiresAt)],
);
