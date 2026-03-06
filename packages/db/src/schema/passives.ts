import { pgTable, text, integer, jsonb, boolean, real, index, pgEnum } from "drizzle-orm/pg-core"
import { createId } from "../utils/id"

export const passiveTypeEnum = pgEnum("passive_type", [
  "normal",
  "notable",
  "keystone",
  "class_start",
  "ascendancy_start",
  "ascendancy_normal",
  "ascendancy_notable",
  "ascendancy_keystone",
  "socket",
  "mastery",
  "expansion_jewel",
])

/**
 * PASSIVE NODES TABLE
 *
 * Stores every node from the PoE2 passive tree JSON (from GGG's official API).
 *
 * Key decisions:
 * - `x` and `y` are the actual pixel coordinates from GGG's tree JSON.
 *   The Nexus renderer maps these directly — no transformation needed.
 * - `connections` is a denormalized array of connected node IDs.
 *   WHY: Rendering the tree requires knowing all edges. A separate edges table
 *   would need a massive JOIN every time the tree loads. Denormalized = one query.
 * - `stats` JSONB — each node has variable stats, can't be columnar.
 * - `orbit`/`orbitIndex` — GGG's tree uses a radial layout system,
 *   these values drive the Nexus renderer's position calculations.
 */
export const passiveNodes = pgTable(
  "passive_nodes",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    // GGG's node ID — integer in their API, we store as text for consistency
    nodeId: text("node_id").unique().notNull(),
    name: text("name").notNull(),
    type: passiveTypeEnum("type").notNull(),

    // Position in the tree canvas (from GGG JSON)
    x: real("x").notNull(),
    y: real("y").notNull(),

    // Radial layout data — needed by the Nexus renderer
    orbit: integer("orbit"),
    orbitIndex: integer("orbit_index"),
    group: integer("group"),

    // Connected node IDs — denormalized for O(1) edge lookup
    connections: jsonb("connections").$type<string[]>().default([]),

    // What the node gives you
    stats: jsonb("stats").$type<string[]>().default([]),

    // For keystones — detailed description panel
    description: text("description"),

    // Class association (null = any class can path to it)
    classStart: text("class_start"), // e.g. "Warrior", "Witch"

    // Ascendancy association (null = main tree)
    ascendancy: text("ascendancy"),

    isJewelSocket: boolean("is_jewel_socket").default(false),
    isMastery: boolean("is_mastery").default(false),

    iconUrl: text("icon_url"),

    dataVersion: text("data_version"),
  },
  (table) => [
    index("passives_node_id_idx").on(table.nodeId),
    index("passives_type_idx").on(table.type),
    index("passives_class_idx").on(table.classStart),
    index("passives_ascendancy_idx").on(table.ascendancy),
    // Spatial index for the Nexus — "give me all nodes in this viewport"
    // WHY: The Nexus pans and zooms. We only want to render visible nodes.
    // x/y range queries need these to be fast.
    index("passives_position_idx").on(table.x, table.y),
  ]
)

export type PassiveNode = typeof passiveNodes.$inferSelect
export type NewPassiveNode = typeof passiveNodes.$inferInsert
