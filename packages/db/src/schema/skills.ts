import { pgTable, text, integer, jsonb, timestamp, boolean, index, pgEnum } from "drizzle-orm/pg-core"
import { createId } from "../utils/id"

export const gemTagEnum = pgEnum("gem_tag", [
  "active",
  "support",
  "aura",
  "trigger",
  "attack",
  "spell",
  "projectile",
  "area",
  "duration",
  "fire",
  "cold",
  "lightning",
  "chaos",
  "physical",
  "minion",
  "movement",
  "warcry",
  "stance",
])

/**
 * SKILLS TABLE
 *
 * Every active and support gem in PoE2.
 *
 * Key decisions:
 * - `levelData` JSONB stores the stat progression across all 20 levels
 *   rather than 20 separate rows. Reads are almost always "give me all levels"
 *   so this avoids a JOIN and keeps queries simple.
 * - `qualityStats` — alternative quality effects from vendor recipes
 * - `supportCompatibility` — denormalized array of support gem IDs that work
 *   with this skill. Redundant but makes the "what supports work?" query O(1).
 */
export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    poeId: text("poe_id").unique().notNull(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),

    isSupport: boolean("is_support").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    // Tags drive the support compatibility matrix
    tags: jsonb("tags").$type<string[]>().default([]),

    // Icon — served from Supabase Storage
    iconUrl: text("icon_url"),

    // Per-level stat progression
    // Shape: [{ level: 1, mana: 6, damage: 100, ... }, ...]
    levelData: jsonb("level_data").$type<SkillLevelData[]>().default([]),

    // Quality effects
    qualityStats: jsonb("quality_stats").$type<QualityStat[]>().default([]),

    // Description shown to users
    description: text("description"),
    loreText: text("lore_text"),

    // Denormalized list of compatible support gem IDs
    // WHY: Avoids a many-to-many JOIN on every skill page load
    supportCompatibility: jsonb("support_compatibility").$type<string[]>().default([]),

    // Gem requirements
    requiresLevel: integer("requires_level").default(1),
    requiresStr: integer("requires_str"),
    requiresDex: integer("requires_dex"),
    requiresInt: integer("requires_int"),

    // SEO
    metaDescription: text("meta_description"),

    dataVersion: text("data_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("skills_slug_idx").on(table.slug),
    index("skills_poe_id_idx").on(table.poeId),
    index("skills_name_idx").on(table.name),
    // Filtering by active vs support is very common
    index("skills_type_idx").on(table.isSupport, table.isActive),
  ]
)

export type SkillLevelData = {
  level: number
  manaCost?: number
  manaMultiplier?: number
  criticalStrikeChance?: number
  attacksPerSecond?: number
  damage?: number
  experienceRequired?: number
  stats: Record<string, number>
}

export type QualityStat = {
  type: "default" | "anomalous" | "divergent" | "phantasmal"
  description: string
  stats: Record<string, number>
}

export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
