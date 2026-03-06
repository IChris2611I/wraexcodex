/**
 * @wraexcodex/db — public API
 *
 * Consumers import from "@wraexcodex/db" and get:
 * - `db` — the typed Drizzle client
 * - All schema types for use in TypeScript
 *
 * They import from "@wraexcodex/db/schema" if they need raw table objects
 * (e.g. for building complex queries with `eq`, `and`, etc.)
 */

export { db } from "./client"
export type { Database } from "./client"

// Re-export drizzle query helpers so consumers don't need to install drizzle-orm separately
// (avoids version mismatch between packages)
export { eq, and, or, sql, desc, asc, gt, gte, lt, lte, isNull, isNotNull, inArray } from "drizzle-orm"
export type { SQL } from "drizzle-orm"

// Re-export all inferred types for consumers
export type { Item, NewItem, ItemMod } from "./schema/items"
export type { Skill, NewSkill, SkillLevelData, QualityStat } from "./schema/skills"
export type { PassiveNode, NewPassiveNode } from "./schema/passives"
export type { Boss, NewBoss, BossAbility, BossDrop } from "./schema/bosses"
export type { Build, NewBuild, GearSetup, SkillLink, GuideSection } from "./schema/builds"
export type { User, NewUser, UserPreferences } from "./schema/users"
export type { Price, NewPrice, PricePoint } from "./schema/prices"
