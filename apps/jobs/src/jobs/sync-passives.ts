import { db } from "@wraexcodex/db/client"
import { passiveNodes } from "@wraexcodex/db/schema"
import { z } from "zod"

/**
 * Passive Tree Sync — GGG Official API
 *
 * GGG publishes the complete passive tree as JSON.
 * This powers The Nexus — our interactive passive tree renderer.
 *
 * PoE2 passive tree endpoint:
 * https://www.pathofexile.com/passive-skill-tree/passive-tree-2
 *
 * The response is a large JSON object (several MB) containing:
 * - groups: radial layout groups of nodes
 * - nodes: every passive node with position, stats, and connections
 * - constants: orbit radii and slot counts used for position calculation
 *
 * WHY we store this in Postgres (not just fetch from GGG API on demand):
 * - The tree JSON is 2-3MB. Fetching it on every Nexus page load would be slow.
 * - We need to query individual nodes (search, highlight by keyword).
 * - We enrich nodes with additional metadata (build popularity per node).
 * - We cache the full tree in Redis with a 1-hour TTL for The Nexus renderer.
 */

const PassiveNodeSchema = z.object({
  skill: z.number(),
  name: z.string().optional().default(""),
  icon: z.string().optional(),
  isKeystone: z.boolean().optional().default(false),
  isNotable: z.boolean().optional().default(false),
  isAscendancyStart: z.boolean().optional().default(false),
  isMultipleChoice: z.boolean().optional().default(false),
  isJewelSocket: z.boolean().optional().default(false),
  isMastery: z.boolean().optional().default(false),
  classStartIndex: z.number().optional(),
  ascendancyName: z.string().optional(),
  stats: z.array(z.string()).optional().default([]),
  description: z.string().optional(),
  out: z.array(z.number()).optional().default([]),
  in: z.array(z.number()).optional().default([]),
  group: z.number().optional(),
  orbit: z.number().optional(),
  orbitIndex: z.number().optional(),
})

const PassiveTreeResponseSchema = z.object({
  nodes: z.record(z.string(), PassiveNodeSchema),
  // Groups contain position data — we'll compute final x/y coordinates
  groups: z.record(
    z.string(),
    z.object({
      x: z.number(),
      y: z.number(),
      orbits: z.array(z.number()),
      nodes: z.array(z.string()),
    })
  ),
  constants: z.object({
    orbitRadii: z.array(z.number()),
    skillsPerOrbit: z.array(z.number()),
  }),
})

// Precompute x/y from group position + orbit/orbitIndex + constants
function computeNodePosition(
  node: z.infer<typeof PassiveNodeSchema>,
  group: { x: number; y: number } | undefined,
  constants: { orbitRadii: number[]; skillsPerOrbit: number[] }
): { x: number; y: number } {
  if (!group || node.orbit === undefined || node.orbitIndex === undefined) {
    return { x: 0, y: 0 }
  }

  const radius = constants.orbitRadii[node.orbit] ?? 0
  const skillsInOrbit = constants.skillsPerOrbit[node.orbit] ?? 1
  const angle = (2 * Math.PI * node.orbitIndex) / skillsInOrbit - Math.PI / 2

  return {
    x: group.x + radius * Math.cos(angle),
    y: group.y + radius * Math.sin(angle),
  }
}

const CLASS_STARTS: Record<number, string> = {
  0: "Warrior",
  1: "Ranger",
  2: "Witch",
  3: "Sorceress",
  4: "Mercenary",
  5: "Monk",
}

export async function syncPassives(): Promise<void> {
  console.log("[sync-passives] Fetching PoE2 passive tree...")

  const res = await fetch("https://www.pathofexile.com/passive-skill-tree/passive-tree-2", {
    headers: { "User-Agent": "LootReference/1.0 (contact@lootreference.com)" },
  })

  if (!res.ok) {
    throw new Error(`Passive tree API returned ${res.status}`)
  }

  const rawData: unknown = await res.json()
  const parsed = PassiveTreeResponseSchema.safeParse(rawData)

  if (!parsed.success) {
    console.error("[sync-passives] Validation failed:", parsed.error.format())
    throw new Error("Passive tree response did not match expected schema")
  }

  const { nodes, groups, constants } = parsed.data

  console.log(`[sync-passives] Processing ${Object.keys(nodes).length} nodes...`)

  let upsertCount = 0

  for (const [nodeIdStr, node] of Object.entries(nodes)) {
    const group = node.group !== undefined ? groups[node.group.toString()] : undefined
    const { x, y } = computeNodePosition(node, group, constants)

    // Build connections array from both outgoing and incoming edges
    const connections = [...new Set([...node.out, ...node.in])].map(String)

    let type: "normal" | "notable" | "keystone" | "class_start" | "ascendancy_start" | "ascendancy_normal" | "ascendancy_notable" | "ascendancy_keystone" | "socket" | "mastery" | "expansion_jewel" = "normal"
    if (node.isKeystone) type = "keystone"
    else if (node.isNotable) type = "notable"
    else if (node.classStartIndex !== undefined) type = "class_start"
    else if (node.isAscendancyStart) type = "ascendancy_start"
    else if (node.isJewelSocket) type = "socket"
    else if (node.isMastery) type = "mastery"

    await db
      .insert(passiveNodes)
      .values({
        nodeId: nodeIdStr,
        name: node.name,
        type,
        x,
        y,
        orbit: node.orbit ?? null,
        orbitIndex: node.orbitIndex ?? null,
        group: node.group ?? null,
        connections,
        stats: node.stats,
        description: node.description ?? null,
        classStart: node.classStartIndex !== undefined ? CLASS_STARTS[node.classStartIndex] ?? null : null,
        ascendancy: node.ascendancyName ?? null,
        isJewelSocket: node.isJewelSocket ?? false,
        isMastery: node.isMastery ?? false,
        iconUrl: node.icon ?? null,
        dataVersion: new Date().toISOString().slice(0, 10),
      })
      .onConflictDoUpdate({
        target: passiveNodes.nodeId,
        set: {
          name: node.name,
          x,
          y,
          connections,
          stats: node.stats,
          description: node.description ?? null,
          dataVersion: new Date().toISOString().slice(0, 10),
        },
      })

    upsertCount++
  }

  console.log(`[sync-passives] Done. ${upsertCount} nodes synced.`)
}
