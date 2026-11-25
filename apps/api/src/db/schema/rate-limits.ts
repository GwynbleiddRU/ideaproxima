import { pgTable, text } from "drizzle-orm/pg-core";
import { tstz } from "./_columns";

// Disposable operational state. A custom migration makes this table UNLOGGED.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  tat: tstz("tat").notNull(),
});
