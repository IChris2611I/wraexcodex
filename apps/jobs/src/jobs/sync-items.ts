import { db } from "@wraexcodex/db/client"
import { items } from "@wraexcodex/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

/**
 * Item Sync Job
 *
 * Data sources (in priority order):
 * 1. PoE2 Official API — https://www.pathofexile.com/api/trade2/data/items
 *    The canonical source. Requires a User-Agent header. Rate limit: 1 req/sec.
 * 2. PoE Wiki Cargo API — https://www.poewiki.net/w/api.php (MediaWiki Cargo)
 *    More detailed lore and descriptions. No rate limit but be respectful.
 *
 * WHY upsert (not insert):
 * Items change between patches. We want to update existing records, not
 * create duplicates. Drizzle's onConflictDoUpdate with poeId as the conflict
 * key gives us idempotent syncs — safe to run multiple times.
 */

// Zod schema for GGG API response validation
// WHY Zod here: External API data is untrusted. If GGG changes their schema
// we want a loud failure, not silent corruption of our database.
const PoeApiItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  icon: z.string().optional(),
})

const PoeApiResponseSchema = z.object({
  result: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      entries: z.array(PoeApiItemSchema),
    })
  ),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function syncItems(): Promise<void> {
  console.log("[sync-items] Starting item sync from PoE2 API...")

  const res = await fetch("https://www.pathofexile.com/api/trade2/data/items", {
    headers: {
      // GGG requires a descriptive User-Agent — anonymous requests may be blocked
      "User-Agent": "LootReference/1.0 (contact@lootreference.com)",
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    throw new Error(`PoE2 API returned ${res.status}: ${res.statusText}`)
  }

  const rawData: unknown = await res.json()
  const parsed = PoeApiResponseSchema.safeParse(rawData)

  if (!parsed.success) {
    console.error("[sync-items] API response validation failed:", parsed.error.format())
    throw new Error("PoE2 API response did not match expected schema")
  }

  let upsertCount = 0
  let errorCount = 0

  for (const category of parsed.data.result) {
    for (const entry of category.entries) {
      const slug = toSlug(entry.name)

      try {
        await db
          .insert(items)
          .values({
            poeId: entry.id,
            slug,
            name: entry.name,
            baseType: entry.type ?? null,
            // TODO: Map category.label to our itemCategoryEnum
            rarity: "normal",
            category: "misc",
            iconUrl: entry.icon ?? null,
            dataVersion: new Date().toISOString().slice(0, 10),
          })
          .onConflictDoUpdate({
            target: items.poeId,
            set: {
              name: entry.name,
              baseType: entry.type ?? null,
              iconUrl: entry.icon ?? null,
              updatedAt: new Date(),
            },
          })

        upsertCount++
      } catch (error) {
        errorCount++
        console.error(`[sync-items] Failed to upsert item ${entry.name}:`, error)
      }
    }
  }

  console.log(`[sync-items] Done. Upserted: ${upsertCount}, Errors: ${errorCount}`)
}
