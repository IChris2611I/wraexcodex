import baseConfig from "./base.js"
import nextPlugin from "eslint-config-next"

/** @type {import("typescript-eslint").Config} */
export default [
  ...baseConfig,
  ...nextPlugin,
  {
    rules: {
      // Next.js Image component is preferred over <img>
      "@next/next/no-img-element": "error",
    },
  },
]
