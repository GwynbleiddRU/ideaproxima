import { defineConfig } from "tsup";

// Bundles the server and the operator commands into dist/. Workspace packages (@ideaproxima/*) are TypeScript
// source and are inlined; third-party dependencies stay external (PGlite in particular loads its WASM files from
// node_modules). Migrations are read at runtime from ../drizzle relative to dist/.
export default defineConfig({
  entry: {
    main: "src/main.ts",
    migrate: "scripts/migrate.ts",
    seed: "scripts/seed.ts",
    "set-role": "scripts/set-role.ts",
    "rebuild-metrics": "scripts/rebuild-metrics.ts",
  },
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/^@ideaproxima\//],
});
