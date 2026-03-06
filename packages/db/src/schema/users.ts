import { pgTable, text, integer, jsonb, timestamp, boolean, index, pgEnum } from "drizzle-orm/pg-core"
import { createId } from "../utils/id"

export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin"])

export const userReputationEnum = pgEnum("user_reputation", [
  "apprentice",    // 0 - 99 points
  "journeyman",    // 100 - 499
  "master",        // 500 - 1999
  "legend",        // 2000+
])

/**
 * USERS TABLE
 *
 * WHY we sync Clerk data into our own DB:
 * Clerk manages auth and identity. But our app needs to reference users
 * in builds, comments, and votes — these are DB relationships. We can't
 * put Clerk user IDs as foreign keys into Supabase and then JOIN against
 * Clerk's API on every query. So we sync a lightweight user record.
 *
 * The `clerkId` is the source of truth for identity. Our `id` is the
 * internal DB key used in all foreign key relationships.
 *
 * Webhook: Clerk → our /api/webhooks/clerk → upsert this table.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    // Clerk's user ID — synced via webhook
    clerkId: text("clerk_id").unique().notNull(),

    username: text("username").unique().notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    email: text("email").notNull(),

    role: userRoleEnum("role").default("user").notNull(),
    reputation: userReputationEnum("reputation").default("apprentice").notNull(),
    reputationPoints: integer("reputation_points").default(0).notNull(),

    // Linked PoE2 account — optional, enables character display
    poeAccountName: text("poe_account_name"),
    poeAccountVerified: boolean("poe_account_verified").default(false),

    // Preferences
    preferences: jsonb("preferences").$type<UserPreferences>().default({
      emailNotifications: true,
      buildUpdates: true,
      weeklyMeta: true,
    }),

    // Pro subscription status
    isPro: boolean("is_pro").default(false).notNull(),
    proExpiresAt: timestamp("pro_expires_at", { withTimezone: true }),

    // Saved items for quick access
    savedBuildIds: jsonb("saved_build_ids").$type<string[]>().default([]),
    savedItemIds: jsonb("saved_item_ids").$type<string[]>().default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    index("users_clerk_id_idx").on(table.clerkId),
    index("users_username_idx").on(table.username),
    index("users_poe_account_idx").on(table.poeAccountName),
  ]
)

export type UserPreferences = {
  emailNotifications: boolean
  buildUpdates: boolean
  weeklyMeta: boolean
  theme?: "dark" | "darker"
}

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
