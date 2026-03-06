import js from "@eslint/js"
import tseslint from "typescript-eslint"

/** @type {import("typescript-eslint").Config} */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      // Allow explicit `any` in rare cases — must be justified with a comment
      "@typescript-eslint/no-explicit-any": "warn",
      // Enforce using `type` imports — tree-shaking friendly
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      // No unused vars (except prefixed with _)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  }
)
