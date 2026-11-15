import { defineConfig } from "drizzle-kit";

// `npm run db:generate` diffs src/db/schema against the last snapshot and writes a SQL migration to ./drizzle.
// Migrations are applied by scripts/migrate.ts (and automatically by the test harness), never by `drizzle-kit push`.
// Database-level guarantees that Drizzle cannot express (append-only triggers) live in hand-written migrations
// created with `npx drizzle-kit generate --custom --name=<name>`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
