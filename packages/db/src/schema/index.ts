/**
 * Schema barrel — exports all tables and relations.
 *
 * WHY barrel exports:
 * Drizzle-kit needs to scan one entry point for all tables.
 * Consumers (site, bot, jobs) import from "@wraexcodex/db/schema"
 * and get everything without knowing the internal file structure.
 */

export * from "./items"
export * from "./skills"
export * from "./passives"
export * from "./bosses"
export * from "./builds"
export * from "./users"
export * from "./prices"
export * from "./relations"
