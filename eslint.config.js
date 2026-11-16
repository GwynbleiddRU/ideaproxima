import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.data/**",
      "apps/api/drizzle/**",
      "audit/screenshots/**",
      "audit/artifacts/**",
      "temp-reference-folder/**",
      "designs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    // The web app: React's rules of hooks are correctness rules, not style.
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Integration tests assert on loosely-typed JSON responses on purpose.
    files: ["**/test/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
