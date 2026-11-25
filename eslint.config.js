import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const readableAttribute =
  "JSXAttribute[name.name=/^(aria-label|aria-description|title|label|placeholder|hint|description|legend|closeLabel|eyebrow|lede|alt|confirmLabel|submitLabel|cancelLabel|subject)$/]";
const literalLabel = "Literal[value=/\\p{L}/u]";
const renderedExpression = "JSXExpressionContainer:not(JSXAttribute > JSXExpressionContainer)";
const literalTemplate = "TemplateElement[value.raw=/\\p{L}/u]";

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
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: [
            "JSXText[value=/\\p{L}/u]",
            renderedExpression + " > " + literalLabel,
            renderedExpression +
              " > ConditionalExpression > :matches(" +
              literalLabel +
              ".consequent, " +
              literalLabel +
              ".alternate)",
            renderedExpression + " > LogicalExpression > " + literalLabel + ".right",
            renderedExpression + " > TemplateLiteral > " + literalTemplate,
            renderedExpression +
              " > ConditionalExpression > :matches(TemplateLiteral.consequent, TemplateLiteral.alternate) > " +
              literalTemplate,
            renderedExpression + " > LogicalExpression > TemplateLiteral.right > " + literalTemplate,
          ].join(", "),
          message: "Put visible copy in the English interface catalogue.",
        },
        {
          selector: [
            `${readableAttribute} > ${literalLabel}`,
            `${readableAttribute} > JSXExpressionContainer > ${literalLabel}`,
            `${readableAttribute} > JSXExpressionContainer > ConditionalExpression > :matches(${literalLabel}.consequent, ${literalLabel}.alternate)`,
            `${readableAttribute} > JSXExpressionContainer > TemplateLiteral > ${literalTemplate}`,
            `${readableAttribute} > JSXExpressionContainer > ConditionalExpression > :matches(TemplateLiteral.consequent, TemplateLiteral.alternate) > ${literalTemplate}`,
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
