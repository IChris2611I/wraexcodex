import { db } from "@wraexcodex/db/client"
import { passiveNodes } from "@wraexcodex/db/schema"

/**
 * Passive Tree Sync — poe2db.tw
 *
 * WHY poe2db and not GGG directly:
 * The GGG passive tree endpoint (pathofexile.com/passive-skill-tree/passive-tree-2)
 * returns HTML — the tree data is embedded in JS bundles, not a REST endpoint.
 *
 * poe2db.tw maintains a cleaned JSON export at:
 *   https://poe2db.tw/data/passive-skill-tree/4.4/data_us.json
 *
 * This is 1.6MB of clean JSON with:
 * - 4,976 nodes with pre-calculated x/y positions
 * - Connections as { id, orbit } pairs
 * - Stats arrays, keystone flags, flavour text
 * - Icon URLs pointing to cdn.poe2db.tw (webp, publicly accessible)
 * - All 12 classes + their real ascendancies
 *
 * The version "4.4" corresponds to PoE2 Early Access patch series.
 * Update this when GGG ships major tree revisions.
 */

// ── poe2db tree schema ─────────────────────────────────────────────────────

type Connection = { id: string; orbit: number }

type RawNode = {
  skill: number
  name?: string
  icon?: string
  stats?: string[]
  flavourText?: string[]
  group?: number
  orbit?: number
  orbitIndex?: number
  out?: string[]
  in?: string[]
  connections?: Connection[]
  isKeystone?: boolean
  isNotable?: boolean
  isJewelSocket?: boolean
  isMastery?: boolean
  isAscendancyStart?: boolean
  classStartIndex?: number
  ascendancyName?: string
}

type TreeData = {
  nodes: Record<string, RawNode>
  groups: Record<string, { x: number; y: number; orbits: number[]; nodes: string[] }>
  constants: { orbitRadii: number[]; skillsPerOrbit: number[] }
  classes: Array<{ name: string; ascendancies?: string[] }>
}

// ── Class start mapping ────────────────────────────────────────────────────

// PoE2 classes by start node index (classStartIndex in tree data)
const CLASS_STARTS: Record<number, string> = {
  0:  "Warrior",
  1:  "Ranger",
  2:  "Witch",
  3:  "Sorceress",
  4:  "Mercenary",
  5:  "Monk",
  6:  "Huntress",
  7:  "Druid",
}

// ── Node type resolution ───────────────────────────────────────────────────

type NodeType =
  | "normal"
  | "notable"
  | "keystone"
  | "class_start"
  | "ascendancy_start"
  | "ascendancy_normal"
  | "ascendancy_notable"
  | "ascendancy_keystone"
  | "socket"
  | "mastery"
  | "expansion_jewel"

function resolveNodeType(node: RawNode): NodeType {
  if (node.classStartIndex !== undefined) return "class_start"
  if (node.isAscendancyStart) return "ascendancy_start"
  if (node.isJewelSocket) return "socket"
  if (node.isMastery) return "mastery"

  const inAscendancy = Boolean(node.ascendancyName)
  if (node.isKeystone) return inAscendancy ? "ascendancy_keystone" : "keystone"
  if (node.isNotable) return inAscendancy ? "ascendancy_notable" : "notable"
  if (inAscendancy) return "ascendancy_normal"
  return "normal"
}

// ── Main ───────────────────────────────────────────────────────────────────

const TREE_URL = "https://poe2db.tw/data/passive-skill-tree/4.4/data_us.json?1"

export async function syncPassives(): Promise<void> {
  console.log("[sync-passives] Fetching PoE2 passive tree from poe2db...")

  const res = await fetch(TREE_URL, {
    headers: {
      "User-Agent": "WraexCodex/1.0 (contact@wraexcodex.com)",
      Accept: "application/json",
      // Required: poe2db serves this only with a browser-like request
      "Referer": "https://poe2db.tw/us/passive-skill-tree/",
    },
  })

  if (!res.ok) throw new Error(`poe2db returned ${res.status}`)

  const data = await res.json() as TreeData
  const { nodes, groups, constants } = data

  console.log(`[sync-passives] ${Object.keys(nodes).length} nodes, ${Object.keys(groups).length} groups`)

  // Build all rows first, then batch-insert
  // WHY batch: 4976 individual awaits × ~5ms each = 25 seconds.
  // Inserting 100 rows per statement = ~50 statements = ~3 seconds total.
  type NodeRow = typeof passiveNodes.$inferInsert

  const rows: NodeRow[] = []
  let skipCount = 0

  for (const [nodeIdStr, node] of Object.entries(nodes)) {
    if (!node.name && !node.stats?.length) { skipCount++; continue }

    const group = node.group !== undefined ? groups[node.group.toString()] : undefined
    let x = 0
    let y = 0

    if (group && node.orbit !== undefined && node.orbitIndex !== undefined) {
      const radius = constants.orbitRadii[node.orbit] ?? 0
      const skillsInOrbit = constants.skillsPerOrbit[node.orbit] ?? 1
      const angle = (2 * Math.PI * node.orbitIndex) / skillsInOrbit - Math.PI / 2
      x = Math.round(group.x + radius * Math.cos(angle))
      y = Math.round(group.y + radius * Math.sin(angle))
    }

    const connectionIds = new Set<string>()
    for (const id of node.out ?? []) connectionIds.add(id)
    for (const id of node.in ?? []) connectionIds.add(id)
    for (const c of node.connections ?? []) connectionIds.add(c.id)

    const type = resolveNodeType(node)
    const classStart = node.classStartIndex !== undefined
      ? (CLASS_STARTS[node.classStartIndex] ?? null)
      : null
    const description = [
      ...(node.stats ?? []),
      ...(node.flavourText ?? []),
    ].join("\n") || null

    rows.push({
      nodeId: nodeIdStr,
      name: node.name ?? "",
      type,
      x,
      y,
      orbit: node.orbit ?? null,
      orbitIndex: node.orbitIndex ?? null,
      group: node.group ?? null,
      connections: [...connectionIds],
      stats: node.stats ?? [],
      description,
      classStart,
      ascendancy: node.ascendancyName ?? null,
      isJewelSocket: node.isJewelSocket ?? false,
      isMastery: node.isMastery ?? false,
      iconUrl: node.icon ?? null,
      dataVersion: "4.4",
    })
  }

  console.log(`[sync-passives] Prepared ${rows.length} rows (${skipCount} skipped), inserting in batches...`)

  const BATCH = 100
  let upsertCount = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await db
      .insert(passiveNodes)
      .values(batch)
      .onConflictDoUpdate({
        target: passiveNodes.nodeId,
        set: {
          name: passiveNodes.name,
          type: passiveNodes.type,
          x: passiveNodes.x,
          y: passiveNodes.y,
          connections: passiveNodes.connections,
          stats: passiveNodes.stats,
          description: passiveNodes.description,
          iconUrl: passiveNodes.iconUrl,
          dataVersion: passiveNodes.dataVersion,
        },
      })
    upsertCount += batch.length
  }

  console.log(`[sync-passives] ✓ Done — ${upsertCount} nodes upserted, ${skipCount} skipped`)
}
