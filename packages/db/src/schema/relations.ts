import { relations } from "drizzle-orm"
import { items } from "./items"
import { builds } from "./builds"
import { users } from "./users"
import { prices } from "./prices"

/**
 * DRIZZLE RELATIONS
 *
 * WHY explicit relations in Drizzle:
 * Drizzle doesn't auto-detect relations from FK constraints.
 * Declaring them here unlocks `db.query.users.findFirst({ with: { builds: true } })`
 * — Drizzle generates the optimal JOIN automatically.
 *
 * These are logical relations for the query API.
 * The actual FK constraints are defined in the table schemas above.
 */

export const usersRelations = relations(users, ({ many }) => ({
  builds: many(builds),
}))

export const buildsRelations = relations(builds, ({ one }) => ({
  author: one(users, {
    fields: [builds.authorId],
    references: [users.id],
  }),
}))

export const itemsRelations = relations(items, ({ many }) => ({
  prices: many(prices),
}))

export const pricesRelations = relations(prices, ({ one }) => ({
  item: one(items, {
    fields: [prices.itemId],
    references: [items.id],
  }),
}))
