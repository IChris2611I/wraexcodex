"use client"

/**
 * NexusClient — top-level client component for the /nexus page
 *
 * Responsibilities:
 * - Fetch passive node data from /api/passives on mount
 * - Manage hover state (tooltip) and selected/allocated state
 * - Sync allocated nodes to URL hash for shareability
 * - Render NexusScene (Three.js canvas) + overlays (tooltip, panel)
 *
 * WHY fetch on client instead of server props?
 * The canvas requires "use client". We could pass nodes as server-fetched
 * props, but the 4975-node JSON (~800KB) would be embedded in the HTML
 * payload (doubling page size). Fetching it client-side lets us:
 *   1. Stream the page HTML instantly (empty shell)
 *   2. Load the tree JSON in parallel with JS bundle
 *   3. Show a nice loading state
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { NexusScene } from "./NexusScene"
import { NexusTooltip } from "./NexusTooltip"
import { NexusPanel } from "./NexusPanel"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

// Parse allocated nodes from URL hash: #alloc=nodeId1,nodeId2,...
function parseHashAllocated(): Set<string> {
  if (typeof window === "undefined") return new Set()
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  const raw = params.get("alloc")
  if (!raw) return new Set()
  return new Set(raw.split(",").filter(Boolean))
}

function writeHashAllocated(allocated: Set<string>) {
  if (typeof window === "undefined") return
  const params = new URLSearchParams()
  if (allocated.size > 0) {
    params.set("alloc", [...allocated].join(","))
    window.location.hash = params.toString()
  } else {
    history.replaceState(null, "", window.location.pathname + window.location.search)
  }
}

export function NexusClient() {
  const [nodes, setNodes] = useState<PassiveNodeDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hoveredNode, setHoveredNode] = useState<PassiveNodeDTO | null>(null)
  const [selectedNode, setSelectedNode] = useState<PassiveNodeDTO | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [allocated, setAllocated] = useState<Set<string>>(new Set())

  // Track mouse position for tooltip placement
  useEffect(() => {
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener("mousemove", handler, { passive: true })
    return () => window.removeEventListener("mousemove", handler)
  }, [])

  // Load passive data
  useEffect(() => {
    setLoading(true)
    fetch("/api/passives")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ nodes: PassiveNodeDTO[]; count: number }>
      })
      .then(({ nodes }) => {
        setNodes(nodes)
        // Restore allocated from URL hash after data loads
        setAllocated(parseHashAllocated())
        setLoading(false)
      })
      .catch((err) => {
        console.error("[NexusClient] Failed to load nodes:", err)
        setError("Failed to load passive tree data.")
        setLoading(false)
      })
  }, [])

  // Sync allocated to URL whenever it changes
  useEffect(() => {
    if (!loading) writeHashAllocated(allocated)
  }, [allocated, loading])

  const handleNodeHover = useCallback((node: PassiveNodeDTO | null) => {
    setHoveredNode(node)
  }, [])

  const handleNodeClick = useCallback((node: PassiveNodeDTO) => {
    // First click → select. Second click on same node → toggle allocation.
    setSelectedNode((prev) => {
      if (prev?.nodeId === node.nodeId) {
        // Toggle allocation
        setAllocated((alloc) => {
          const next = new Set(alloc)
          if (next.has(node.nodeId)) next.delete(node.nodeId)
          else next.add(node.nodeId)
          return next
        })
        return prev // keep selected
      }
      return node
    })
  }, [])

  const handleDeselect = useCallback(() => setSelectedNode(null), [])

  const handleClearAllocated = useCallback(() => {
    setAllocated(new Set())
    setSelectedNode(null)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div
            className="mb-4 text-2xl"
            style={{ fontFamily: "Cinzel, serif", color: "#e67e22" }}
          >
            The Nexus
          </div>
          <div
            className="text-sm animate-pulse"
            style={{ fontFamily: "Barlow, sans-serif", color: "#6b7280" }}
          >
            Loading passive tree ({">"}4,900 nodes)…
          </div>
          {/* Ember loading bar */}
          <div className="mt-4 mx-auto w-48 h-0.5 rounded-full overflow-hidden" style={{ background: "#1a1a2e" }}>
            <div
              className="h-full rounded-full animate-[nexus-load_2s_ease-in-out_infinite]"
              style={{ background: "linear-gradient(90deg, #e67e22, #f39c12)" }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div
            className="mb-2 text-lg"
            style={{ fontFamily: "Cinzel, serif", color: "#e67e22" }}
          >
            The Nexus is Unreachable
          </div>
          <p style={{ fontFamily: "Barlow, sans-serif", color: "#6b7280", fontSize: 14 }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded text-sm"
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              background: "rgba(230, 126, 34, 0.15)",
              border: "1px solid rgba(230, 126, 34, 0.4)",
              color: "#e67e22",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full" style={{ cursor: hoveredNode ? "pointer" : "grab" }}>
      {/* Three.js canvas — fills the container */}
      <NexusScene
        nodes={nodes}
        allocated={allocated}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />

      {/* Left panel: stats + selected node detail */}
      <NexusPanel
        selected={selectedNode}
        allocated={allocated}
        onDeselect={handleDeselect}
        onClearAllocated={handleClearAllocated}
      />

      {/* Floating tooltip near cursor */}
      <NexusTooltip node={hoveredNode} mouseX={mousePos.x} mouseY={mousePos.y} />

      {/* Node count badge (bottom right) */}
      <div
        className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-xs"
        style={{
          fontFamily: "Barlow Condensed, sans-serif",
          background: "rgba(5, 5, 8, 0.8)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "#4b5563",
          pointerEvents: "none",
        }}
      >
        {nodes.length.toLocaleString()} nodes
      </div>
    </div>
  )
}
