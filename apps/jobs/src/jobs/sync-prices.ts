import { db } from "@wraexcodex/db/client"
import { prices, items } from "@wraexcodex/db/schema"
import { inArray } from "drizzle-orm"
import { z } from "zod"

/**
 * Price Sync Job — poe.ninja integration
 *
 * poe.ninja is the community's canonical price source.
 * They aggregate trade listings and compute median prices every 5-10 minutes.
 *
 * API docs: https://poe.ninja/swagger (no auth required)
 * Rate limit: be polite — max 1 request per 5 minutes per endpoint.
 *
 * Endpoints we care about:
 * - /api/data/itemoverview?league={league}&type=UniqueWeapon
 * - /api/data/itemoverview?league={league}&type=UniqueArmour
 * - /api/data/currencyoverview?league={league}&type=Currency
 *
 * Performance strategy:
 * - Fetch all item names from poe.ninja for a type in one request
 * - Batch-resolve item IDs from DB in a single IN() query (not N separate lookups)
 * - Batch-insert all prices in chunks of 100 (not one row at a time)
 * - WHY insert (not upsert): prices table is a time-series log. The site queries
 *   ORDER BY recorded_at DESC LIMIT 1 to get the current price, so each sync
 *   run appends a new row rather than overwriting. Natural history for free.
 */

const PoeNinjaItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  chaosValue: z.number(),
  divineValue: z.number().optional(),
  listingCount: z.number().optional(),
  sparkline: z
    .object({
      data: z.array(z.number().nullable()),
    })
    .optional(),
})

const PoeNinjaResponseSchema = z.object({
  lines: z.array(PoeNinjaItemSchema),
})

// WHY "Mercenaries": this is the current active PoE2 league (as of Mar 2026).
// "Standard" with game=poe2 on poe.ninja returns PoE1 Standard items — wrong data.
// Update this env var (or the fallback) at the start of each new PoE2 league.
const CURRENT_LEAGUE = process.env.CURRENT_LEAGUE ?? "Mercenaries"

const ITEM_TYPES = [
  "UniqueWeapon",
  "UniqueArmour",
  "UniqueAccessory",
  "UniqueFlask",
  "UniqueJewel",
  "DivinationCard",
] as const

const BATCH_SIZE = 100

export async function syncPrices(): Promise<void> {
  console.log(`[sync-prices] Syncing prices for league: ${CURRENT_LEAGUE}`)

  for (const itemType of ITEM_TYPES) {
    await syncPriceType(itemType)
    await Bun.sleep(2000)
  }

  console.log("[sync-prices] Done.")
}

async function syncPriceType(itemType: string): Promise<void> {
  const url = `https://poe.ninja/api/data/itemoverview?league=${encodeURIComponent(CURRENT_LEAGUE)}&type=${itemType}&game=poe2`

  const res = await fetch(url, {
    headers: { "User-Agent": "WraexCodex/1.0 (contact@wraexcodex.com)" },
  })

  if (!res.ok) {
    console.error(`[sync-prices] poe.ninja returned ${res.status} for type ${itemType}`)
    return
  }

  const rawData: unknown = await res.json()
  const parsed = PoeNinjaResponseSchema.safeParse(rawData)

  if (!parsed.success) {
    console.error(`[sync-prices] Validation failed for ${itemType}:`, parsed.error.flatten())
    return
  }

  const lines = parsed.data.lines
  if (lines.length === 0) {
    console.log(`[sync-prices] ${itemType}: 0 results from poe.ninja`)
    return
  }

  // ── Step 1: batch-resolve item IDs from DB ─────────────────────────────
  // Single IN() query instead of N individual lookups.
  // WHY: for 800+ uniques, individual lookups = 800+ round trips to Supabase.
  // With the session pooler latency (~80ms), that's 64 seconds just for lookups.
  // One batched IN() query = ~5ms.
  const names = lines.map((l) => l.name)

  const dbItems = await db
    .select({ id: items.id, name: items.name })
    .from(items)
    .where(inArray(items.name, names))

  const nameToId = new Map(dbItems.map((i) => [i.name, i.id]))

  // ── Step 2: build price rows ───────────────────────────────────────────
  const now = new Date()
  const priceRows = lines
    .filter((line) => nameToId.has(line.name))
    .map((line) => {
      const sparklineData = line.sparkline?.data ?? []
      const history7d = sparklineData
        .filter((v): v is number => v !== null)
        .slice(-7)
        .map((chaosValue, i) => ({
          timestamp: new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
          chaosValue,
        }))

      const prev24h = sparklineData[sparklineData.length - 2]
      const curr = line.chaosValue
      const trendPercent = prev24h != null && prev24h !== 0 ? ((curr - prev24h) / prev24h) * 100 : 0
      const trendDirection: "rising" | "falling" | "stable" =
        Math.abs(trendPercent) < 2 ? "stable" : trendPercent > 0 ? "rising" : "falling"

      return {
        itemId: nameToId.get(line.name)!,
        league: CURRENT_LEAGUE,
        chaosValue: line.chaosValue,
        divineValue: line.divineValue ?? null,
        listingCount: line.listingCount ?? null,
        priceHistory7d: history7d,
        trendDirection,
        trendPercent,
        recordedAt: now,
      }
    })

  // ── Step 3: batch insert ───────────────────────────────────────────────
  let inserted = 0
  for (let i = 0; i < priceRows.length; i += BATCH_SIZE) {
    const batch = priceRows.slice(i, i + BATCH_SIZE)
    await db.insert(prices).values(batch)
    inserted += batch.length
  }

  const skipped = lines.length - priceRows.length
  console.log(
    `[sync-prices] ${itemType}: ${inserted} inserted` +
      (skipped > 0 ? `, ${skipped} skipped (not in items table)` : "")
  )
}
