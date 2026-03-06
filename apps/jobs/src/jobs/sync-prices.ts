import { db } from "@wraexcodex/db/client"
import { prices, items } from "@wraexcodex/db/schema"
import { eq } from "drizzle-orm"
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

// The current active league — should come from config/env in production
const CURRENT_LEAGUE = process.env.CURRENT_LEAGUE ?? "Standard"

// Confirmed working types for poe2 on poe.ninja (tested 2026-03-07)
const ITEM_TYPES = [
  "UniqueWeapon",
  "UniqueArmour",
  "UniqueAccessory",
  "UniqueFlask",
  "UniqueJewel",
  "DivinationCard",
] as const

export async function syncPrices(): Promise<void> {
  console.log(`[sync-prices] Syncing prices for league: ${CURRENT_LEAGUE}`)

  for (const itemType of ITEM_TYPES) {
    await syncPriceType(itemType)
    // Polite delay between requests
    await Bun.sleep(2000)
  }

  console.log("[sync-prices] Done.")
}

async function syncPriceType(itemType: string): Promise<void> {
  const url = `https://poe.ninja/api/data/itemoverview?league=${encodeURIComponent(CURRENT_LEAGUE)}&type=${itemType}`

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
    console.error(`[sync-prices] Validation failed for ${itemType}`)
    return
  }

  for (const line of parsed.data.lines) {
    // Find the item in our DB by name
    const [item] = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.name, line.name))
      .limit(1)

    if (!item) continue // Item not in our DB yet — sync-items hasn't run

    // Build 7-day history from sparkline data
    const sparklineData = line.sparkline?.data ?? []
    const history7d = sparklineData
      .filter((v): v is number => v !== null)
      .slice(-7)
      .map((chaosValue, i) => ({
        timestamp: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
        chaosValue,
      }))

    const prev24h = sparklineData[sparklineData.length - 2]
    const curr = line.chaosValue
    const trendPercent = prev24h ? ((curr - prev24h) / prev24h) * 100 : 0
    const trendDirection =
      Math.abs(trendPercent) < 2 ? "stable" : trendPercent > 0 ? "rising" : "falling"

    await db
      .insert(prices)
      .values({
        itemId: item.id,
        league: CURRENT_LEAGUE,
        chaosValue: line.chaosValue,
        divineValue: line.divineValue ?? null,
        listingCount: line.listingCount ?? null,
        priceHistory7d: history7d,
        trendDirection,
        trendPercent,
        recordedAt: new Date(),
      })
      .onConflictDoUpdate({
        // If price record for this item+league exists, update it
        target: [prices.itemId, prices.league],
        set: {
          chaosValue: line.chaosValue,
          divineValue: line.divineValue ?? null,
          listingCount: line.listingCount ?? null,
          priceHistory7d: history7d,
          trendDirection,
          trendPercent,
          recordedAt: new Date(),
        },
      })
  }

  console.log(`[sync-prices] ${itemType}: ${parsed.data.lines.length} prices synced`)
}
