import { defineConfig } from "drizzle-kit"

/**
 * WHY drizzle-kit config lives here:
 * The `db` package owns all migrations. The site, bot, and jobs
 * all consume the schema — but only this package manages schema changes.
 * Single source of truth. One team pushes migrations.
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Supabase connection pooler URL (Transaction mode for serverless)
    // WHY transaction mode: Serverless functions open/close DB connections
    // constantly. The pooler recycles them, preventing connection exhaustion.
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
