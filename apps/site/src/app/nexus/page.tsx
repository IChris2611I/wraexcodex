/**
 * /nexus — The Nexus: 3D Passive Skill Tree
 *
 * The canvas uses position:fixed to cover the full viewport below the navbar,
 * escaping the root layout's flex column and footer.
 *
 * WHY position:fixed instead of a route group layout?
 * Moving pages into a (main) route group requires file moves that are fragile
 * with a running dev server. position:fixed is simpler, reliable, and correct
 * for a full-screen tool page — the nexus is an app, not a document page.
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
    <>
      {/*
       * Fixed overlay that covers exactly: below navbar (top-16 = 4rem) to bottom of screen.
       * z-10 puts it above the root layout's footer but below the navbar (which is higher z).
       * This is the correct pattern for full-screen tool pages in a shared layout.
       */}
      <div
        className="fixed inset-x-0 bottom-0 z-10 overflow-hidden"
        style={{ top: "4rem" }}
      >
        <NexusLoader />
      </div>

      {/*
       * Spacer that pushes the root layout's footer off-screen.
       * Without this the footer renders below the fixed canvas — invisible
       * but still in the DOM and affecting scroll height.
       */}
      <div style={{ height: "100vh" }} aria-hidden="true" />
    </>
  )
}
