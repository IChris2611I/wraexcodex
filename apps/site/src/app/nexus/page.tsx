/**
 * /nexus — The Nexus: 3D Passive Skill Tree
 *
 * This is a Server Component (no "use client") — it handles metadata + layout.
 * The actual Three.js canvas lives in NexusLoader (a Client Component) which
 * owns the dynamic() import with ssr:false. Next.js 15 requires ssr:false to
 * live inside a Client Component, not a Server Component.
 */

import type { Metadata } from "next"
import { NexusLoader } from "@/components/nexus/NexusLoader"

export const metadata: Metadata = {
  title: "The Nexus — Passive Skill Tree",
  description:
    "Explore the Path of Exile 2 passive skill tree interactively. All 4,975+ nodes visualized — zoom, pan, hover for stats, click to plan your build.",
  keywords: ["PoE2 passive tree", "Path of Exile 2 passives", "passive skill tree", "build planner"],
}

export default function NexusPage() {
  return (
    <div
      className="overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      <NexusLoader />
    </div>
  )
}
