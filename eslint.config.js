import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const readableAttribute =
  "JSXAttribute[name.name=/^(aria-label|aria-description|title|label|placeholder|hint|description|legend|closeLabel|eyebrow|lede|alt|confirmLabel)$/]";
const literalLabel = "Literal[value=/\\S/]:not([value='https://'])";

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
    files: [
      "apps/web/src/app/Shell.tsx",
      "apps/web/src/pages/auth/**/*.tsx",
      "apps/web/src/pages/home/**/*.tsx",
      "apps/web/src/pages/explore/**/*.tsx",
      "apps/web/src/pages/idea/{IdeaLayout,*Tab}.tsx",
      "apps/web/src/components/{IdeaCard,Markdown,Stage,Ratings,RelationGraph}.tsx",
      "apps/web/src/components/knowledge/{Arguments,ClaimCard,EvidenceItem}.tsx",
      "apps/web/src/ui/Meter.tsx",
      "apps/web/src/components/LanguageSwitcher.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXText[value=/\\S/]", message: "Put visible copy in the English interface catalogue." },
        {
          selector: [
            `${readableAttribute} > ${literalLabel}`,
            `${readableAttribute} > JSXExpressionContainer > ${literalLabel}`,
            `${readableAttribute} > JSXExpressionContainer > ConditionalExpression > :matches(Literal.consequent[value=/\\S/], Literal.alternate[value=/\\S/])`,
            `${readableAttribute} > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/\\p{L}/u]`,
          ].join(", "),
          message: "Put visible and accessible labels in the English interface catalogue.",
        },
      ],
    },
  },
  {
    // Integration tests assert on loosely-typed JSON responses on purpose.
    files: ["**/test/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
