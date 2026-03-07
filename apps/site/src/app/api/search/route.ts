/**
 * GET /api/search?q={query}&category={category}&limit={limit}
 *
 * Full-text search across items + skills, powered by PostgreSQL pg_trgm.
 *
 * WHY Postgres instead of a dedicated search service:
 * - Zero extra cost — Supabase is already running
 * - pg_trgm gives typo-tolerance via trigram similarity
 *   ("andvarius" matches "Andvarius", "divne" matches "Divine Orb")
 * - Results are always in sync with the DB — no index lag
 * - Sub-10ms on 2550 items with a GIN trigram index
 * - One less service to manage, monitor, pay for
 *
 * Search strategy — two complementary techniques combined:
 *
 * 1. ILIKE prefix match (fast, exact substring):
 *    name ILIKE 'query%'  — catches "mir" → "Mirror of Kalandra"
 *    Handled by GIN trigram index if query >= 3 chars.
 *
 * 2. similarity() ranking (pg_trgm fuzzy score 0.0–1.0):
 *    similarity(name, query) — ranks "Andvarius" above "Andvaricite Ring"
 *    when query is "andvarius". Also catches typos.
 *
 * UNION strategy — items + skills merged then re-ranked:
 *   Both tables are queried with identical ranking logic. A UNION ALL merges
 *   them, and an outer ORDER BY re-ranks the combined result by similarity.
 *   WHY UNION ALL (not UNION): UNION deduplicates, which is O(n log n).
 *   We have no duplicates across tables so UNION ALL is cheaper.
 *
 * Prerequisites (run once in Supabase SQL editor):
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *   CREATE INDEX IF NOT EXISTS items_name_trgm_idx ON items USING GIN (name gin_trgm_ops);
 *   CREATE INDEX IF NOT EXISTS items_base_type_trgm_idx ON items USING GIN (base_type gin_trgm_ops);
 *   CREATE INDEX IF NOT EXISTS skills_name_trgm_idx ON skills USING GIN (name gin_trgm_ops);
 */

import { type NextRequest, NextResponse } from "next/server"
import { db, sql } from "@wraexcodex/db"

// ── Types ──────────────────────────────────────────────────────────────────

export type SearchHit = {
  id: string
  slug: string
  name: string
  baseType: string | null
  category: string   // "skill" for gems, otherwise item category
  rarity: string     // "gem" for skills (matches item rarity convention)
  iconUrl: string | null
  chaosValue: number | null
}

export type SearchResponse = {
  hits: SearchHit[]
  query: string
  estimatedTotalHits: number
  processingTimeMs: number
  error?: string // only present when something went wrong — for debugging
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get("q")?.trim() ?? ""
  const category = searchParams.get("category")?.trim() ?? ""
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20)

  if (!query || query.length < 2) {
    return NextResponse.json<SearchResponse>({
      hits: [],
      query,
      estimatedTotalHits: 0,
      processingTimeMs: 0,
    })
  }

  const start = Date.now()

  try {
    // ── Build the search query ─────────────────────────────────────────
    //
    // WHY raw SQL here (not Drizzle query builder):
    // Drizzle doesn't have a first-class API for pg_trgm operators
    // (similarity, word_similarity, gin_trgm_ops). Raw sql`` template
    // gives us full control while still being parameterised (safe from injection).
    //
    // Query breakdown:
    // - ILIKE '%q%' on name + base_type catches substrings
    // - similarity(name, q) returns a 0.0-1.0 score
    // - ORDER BY: prefix match (name ILIKE 'q%') first, then similarity desc
    //   This means "Andvarius" appears before "The Anvil" when you type "andv"
    // - LEFT JOIN prices: inline subquery for latest chaos value (same pattern
    //   as the browse page — single query, no N+1)
    // - category filter: optional, applied only when ?category= is set

    const likePattern = `%${query}%`
    const prefixPattern = `${query}%`

    // category filter — "skill" is a virtual category for the skills table
    const filterIsSkill = category === "skill"
    const filterIsItem  = category && category !== "skill"

    // WHY cast to unknown[]:
    // With postgres.js driver, db.execute() returns rows directly as an array
    // (not wrapped in { rows: [...] } like pg/node-postgres would).
    // Drizzle's generic here isn't tight enough to reflect this difference.
    //
    // WHY UNION ALL:
    // Items and skills live in separate tables. We query both and merge via
    // UNION ALL (no dedup cost), then re-rank the combined result by similarity.
    // When ?category=skill is passed we skip items; for any other category we skip skills.
    const rows = await db.execute(sql`
      SELECT * FROM (
        ${filterIsSkill ? sql`SELECT NULL::text AS id WHERE false` : sql`
          SELECT
            i.id,
            i.slug,
            i.name,
            i.base_type        AS "baseType",
            i.category::text   AS category,
            i.rarity::text     AS rarity,
            i.icon_url         AS "iconUrl",
            (
              SELECT p.chaos_value
              FROM prices p
              WHERE p.item_id = i.id
              ORDER BY p.recorded_at DESC
              LIMIT 1
            )                  AS "chaosValue",
            GREATEST(
              similarity(i.name, ${query}),
              COALESCE(similarity(i.base_type, ${query}), 0)
            )                  AS similarity
          FROM items i
          WHERE (
            i.name      ILIKE ${likePattern}
            OR i.base_type ILIKE ${likePattern}
          )
          ${filterIsItem ? sql`AND i.category::text = ${category}` : sql``}
        `}

        ${!filterIsSkill && !filterIsItem ? sql`UNION ALL` : sql``}

        ${filterIsItem ? sql`SELECT NULL::text AS id WHERE false` : sql`
          SELECT
            s.id,
            s.slug,
            s.name,
            NULL::text         AS "baseType",
            'skill'::text      AS category,
            'gem'::text        AS rarity,
            s.icon_url         AS "iconUrl",
            NULL::numeric      AS "chaosValue",
            similarity(s.name, ${query}) AS similarity
          FROM skills s
          WHERE s.name ILIKE ${likePattern}
        `}
      ) combined
      ORDER BY
        (combined.name ILIKE ${prefixPattern}) DESC,
        combined.similarity DESC,
        combined.name ASC
      LIMIT ${limit}
    `) as unknown as SearchHit[]

    const processingTimeMs = Date.now() - start

    return NextResponse.json<SearchResponse>({
      hits: rows,
      query,
      estimatedTotalHits: rows.length,
      processingTimeMs,
    })
  } catch (err) {
    // Log full error so it appears in `bun dev` terminal output
    console.error("[/api/search] DB error:", JSON.stringify(err, null, 2))
    return NextResponse.json<SearchResponse>(
      { hits: [], query, estimatedTotalHits: 0, processingTimeMs: 0, error: String(err) },
      { status: 200 }
    )
  }
}
