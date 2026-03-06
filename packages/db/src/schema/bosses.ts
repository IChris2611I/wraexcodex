import { pgTable, text, integer, jsonb, timestamp, real, index } from "drizzle-orm/pg-core"
import { createId } from "../utils/id"

/**
 * BOSSES TABLE
 *
 * Every boss and notable monster in PoE2.
 * Optimised for the "reverse lookup" use case: "what drops this item?"
 */
export const bosses = pgTable(
  "bosses",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    poeId: text("poe_id").unique().notNull(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    areaName: text("area_name"),
    areaSlug: text("area_slug"),

    // Resistances — stored as percentage values (-100 to 100)
    fireResist: real("fire_resist").default(0),
    coldResist: real("cold_resist").default(0),
    lightningResist: real("lightning_resist").default(0),
    chaosResist: real("chaos_resist").default(0),

    // Abilities — structured for phase breakdown display
    // Shape: [{ phase: 1, name: "Slam", description: "...", icon: "..." }]
    abilities: jsonb("abilities").$type<BossAbility[]>().default([]),

    // Drop table — item IDs this boss can drop
    // WHY: JSONB here since drop tables rarely need to be queried in isolation.
    // When we need "what drops item X?" we query items.dropMonsters instead
    // (items know their sources, not the other way around).
    dropTable: jsonb("drop_table").$type<BossDrop[]>().default([]),

    // Weaknesses — elements/ailments this boss is vulnerable to
    weaknesses: jsonb("weaknesses").$type<string[]>().default([]),

    // Community tips — community-submitted, reviewed before display
    tips: jsonb("tips").$type<CommunityTip[]>().default([]),

    // Lore
    loreText: text("lore_text"),
    iconUrl: text("icon_url"),
    imageUrl: text("image_url"),

    // Combat stats
    life: integer("life"),
    energyShield: integer("energy_shield"),
    armorRating: integer("armor_rating"),
    evasionRating: integer("evasion_rating"),

    metaDescription: text("meta_description"),
    dataVersion: text("data_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bosses_slug_idx").on(table.slug),
    index("bosses_poe_id_idx").on(table.poeId),
    index("bosses_area_idx").on(table.areaSlug),
  ]
)

export type BossAbility = {
  phase: number
  name: string
  description: string
  iconUrl?: string
  isCritical?: boolean // "if you don't dodge this, you die"
}

export type BossDrop = {
  itemId: string
  itemName: string
  dropChance?: "always" | "rare" | "very_rare" | "conditional"
  condition?: string
}

export type CommunityTip = {
  text: string
  authorId: string
  upvotes: number
  verified: boolean
}

export type Boss = typeof bosses.$inferSelect
export type NewBoss = typeof bosses.$inferInsert
