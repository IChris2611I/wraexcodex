import { pgTable, text, integer, boolean, jsonb, timestamp, index, pgEnum } from "drizzle-orm/pg-core"
import { createId } from "../utils/id"

/**
 * WHY enums in the DB (not just TypeScript):
 * PostgreSQL enums are stored as integers internally — fast comparisons,
 * less storage. They also enforce valid values at the DB level, catching
 * bad data before it reaches our code.
 */
export const itemRarityEnum = pgEnum("item_rarity", [
  "normal",
  "magic",
  "rare",
  "unique",
  "currency",
  "gem",
  "fragment",
  "divination",
])

export const itemCategoryEnum = pgEnum("item_category", [
  "weapon",
  "armour",
  "accessory",
  "flask",
  "gem",
  "currency",
  "map",
  "fragment",
  "divination_card",
  "misc",
])

/**
 * ITEMS TABLE
 *
 * The heart of Wraex Codex. Every item in PoE2.
 *
 * Design decisions:
 * - `slug` for human-readable URLs (/items/mirror-of-kalandra) — critical for SEO
 * - `stats` as JSONB — item stats vary wildly by type, rigid columns would break
 * - `implicits`/`explicits` as JSONB arrays — matches PoE2 API structure exactly
 * - Separate `lore_text` column for the AI Lore Companion to query efficiently
 * - `search_vector` will be a tsvector for full-text search fallback (Meilisearch is primary)
 */
export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    // Unique machine-friendly identifier — mirrors PoE2 API
    poeId: text("poe_id").unique().notNull(),
    // Human-readable URL slug
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    baseType: text("base_type"),
    rarity: itemRarityEnum("rarity").notNull(),
    category: itemCategoryEnum("category").notNull(),
    subCategory: text("sub_category"),

    // Visual
    iconUrl: text("icon_url"),
    modelUrl: text("model_url"), // For 3D viewer
    width: integer("width").default(1),
    height: integer("height").default(1),

    // Stats — JSONB for flexibility across item types
    // Shape: { requiresLevel?: number, strength?: number, ... }
    stats: jsonb("stats").$type<Record<string, number | string>>(),

    // Modifiers — arrays of mod objects
    // Shape: [{ text: "Adds 10-20 Cold Damage", type: "implicit" }]
    implicits: jsonb("implicits").$type<ItemMod[]>().default([]),
    explicits: jsonb("explicits").$type<ItemMod[]>().default([]),

    // Lore — indexed separately for AI queries
    loreText: text("lore_text"),
    flavourText: text("flavour_text"),

    // Drop information
    dropEnabled: boolean("drop_enabled").default(true),
    dropLevelMin: integer("drop_level_min"),
    dropLevelMax: integer("drop_level_max"),
    // JSON array of area names where this drops
    dropAreas: jsonb("drop_areas").$type<string[]>().default([]),
    // Monsters that drop this specifically
    dropMonsters: jsonb("drop_monsters").$type<string[]>().default([]),

    // SEO
    metaDescription: text("meta_description"),

    // Data freshness
    dataVersion: text("data_version"), // e.g. "3.26.0"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // WHY these indexes:
    // - slug: every item page load hits this — must be instant
    // - category + rarity: browse/filter pages query this constantly
    // - poeId: sync jobs update by poeId — needs to be fast
    // - name: search fallback if Meilisearch is unavailable
    index("items_slug_idx").on(table.slug),
    index("items_category_rarity_idx").on(table.category, table.rarity),
    index("items_poe_id_idx").on(table.poeId),
    index("items_name_idx").on(table.name),
  ]
)

// TypeScript type for item modifiers — used in JSONB columns
export type ItemMod = {
  text: string
  type: "implicit" | "explicit" | "crafted" | "fractured" | "enchanted"
  magnitudes?: Array<{ hash: string; min: number; max: number }>
}

export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
