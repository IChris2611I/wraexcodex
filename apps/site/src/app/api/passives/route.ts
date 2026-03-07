/**
 * GET /api/passives
 *
 * Serves all passive tree nodes for the Nexus renderer.
 *
 * WHY a dedicated API route instead of a Server Component query?
 * The Nexus is a "use client" Three.js canvas — it can't call the DB directly.
 * This route is the data bridge. It's cached at the edge for 1 hour since
 * passive tree data only changes when GGG releases a patch.
 *
 * Response shape is intentionally minimal — only what the renderer needs.
 * Trimming unused fields (description, iconUrl, dataVersion) cuts ~40% payload size.
 */

import { NextResponse } from "next/server"
import { db } from "@wraexcodex/db"
import { passiveNodes } from "@wraexcodex/db/schema"

export const revalidate = 3600 // ISR: re-fetch from DB once per hour

export type PassiveNodeDTO = {
  id: string
  nodeId: string
  name: string
  type: string
  x: number
  y: number
  stats: string[]
  connections: string[]
  description: string | null
  classStart: string | null
  ascendancy: string | null
  isJewelSocket: boolean
  isMastery: boolean
}

export async function GET() {
  try {
    const nodes = await db
      .select({
        id: passiveNodes.id,
        nodeId: passiveNodes.nodeId,
        name: passiveNodes.name,
        type: passiveNodes.type,
        x: passiveNodes.x,
        y: passiveNodes.y,
        stats: passiveNodes.stats,
        connections: passiveNodes.connections,
        description: passiveNodes.description,
        classStart: passiveNodes.classStart,
        ascendancy: passiveNodes.ascendancy,
        isJewelSocket: passiveNodes.isJewelSocket,
        isMastery: passiveNodes.isMastery,
      })
      .from(passiveNodes)

    return NextResponse.json(
      { nodes, count: nodes.length },
      {
        headers: {
          // Cache at CDN edge for 1 hour, serve stale for up to 24h while revalidating
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    )
  } catch (err) {
    console.error("[/api/passives] DB error:", err)
    return NextResponse.json({ error: "Failed to load passive tree" }, { status: 500 })
  }
}
