import { db } from "@wraexcodex/db/client"
import { items } from "@wraexcodex/db/schema"
import { eq, sql, isNull } from "drizzle-orm"

/**
 * Icon + Enrichment Sync — poe.ninja API
 *
 * WHY poe.ninja and not GGG directly:
 * The GGG Trade API (/api/trade2/data/items) returns only names — no icons,
 * no stats, no prices. poe.ninja aggregates GGG game data and exposes it via
 * a clean JSON API with poecdn icon URLs, explicit modifiers, and live prices.
 *
 * WHAT this job does:
 * 1. Fetches currency icons from currencyoverview.currencyDetails
 * 2. Fetches unique/gem/map/etc icons + mods + prices from itemoverview
 * 3. Builds a name → enrichment map in memory
 * 4. Batch-updates our items table (50 rows per transaction)
 *
 * WHY match by name (not poeId):
 * poe.ninja doesn't know our internal poeIds. Names are the only common key.
 * For uniques this is 1:1. For base types with name collisions we update all
 * matching rows (same icon anyway — same base type).
 *
 * COVERAGE (estimated):
 * - Currency:      ~280 items with icons
 * - Unique items:  ~600+ with icons + mods + prices
 * - Gems:          ~200+ with icons
 * - Maps/Fragments: ~200+ with icons
 * Total: ~80% of the 2550 item catalog
 *
 * RATE LIMITING:
 * poe.ninja asks for a 1s delay between requests (their ToS).
 * We fetch ~12 endpoints total — ~12 seconds, well within limits.
 */

// ── Types ──────────────────────────────────────────────────────────────────

type Enrichment = {
  iconUrl: string
  explicitMods?: Array<{ text: string; optional: boolean }>
  implicitMods?: Array<{ text: string; optional: boolean }>
  flavourText?: string
  chaosValue?: number
  width?: number
  height?: number
}

// ── poe.ninja endpoint definitions ────────────────────────────────────────

const CURRENCY_TYPES = ["Currency", "Fragment"] as const

const ITEM_TYPES = [
  "UniqueWeapon",
  "UniqueArmour",
  "UniqueAccessory",
  "UniqueFlask",
  "UniqueJewel",
  "SkillGem",
  "DivinationCard",
  "Map",
  "Fragment",
  "Scarab",
  "Essence",
  "Allflame",
] as const

const LEAGUE = "Standard"
const BASE_URL = "https://poe.ninja/api/data"

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "WraexCodex/1.0 (contact@wraexcodex.com)",
      Accept: "application/json",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json() as Promise<T>
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Decode a poecdn gen/image URL to extract inventory width/height.
 * URL base64 payload: [25, 14, {"f":"...", "w":1, "h":2, "scale":1}]
 */
function decodeIconDimensions(iconUrl: string): { width: number; height: number } {
  try {
    const b64 = iconUrl.split("/gen/image/")[1]?.split("/")[0]
    if (!b64) return { width: 1, height: 1 }
    const decoded = JSON.parse(atob(b64))
    const params = decoded[2] as { w?: number; h?: number }
    return { width: params?.w ?? 1, height: params?.h ?? 1 }
  } catch {
    return { width: 1, height: 1 }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function syncIcons(): Promise<void> {
  console.log("[sync-icons] Starting icon + enrichment sync from poe.ninja...")

  // Master map: item name (lowercase) → enrichment data
  // WHY lowercase keys: item names differ in capitalisation between sources
  const enrichMap = new Map<string, Enrichment>()

  // ── Step 1: Currency icons ───────────────────────────────────────────────
  // currencyDetails has icons for currency; lines has the prices
  for (const type of CURRENCY_TYPES) {
    console.log(`[sync-icons] Fetching currency: ${type}...`)
    try {
      const data = await fetchJson<{
        lines: Array<{ currencyTypeName: string; chaosEquivalent?: number }>
        currencyDetails: Array<{ name: string; icon?: string; tradeId: string }>
      }>(`${BASE_URL}/currencyoverview?league=${LEAGUE}&type=${type}&game=poe2`)

      // Build price lookup from lines
      const priceMap = new Map(
        data.lines.map((l) => [l.currencyTypeName.toLowerCase(), l.chaosEquivalent])
      )

      for (const detail of data.currencyDetails) {
        if (!detail.icon) continue
        const key = detail.name.toLowerCase()
        const dims = decodeIconDimensions(detail.icon)
        enrichMap.set(key, {
          iconUrl: detail.icon,
          chaosValue: priceMap.get(key),
          ...dims,
        })
      }

      console.log(`[sync-icons]   → ${data.currencyDetails.filter((d) => d.icon).length} icons`)
    } catch (err) {
      console.error(`[sync-icons] Failed ${type}:`, err)
    }
    await sleep(1100) // poe.ninja rate limit courtesy
  }

  // ── Step 2: Item icons (uniques, gems, maps, etc.) ───────────────────────
  for (const type of ITEM_TYPES) {
    console.log(`[sync-icons] Fetching items: ${type}...`)
    try {
      const data = await fetchJson<{
        lines: Array<{
          name: string
          icon?: string
          chaosValue?: number
          explicitModifiers?: Array<{ text: string; optional: boolean }>
          implicitModifiers?: Array<{ text: string; optional: boolean }>
          flavourText?: string
        }>
      }>(`${BASE_URL}/itemoverview?league=${LEAGUE}&type=${type}&game=poe2`)

      let iconCount = 0
      for (const line of data.lines) {
        if (!line.icon) continue
        const key = line.name.toLowerCase()
        const dims = decodeIconDimensions(line.icon)

        // Only overwrite if we don't already have a richer entry
        // (some items appear in multiple type endpoints e.g. Fragment appears
        // in both currency and item endpoints)
        const existing = enrichMap.get(key)
        if (!existing || !existing.explicitMods?.length) {
          enrichMap.set(key, {
            iconUrl: line.icon,
            chaosValue: line.chaosValue,
            explicitMods: line.explicitModifiers?.filter((m) => m.text),
            implicitMods: line.implicitModifiers?.filter((m) => m.text),
            flavourText: line.flavourText || undefined,
            ...dims,
          })
        }
        iconCount++
      }
      console.log(`[sync-icons]   → ${iconCount} icons`)
    } catch (err) {
      console.error(`[sync-icons] Failed ${type}:`, err)
    }
    await sleep(1100)
  }

  console.log(`\n[sync-icons] Built enrichment map: ${enrichMap.size} unique item names`)

  // ── Step 3: Fetch all items from DB and match ────────────────────────────
  console.log("[sync-icons] Fetching items from DB...")
  const dbItems = await db
    .select({ id: items.id, name: items.name, poeId: items.poeId })
    .from(items)

  // Build update batches — only for items we have enrichment data for
  type UpdateRow = {
    id: string
    iconUrl: string
    width: number
    height: number
    chaosValue?: number
    explicits: Array<{ text: string; type: "explicit" }>
    implicits: Array<{ text: string; type: "implicit" }>
    flavourText?: string
  }

  const updates: UpdateRow[] = []
  let matchCount = 0
  let noMatchCount = 0

  for (const dbItem of dbItems) {
    const key = dbItem.name.toLowerCase()
    const enrichment = enrichMap.get(key)
    if (!enrichment) {
      noMatchCount++
      continue
    }

    matchCount++
    updates.push({
      id: dbItem.id,
      iconUrl: enrichment.iconUrl,
      width: enrichment.width ?? 1,
      height: enrichment.height ?? 1,
      chaosValue: enrichment.chaosValue,
      explicits: (enrichment.explicitMods ?? []).map((m) => ({
        text: m.text,
        type: "explicit" as const,
      })),
      implicits: (enrichment.implicitMods ?? []).map((m) => ({
        text: m.text,
        type: "implicit" as const,
      })),
      flavourText: enrichment.flavourText,
    })
  }

  console.log(`[sync-icons] Matched: ${matchCount} | No match: ${noMatchCount}`)

  // ── Step 4: Batch update DB ──────────────────────────────────────────────
  // WHY individual updates and not a single UPDATE ... CASE WHEN:
  // Drizzle ORM doesn't support bulk CASE WHEN updates cleanly.
  // Each item gets its own UPDATE — but we batch them in groups of 50
  // and run each batch concurrently to keep total time under 30 seconds.
  const BATCH_SIZE = 50
  let updatedCount = 0
  let errorCount = 0

  console.log(`[sync-icons] Updating ${updates.length} items in batches of ${BATCH_SIZE}...`)

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (row) => {
        try {
          await db
            .update(items)
            .set({
              iconUrl: row.iconUrl,
              width: row.width,
              height: row.height,
              explicits: row.explicits.length ? row.explicits : undefined,
              implicits: row.implicits.length ? row.implicits : undefined,
              flavourText: row.flavourText ?? undefined,
              updatedAt: new Date(),
            })
            .where(eq(items.id, row.id))
          updatedCount++
        } catch (err) {
          errorCount++
          console.error(`[sync-icons] Update failed for ${row.id}:`, err)
        }
      })
    )

    // Progress every 10 batches
    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(`[sync-icons]   ${updatedCount}/${updates.length} updated...`)
    }
  }

  // ── Step 5: Scrape poe2db for remaining items without icons ─────────────
  // Strategy: items still without icons are base types not covered by poe.ninja.
  // poe2db has a page for every item at /us/{Name_With_Underscores}.
  // We fetch og:image from each page in parallel (20 concurrent).
  //
  // WHY og:image and not direct CDN: cdn.poe2db.tw has hotlink protection
  // (returns 403 unless Referer is poe2db.tw). Parsing og:image from the
  // HTML page is the only reliable way to get the URL.
  //
  // Rate limiting: 20 concurrent with no sleep = ~100 req/s.
  // poe2db doesn't publish rate limits but we keep it reasonable.

  const itemsWithoutIcon = await db
    .select({ id: items.id, name: items.name })
    .from(items)
    .where(isNull(items.iconUrl))

  if (itemsWithoutIcon.length > 0) {
    console.log(`\n[sync-icons] Scraping poe2db for ${itemsWithoutIcon.length} base types...`)

    const POE2DB_CONCURRENCY = 20
    let scraped = 0
    let scrapeHit = 0
    let scrapeMiss = 0

    for (let i = 0; i < itemsWithoutIcon.length; i += POE2DB_CONCURRENCY) {
      const chunk = itemsWithoutIcon.slice(i, i + POE2DB_CONCURRENCY)

      await Promise.all(
        chunk.map(async (item) => {
          try {
            const slug = item.name
              .replace(/'/g, "")   // remove apostrophes
              .replace(/\s+/g, "_") // spaces → underscores
            const url = `https://poe2db.tw/us/${encodeURIComponent(slug)}`
            const res = await fetch(url, {
              headers: {
                "User-Agent": "WraexCodex/1.0 (contact@wraexcodex.com)",
                Accept: "text/html",
              },
              signal: AbortSignal.timeout(8000),
            })

            if (!res.ok) { scrapeMiss++; return }

            const html = await res.text()
            const match = html.match(/<meta property="og:image" content="([^"]+)"/)
            if (!match?.[1]) { scrapeMiss++; return }

            const iconUrl = match[1]
            await db.update(items).set({ iconUrl, updatedAt: new Date() }).where(eq(items.id, item.id))
            scrapeHit++
          } catch {
            scrapeMiss++
          } finally {
            scraped++
          }
        })
      )

      if (i % (POE2DB_CONCURRENCY * 10) === 0 && i > 0) {
        console.log(`[sync-icons]   Scraped ${scraped}/${itemsWithoutIcon.length} (${scrapeHit} hits)...`)
      }
    }

    console.log(`[sync-icons] poe2db scrape: ${scrapeHit} hits, ${scrapeMiss} misses`)
  }

  // ── Step 6: Verify ───────────────────────────────────────────────────────
  const [withIcons] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(items)
    .where(sql`icon_url IS NOT NULL`)

  const [total] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(items)

  const coverage = total.count > 0
    ? Math.round((withIcons.count / total.count) * 100)
    : 0

  console.log(`\n[sync-icons] ✓ Done`)
  console.log(`  Enrichment map:  ${enrichMap.size} names`)
  console.log(`  DB matched:      ${matchCount}`)
  console.log(`  DB updated:      ${updatedCount}`)
  console.log(`  DB errors:       ${errorCount}`)
  console.log(`  DB no match:     ${noMatchCount}`)
  console.log(`  Items with icon: ${withIcons.count} / ${total.count} (${coverage}%)`)
}
