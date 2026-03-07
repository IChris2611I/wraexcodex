/**
 * /nexus — The Nexus: 3D Passive Skill Tree
 *
 * WHY dynamic import with ssr: false?
 * Three.js uses WebGL APIs (canvas, WebGLRenderingContext) that don't exist
 * in Node.js. If Next.js tries to SSR this component, it crashes.
 * `dynamic(..., { ssr: false })` tells Next.js to skip SSR entirely for
 * this component — it only renders in the browser.
 *
 * WHY a full-screen layout?
 * The passive tree needs maximum canvas space. We break out of the default
 * page layout (which adds pt-16 for the navbar) and give the tree everything
 * below the navbar.
 */

import type { Metadata } from "next"
import dynamic from "next/dynamic"

export const metadata: Metadata = {
  title: "The Nexus — Passive Skill Tree",
  description:
    "Explore the Path of Exile 2 passive skill tree interactively. All 4,975+ nodes visualized — zoom, pan, hover for stats, click to plan your build.",
  keywords: ["PoE2 passive tree", "Path of Exile 2 passives", "passive skill tree", "build planner"],
}

// Dynamically import the heavy Three.js client — never SSR'd
const NexusClient = dynamic(
  () => import("@/components/nexus/NexusClient").then((m) => ({ default: m.NexusClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div
            className="mb-4 text-2xl"
            style={{ fontFamily: "Cinzel, serif", color: "#e67e22" }}
          >
            The Nexus
          </div>
          <div
            className="text-sm"
            style={{ fontFamily: "Barlow, sans-serif", color: "#6b7280" }}
          >
            Initializing…
          </div>
        </div>
      </div>
    ),
  }
)

export default function NexusPage() {
  return (
    /*
     * This div fills the viewport below the fixed navbar (h-[calc(100vh-4rem)]).
     * We use a negative margin-top to cancel the pt-16 added by RootLayout,
     * then add it back as padding so navbar doesn't overlap the canvas controls.
     *
     * WHY overflow-hidden? OrbitControls can fire events outside canvas bounds
     * during fast drag — hiding overflow prevents scrollbars from appearing.
     */
    <div
      className="overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      <NexusClient />
    </div>
  )
}
