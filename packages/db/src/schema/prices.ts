import { pgTable, text, real, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core"
import { createId } from "../utils/id"
import { items } from "./items"

/**
 * PRICES TABLE
 *
 * Live economy data sourced from poe.ninja API.
 *
 * WHY a separate prices table (not just a column on items):
 * - Prices change every 5-15 minutes (poe.ninja update frequency)
 * - We want historical data — chart how a mirror's price changed over a league
 * - Multiple league snapshots: same item has different prices in Settlers vs Standard
 * - The items table is updated nightly from GGG API; prices update every 15 minutes.
 *   Mixing cadences in the same table creates update conflicts.
 *
 * WHY `chaosValue` as the canonical currency:
 * All PoE2 prices denominate in chaos orbs — the base currency.
 * `divineValue` is derived: chaosValue / current chaos-per-divine rate.
 */
export const prices = pgTable(
  "prices",
  {
    id: text("id").primaryKey().$defaultFn(createId),

    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),

    // League snapshot — "Settlers", "Standard", etc.
    league: text("league").notNull(),

    // Canonical price in chaos orbs
    chaosValue: real("chaos_value").notNull(),
    // Derived — convenient for display
    divineValue: real("divine_value"),

    // poe.ninja extra data
    listingCount: integer("listing_count"),
    exaltedValue: real("exalted_value"),

    // Price history — stored as time series in same row for simple items.
    // Shape: [{ timestamp: "2025-03-01T00:00:00Z", chaosValue: 45 }]
    // WHY here: avoids a separate price_history table for simple lookups.
    // For charting we want last 7 days — JSONB array is fast for small slices.
    // For full league history we'd query a time-series table (future feature).
    priceHistory7d: jsonb("price_history_7d").$type<PricePoint[]>().default([]),

    // Trend indicators — precomputed by the background job
    trendDirection: text("trend_direction").$type<"rising" | "falling" | "stable">(),
    trendPercent: real("trend_percent"), // % change over 24h

    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // The hot query: "what's the current price of item X in league Y?"
    index("prices_item_league_idx").on(table.itemId, table.league),
    // Economy dashboard — "show me all prices in current league, sorted by value"
    index("prices_league_chaos_idx").on(table.league, table.chaosValue),
    // Freshness check — "how old is this data?"
    index("prices_recorded_idx").on(table.recordedAt),
  ]
)

export type PricePoint = {
  timestamp: string // ISO 8601
  chaosValue: number
}

export type Price = typeof prices.$inferSelect
export type NewPrice = typeof prices.$inferInsert
