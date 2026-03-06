import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core"
import { createId } from "../utils/id"
import { users } from "./users"

export const buildClassEnum = pgEnum("build_class", [
  "warrior",
  "ranger",
  "witch",
  "sorceress",
  "mercenary",
  "monk",
])

export const buildStatusEnum = pgEnum("build_status", [
  "draft",
  "published",
  "archived",
  "under_review",
])

export const buildDifficultyEnum = pgEnum("build_difficulty", ["starter", "intermediate", "advanced"])

/**
 * BUILDS TABLE
 *
 * Community and curated build guides.
 *
 * Key decisions:
 * - `gearSetup` JSONB — the gear is a snapshot. If an item changes in the DB,
 *   old builds should show what was valid when written, not the current state.
 * - `passiveTreeCode` — stores the Path of Building import code. The Nexus
 *   renders this live. We don't store node arrays — too large and the code
 *   is the canonical format players already understand.
 * - `budgetMin/Max` in divine orbs — allows the build browser cost filter.
 * - `patchVersion` — critical for "is this still good?" queries.
 * - `views`/`rating` — stored on the table for fast sorting without aggregation.
 *   Updated via background job (not on every view hit — too slow).
 */
export const builds = pgTable(
  "builds",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    slug: text("slug").unique().notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),

    // Author — FK to users
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Classification
    class: buildClassEnum("class").notNull(),
    ascendancy: text("ascendancy"),
    status: buildStatusEnum("status").default("draft").notNull(),
    difficulty: buildDifficultyEnum("difficulty").notNull(),

    // Tags — searchable labels e.g. ["tanky", "fast-mapper", "league-starter"]
    tags: jsonb("tags").$type<string[]>().default([]),

    // Budget estimate in divine orbs
    budgetMin: integer("budget_min").default(0),
    budgetMax: integer("budget_max").default(0),

    // The actual build content
    // Gear — snapshot of recommended items with notes
    gearSetup: jsonb("gear_setup").$type<GearSetup>(),
    // Path of Building code — Nexus renders this
    passiveTreeCode: text("passive_tree_code"),
    // Skill setup — main link + supports
    skillSetup: jsonb("skill_setup").$type<SkillLink[]>().default([]),
    // Written guide — stored as structured sections (not raw markdown)
    guideContent: jsonb("guide_content").$type<GuideSection[]>().default([]),

    // Videos — YouTube embeds
    videoUrls: jsonb("video_urls").$type<string[]>().default([]),

    // Patch metadata — for "is this still current?"
    patchVersion: text("patch_version").notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    // Performance metrics — updated by background job
    views: integer("views").default(0).notNull(),
    upvotes: integer("upvotes").default(0).notNull(),
    downvotes: integer("downvotes").default(0).notNull(),
    // Precomputed score = upvotes - downvotes + (views * 0.001)
    score: integer("score").default(0).notNull(),

    // Flags
    isStarter: boolean("is_starter").default(false).notNull(),
    isEndgame: boolean("is_endgame").default(false).notNull(),
    isProVerified: boolean("is_pro_verified").default(false).notNull(),

    metaDescription: text("meta_description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("builds_slug_idx").on(table.slug),
    index("builds_class_idx").on(table.class),
    index("builds_status_idx").on(table.status),
    // Build browser sorts by score — this is the hot query
    index("builds_score_idx").on(table.score),
    // Budget filter
    index("builds_budget_idx").on(table.budgetMin, table.budgetMax),
    // Author profile page
    index("builds_author_idx").on(table.authorId),
    // "Starter builds" toggle
    index("builds_flags_idx").on(table.isStarter, table.isEndgame, table.status),
  ]
)

// ---- Supporting types ----

export type GearSlot =
  | "helm"
  | "chest"
  | "gloves"
  | "boots"
  | "weapon"
  | "offhand"
  | "amulet"
  | "ring1"
  | "ring2"
  | "belt"
  | "flask1"
  | "flask2"
  | "flask3"
  | "flask4"
  | "flask5"

export type GearSetup = Partial<
  Record<
    GearSlot,
    {
      itemId?: string
      itemName: string
      notes?: string
      isBis?: boolean // Best in Slot
      budgetAlternative?: string
    }
  >
>

export type SkillLink = {
  skillId: string
  skillName: string
  supports: Array<{ skillId: string; skillName: string }>
  notes?: string
}

export type GuideSection = {
  id: string
  type: "intro" | "pros_cons" | "gear" | "passive_tree" | "skills" | "progression" | "endgame" | "faq"
  title: string
  content: string // Markdown
  order: number
}

export type Build = typeof builds.$inferSelect
export type NewBuild = typeof builds.$inferInsert
