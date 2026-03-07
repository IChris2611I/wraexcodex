import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index"

/**
 * WHY lazy initialization (getter pattern):
 * The db client is created on first USE, not on import.
 *
 * WHY this matters: In a monorepo, `@wraexcodex/db` gets imported by Next.js
 * during build/compile time — before any .env files are loaded. If we connect
 * eagerly (at module load), it crashes with "DATABASE_URL not set" even in
 * pages that never touch the database.
 *
 * WHY singleton in dev:
 * Next.js hot-reloads modules constantly. Without the global singleton,
 * each reload opens a new postgres connection pool → exhausts Supabase's
 * 15-connection free tier limit within minutes.
 */

type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>

declare global {
  // eslint-disable-next-line no-var
  var __db: DrizzleClient | undefined
}

function createClient(): DrizzleClient {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to apps/site/.env.local\n" +
      "Get it from: Supabase Dashboard → Settings → Database → Connection string (Transaction pooler)"
    )
  }

  const isPooler = connectionString.includes("pooler.supabase.com")

  const client = postgres(connectionString, {
    max: 1,           // serverless: 1 connection per function instance
    idle_timeout: 20,
    connect_timeout: 10,
    // PgBouncer (Supabase pooler) doesn't support prepared statements
    // Without this, postgres.js sends a Prepare message that the pooler rejects
    prepare: !isPooler,
    ssl: isPooler ? "require" : false,
  })

  return drizzle(client, { schema })
}

// Lazy getter — connection only opens when `db` is first accessed
let _db: DrizzleClient | undefined

export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop) {
    if (!_db) {
      // Reuse across hot-reloads in dev
      _db = globalThis.__db ?? createClient()
      if (process.env.NODE_ENV !== "production") {
        globalThis.__db = _db
      }
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type Database = DrizzleClient
