import { defineConfig } from "drizzle-kit"

/**
 * WHY two different connection strings for different operations:
 *
 * DATABASE_URL (pooler, port 6543):
 *   → Used by the app at runtime (Next.js, jobs)
 *   → Transaction pooler — handles thousands of short-lived connections
 *   → Required for serverless/edge environments
 *
 * DATABASE_URL_DIRECT (direct, port 5432):
 *   → Used by drizzle-kit ONLY (migrations, push, studio)
 *   → DDL statements (CREATE TABLE, ALTER TABLE) cannot run over the pooler
 *     because they need a persistent session-level connection
 *   → Never used in production app code
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
