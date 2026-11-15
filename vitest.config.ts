import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// One test runner for the whole monorepo. Workspace packages are consumed as TypeScript source,
// so no build step is needed before testing.
export default defineConfig({
  // The web app's "@/…" imports (apps/web/vite.config.ts), for its unit tests.
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
    // Integration tests each boot an in-memory PGlite (WASM Postgres) and run all migrations.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
