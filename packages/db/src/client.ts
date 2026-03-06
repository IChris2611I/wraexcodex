import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index"

/**
 * WHY a singleton pattern here:
 * In development, Next.js hot-reloads modules frequently. Without this pattern,
 * each reload creates a new DB connection, quickly exhausting the pool limit.
 * The global check ensures we reuse the same client across reloads.
 *
 * In production (Vercel serverless), each function invocation is isolated
 * so this runs fresh each time — which is fine because we use the pooler.
 */

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle> | undefined
}

function createClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  const client = postgres(connectionString, {
    // Max connections — Supabase free tier: 15 total, reserve some for pooler
    max: 10,
    // Idle timeout — close idle connections after 20s in serverless
    idle_timeout: 20,
    // Connection timeout
    connect_timeout: 10,
  })

  return drizzle(client, { schema })
}

// Singleton in dev, fresh in prod
export const db = globalThis.__db ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.__db = db
}

export type Database = typeof db
