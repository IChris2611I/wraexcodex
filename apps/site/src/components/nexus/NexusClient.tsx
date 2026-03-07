"use client"

import { useState, useEffect, useCallback } from "react"
import { NexusCanvas } from "./NexusCanvas"
import { NexusTooltip } from "./NexusTooltip"
import { NexusPanel } from "./NexusPanel"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

function parseHashAllocated(): Set<string> {
  if (typeof window === "undefined") return new Set()
  const params = new URLSearchParams(window.location.hash.slice(1))
  const raw = params.get("alloc")
  return raw ? new Set(raw.split(",").filter(Boolean)) : new Set()
}

function writeHashAllocated(allocated: Set<string>) {
  if (typeof window === "undefined") return
  if (allocated.size > 0) {
    const p = new URLSearchParams()
    p.set("alloc", [...allocated].join(","))
    window.location.hash = p.toString()
  } else {
    history.replaceState(null, "", window.location.pathname + window.location.search)
  }
}

export function NexusClient() {
  const [nodes,    setNodes]    = useState<PassiveNodeDTO[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [hoveredNode,  setHoveredNode]  = useState<PassiveNodeDTO | null>(null)
  const [selectedNode, setSelectedNode] = useState<PassiveNodeDTO | null>(null)
  const [mousePos,     setMousePos]     = useState({ x: 0, y: 0 })
  const [allocated,    setAllocated]    = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/passives")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(({ nodes }: { nodes: PassiveNodeDTO[] }) => {
        setNodes(nodes)
        setAllocated(parseHashAllocated())
        setLoading(false)
      })
      .catch(() => { setError("Failed to load passive tree."); setLoading(false) })
  }, [])

  useEffect(() => { if (!loading) writeHashAllocated(allocated) }, [allocated, loading])

  const handleNodeHover = useCallback((node: PassiveNodeDTO | null, x: number, y: number) => {
    setHoveredNode(node)
    if (node) setMousePos({ x, y })
  }, [])

  const handleNodeClick = useCallback((node: PassiveNodeDTO) => {
    setSelectedNode(node)
    setAllocated(prev => {
      const next = new Set(prev)
      if (next.has(node.nodeId)) next.delete(node.nodeId)
      else next.add(node.nodeId)
      return next
    })
  }, [])

  if (loading) return (
    <div style={{ display:"flex", height:"100%", alignItems:"center", justifyContent:"center", background:"#000" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"Cinzel,serif", fontSize:22, color:"#e67e22", marginBottom:10 }}>The Nexus</div>
        <div style={{ fontFamily:"Barlow,sans-serif", fontSize:13, color:"#4b5563" }}>Loading passive tree…</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ display:"flex", height:"100%", alignItems:"center", justifyContent:"center", background:"#000" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"Cinzel,serif", color:"#e67e22", marginBottom:8 }}>Failed to load</div>
        <p style={{ color:"#6b7280", fontSize:13 }}>{error}</p>
        <button onClick={() => window.location.reload()}
          style={{ marginTop:16, padding:"6px 16px", border:"1px solid #e67e22", color:"#e67e22",
                   background:"transparent", cursor:"pointer", borderRadius:4 }}>
          Retry
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", background:"#000" }}>
      <NexusCanvas
        nodes={nodes}
        allocated={allocated}
        selected={selectedNode}
        onHover={handleNodeHover}
        onClick={handleNodeClick}
      />
      <NexusPanel
        selected={selectedNode}
        allocated={allocated}
        onDeselect={() => setSelectedNode(null)}
        onClearAllocated={() => { setAllocated(new Set()); setSelectedNode(null) }}
      />
      <NexusTooltip node={hoveredNode} mouseX={mousePos.x} mouseY={mousePos.y} />
      <div style={{ position:"absolute", bottom:10, right:12, pointerEvents:"none",
                    fontFamily:"Barlow Condensed,sans-serif", fontSize:11, color:"#2e2850" }}>
        {nodes.length.toLocaleString()} nodes · scroll to zoom · drag to pan
      </div>
    </div>
  )
}
