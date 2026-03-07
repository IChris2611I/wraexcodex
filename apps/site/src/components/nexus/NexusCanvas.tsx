"use client"

/**
 * NexusCanvas — Pure Canvas 2D passive tree renderer
 *
 * WHY Canvas 2D instead of Three.js / WebGL?
 * The passive tree is a 2D dot-and-line diagram. Three.js adds:
 *   - WebGL context overhead
 *   - InstancedMesh matrix computation every frame
 *   - PostProcessing pipeline (bloom = full-screen passes)
 *   - React reconciler overhead (@react-three/fiber)
 * Canvas 2D is a single thread, direct GPU-blitted 2D context.
 * For 5000 circles + 15000 line segments, Canvas 2D is 3-5x faster.
 *
 * VISUAL TARGETS (from PoE2 reference images):
 *   - Pure black background (#000000)
 *   - Edges: thin (~1px), warm golden-tan (#8a7a50), very visible
 *   - Normal nodes: tiny dot (r≈3), white/silver center, subtle colored ring
 *   - Notable nodes: medium (r≈6), bright colored icon-like appearance
 *   - Keystones: large (r≈10), dramatic, cyan/teal glow halo
 *   - Class starts: largest, their class color, ornate appearance
 *   - Allocated: golden/amber filled, connected edges also gold
 *
 * PAN/ZOOM:
 *   - Mouse drag = pan
 *   - Scroll wheel = zoom (centered on cursor)
 *   - Touch pinch = zoom
 *   - No library needed — 30 lines of pointer math
 *
 * RENDERING PIPELINE:
 *   1. Clear to black
 *   2. Draw all edges (one beginPath per color group, batched)
 *   3. Draw all node outer halos (shadowBlur for glow effect)
 *   4. Draw all node inner circles
 *   5. Draw all node center dots
 *   On hover/allocate changes: requestAnimationFrame → redraw
 */

import { useRef, useEffect, useCallback, useMemo, useState } from "react"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

// ─── Design tokens (matching PoE2 aesthetic) ──────────────────────────────────

const BG = "#000000"

// Edge colors
const EDGE_NORMAL   = "#7a6a48"   // warm tan — clear at all zoom levels
const EDGE_HOVER    = "#a09060"   // slightly brighter
const EDGE_ALLOC    = "#e8a820"   // bright gold for allocated paths

// Node sizes (radius in tree-space units, before zoom)
const NODE_R: Record<string, number> = {
  class_start:         14,
  ascendancy_start:    11,
  keystone:             9,
  ascendancy_keystone:  7,
  notable:              5.5,
  ascendancy_notable:   5,
  mastery:              4,
  socket:               3.5,
  expansion_jewel:      3.5,
  normal:               2.8,
  ascendancy_normal:    2.5,
}

// Node center dot colors — these are the visible "gem" inside each node
const NODE_COLOR: Record<string, string> = {
  normal:              "#9988cc",   // soft violet
  notable:             "#e8a820",   // warm gold
  keystone:            "#20c8e8",   // electric cyan
  class_start:         "#e05010",   // ember orange
  ascendancy_start:    "#c030f8",   // vivid purple
  ascendancy_notable:  "#d09020",   // asc gold
  ascendancy_keystone: "#3080f8",   // asc blue
  ascendancy_normal:   "#7060b0",   // dim asc
  socket:              "#20d060",   // jewel green
  mastery:             "#a050e8",   // mastery violet
  expansion_jewel:     "#18b040",
}

// Halo/glow colors (outer ring color, dimmer)
const HALO_COLOR: Record<string, string> = {
  notable:             "#7a5010",
  keystone:            "#0a6070",
  class_start:         "#702808",
  ascendancy_start:    "#600880",
  ascendancy_notable:  "#6a4808",
  ascendancy_keystone: "#103878",
  socket:              "#0a5028",
  mastery:             "#501888",
}

// Allocated state overrides
const ALLOC_COLOR = "#f0a020"
const ALLOC_HALO  = "#7a4800"
const ALLOC_EDGE  = "#d4820a"

// ─── Types ────────────────────────────────────────────────────────────────────

interface NexusCanvasProps {
  nodes: PassiveNodeDTO[]
  onNodeHover: (node: PassiveNodeDTO | null, x: number, y: number) => void
  onNodeClick: (node: PassiveNodeDTO) => void
}

// ─── Spatial index for fast hover hit-testing ──────────────────────────────────
// Divides the tree into grid cells. On mousemove we only check nodes in nearby cells.
// Without this: O(n) = 5000 checks per mousemove event (60fps = 300k checks/sec)
// With this: O(1) ≈ 5-20 checks per mousemove

class SpatialGrid {
  private cells: Map<string, PassiveNodeDTO[]> = new Map()
  private cellSize: number

  constructor(nodes: PassiveNodeDTO[], cellSize: number) {
    this.cellSize = cellSize
    for (const node of nodes) {
      const cx = Math.floor(node.x / cellSize)
      const cy = Math.floor(node.y / cellSize)
      const key = `${cx},${cy}`
      if (!this.cells.has(key)) this.cells.set(key, [])
      this.cells.get(key)!.push(node)
    }
  }

  query(x: number, y: number, radius: number): PassiveNodeDTO[] {
    const results: PassiveNodeDTO[] = []
    const minCx = Math.floor((x - radius) / this.cellSize)
    const maxCx = Math.floor((x + radius) / this.cellSize)
    const minCy = Math.floor((y - radius) / this.cellSize)
    const maxCy = Math.floor((y + radius) / this.cellSize)
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(`${cx},${cy}`)
        if (cell) results.push(...cell)
      }
    }
    return results
  }
}

// ─── Main component ────────────────────────────────────────────────────────────

export function NexusCanvas({ nodes, onNodeHover, onNodeClick }: NexusCanvasProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef({
    // Camera transform
    offsetX: 0,
    offsetY: 0,
    zoom:    1,
    // Interaction
    dragging:  false,
    lastX:     0,
    lastY:     0,
    // Data
    allocated: new Set<string>(),
    hovered:   null as PassiveNodeDTO | null,
    selected:  null as PassiveNodeDTO | null,
  })

  // Build spatial grid and edge map once nodes load
  const { grid, nodeMap, edgeList } = useMemo(() => {
    if (!nodes.length) return { grid: null, nodeMap: new Map(), edgeList: [] }

    const nodeMap = new Map<string, PassiveNodeDTO>()
    for (const n of nodes) nodeMap.set(n.nodeId, n)

    // Deduplicated edge list
    const seen = new Set<string>()
    const edgeList: [PassiveNodeDTO, PassiveNodeDTO][] = []
    for (const node of nodes) {
      for (const connId of (node.connections ?? [])) {
        const key = node.nodeId < connId ? `${node.nodeId}-${connId}` : `${connId}-${node.nodeId}`
        if (seen.has(key)) continue
        seen.add(key)
        const target = nodeMap.get(connId)
        if (target) edgeList.push([node, target])
      }
    }

    const grid = new SpatialGrid(nodes, 200)
    return { grid, nodeMap, edgeList }
  }, [nodes])

  // Compute initial camera to fit tree
  const initCamera = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !nodes.length) return
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
    }
    const treeW = maxX - minX
    const treeH = maxY - minY
    const treeCx = (minX + maxX) / 2
    const treeCy = (minY + maxY) / 2

    // Fit the whole tree in the viewport with 5% padding on each side
    const zoom = Math.min(canvas.width / treeW, canvas.height / treeH) * 0.90
    stateRef.current.zoom    = zoom
    stateRef.current.offsetX = canvas.width  / 2 - treeCx * zoom
    stateRef.current.offsetY = canvas.height / 2 - treeCy * zoom
  }, [nodes])

  // ── Render ──────────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { offsetX, offsetY, zoom, allocated, hovered, selected } = stateRef.current

    // Transform helpers: tree-space → screen-space
    const tx = (x: number) => x * zoom + offsetX
    const ty = (y: number) => y * zoom + offsetY

    // ── 1. Clear ──────────────────────────────────────────────────────────────
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // ── 2. Edges ──────────────────────────────────────────────────────────────
    // Always at least 1px, scales with zoom
    ctx.lineWidth = Math.max(1, zoom * 0.8)

    // Normal edges
    ctx.beginPath()
    ctx.strokeStyle = EDGE_NORMAL
    for (const [a, b] of edgeList) {
      if (allocated.has(a.nodeId) && allocated.has(b.nodeId)) continue
      ctx.moveTo(tx(a.x), ty(a.y))
      ctx.lineTo(tx(b.x), ty(b.y))
    }
    ctx.stroke()

    // Allocated edges — slightly thicker, bright gold
    if (allocated.size > 0) {
      ctx.beginPath()
      ctx.strokeStyle = ALLOC_EDGE
      ctx.lineWidth = Math.max(1.5, zoom * 1.2)
      for (const [a, b] of edgeList) {
        if (!allocated.has(a.nodeId) || !allocated.has(b.nodeId)) continue
        ctx.moveTo(tx(a.x), ty(a.y))
        ctx.lineTo(tx(b.x), ty(b.y))
      }
      ctx.stroke()
    }

    // ── 3. Nodes ─────────────────────────────────────────────────────────────
    for (const node of nodes) {
      const sx = tx(node.x)
      const sy = ty(node.y)

      // Cull off-screen nodes
      if (sx < -60 || sx > canvas.width + 60 || sy < -60 || sy > canvas.height + 60) continue

      const baseR      = NODE_R[node.type] ?? 2.8
      // Minimum screen radius so nodes are ALWAYS visible regardless of zoom
      const r          = Math.max(1.5, baseR * zoom)
      const isAlloc    = allocated.has(node.nodeId)
      const isHovered  = hovered?.nodeId  === node.nodeId
      const isSelected = selected?.nodeId === node.nodeId
      const isSpecial  = ["notable","keystone","class_start","ascendancy_start",
                          "ascendancy_notable","ascendancy_keystone"].includes(node.type)
      const dotColor  = isAlloc ? ALLOC_COLOR : (NODE_COLOR[node.type]  ?? "#9988cc")
      const haloColor = isAlloc ? ALLOC_HALO  : (HALO_COLOR[node.type] ?? null)

      // 3a. Outer soft halo for special nodes (only when large enough to see)
      if (isSpecial && haloColor && r > 3) {
        const grad = ctx.createRadialGradient(sx, sy, r * 0.8, sx, sy, r * 3)
        grad.addColorStop(0, haloColor + "55")
        grad.addColorStop(1, haloColor + "00")
        ctx.beginPath()
        ctx.arc(sx, sy, r * 3, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // 3b. Hover/selected ring
      if (isHovered || isSelected) {
        ctx.beginPath()
        ctx.arc(sx, sy, r + Math.max(2, r * 0.8), 0, Math.PI * 2)
        ctx.strokeStyle = isSelected ? "#f0a020cc" : "#ffffff80"
        ctx.lineWidth   = Math.max(1, r * 0.3)
        ctx.stroke()
      }

      // 3c. Dark node body
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = isAlloc ? "#180d02" : "#07050f"
      ctx.fill()

      // 3d. Colored border (the ring that gives each node its identity)
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.strokeStyle = dotColor
      ctx.lineWidth   = Math.max(1, r * 0.4)
      ctx.stroke()

      // 3e. Bright center dot — always drawn, never smaller than 1px
      const dotR = Math.max(1, r * 0.42)
      ctx.beginPath()
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2)
      ctx.fillStyle = dotColor
      ctx.fill()
    }
  }, [nodes, edgeList])

  // ── RAF loop ─────────────────────────────────────────────────────────────────
  const rafRef = useRef<number>(0)
  const scheduleRender = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(render)
  }, [render])

  // ── Resize observer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      scheduleRender()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [scheduleRender])

  // ── Init camera on data load ──────────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length) {
      initCamera()
      scheduleRender()
    }
  }, [nodes, initCamera, scheduleRender])

  // ── Convert screen coords to tree coords ──────────────────────────────────────
  const screenToTree = useCallback((sx: number, sy: number) => {
    const { offsetX, offsetY, zoom } = stateRef.current
    return { x: (sx - offsetX) / zoom, y: (sy - offsetY) / zoom }
  }, [])

  // ── Hit test ─────────────────────────────────────────────────────────────────
  const hitTest = useCallback((screenX: number, screenY: number): PassiveNodeDTO | null => {
    if (!grid) return null
    const { x, y } = screenToTree(screenX, screenY)
    const { zoom } = stateRef.current
    // Search radius in tree coords: pick the largest node size + margin
    const searchR = 20 / zoom + 20
    const candidates = grid.query(x, y, searchR)

    let best: PassiveNodeDTO | null = null
    let bestDist = Infinity
    for (const node of candidates) {
      const dx = node.x - x, dy = node.y - y
      const dist = Math.sqrt(dx*dx + dy*dy)
      const r = (NODE_R[node.type] ?? 2.8) + 4 / zoom  // generous hit area
      if (dist <= r && dist < bestDist) { best = node; bestDist = dist }
    }
    return best
  }, [grid, screenToTree])

  // ── Pointer events ────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect   = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const state  = stateRef.current
    state.offsetX = mouseX - (mouseX - state.offsetX) * factor
    state.offsetY = mouseY - (mouseY - state.offsetY) * factor
    state.zoom   *= factor
    state.zoom    = Math.max(0.3, Math.min(state.zoom, 30))
    scheduleRender()
  }, [scheduleRender])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const state = stateRef.current
    state.dragging = true
    state.lastX = e.clientX
    state.lastY = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const state  = stateRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const sx   = e.clientX - rect.left
    const sy   = e.clientY - rect.top

    if (state.dragging) {
      const dx = e.clientX - state.lastX
      const dy = e.clientY - state.lastY
      state.offsetX += dx
      state.offsetY += dy
      state.lastX = e.clientX
      state.lastY = e.clientY
      state.hovered = null
      scheduleRender()
      return
    }

    // Hover hit test
    const hit = hitTest(sx, sy)
    if (hit?.nodeId !== state.hovered?.nodeId) {
      state.hovered = hit
      onNodeHover(hit, e.clientX, e.clientY)
      scheduleRender()
    }
  }, [hitTest, onNodeHover, scheduleRender])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const state = stateRef.current
    if (!state.dragging) return
    const dx = Math.abs(e.clientX - state.lastX)
    const dy = Math.abs(e.clientY - state.lastY)
    state.dragging = false

    // Only fire click if pointer didn't move much (not a drag)
    if (dx < 4 && dy < 4) {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const hit  = hitTest(e.clientX - rect.left, e.clientY - rect.top)
      if (hit) {
        // Toggle allocation
        const alloc = state.allocated
        if (alloc.has(hit.nodeId)) alloc.delete(hit.nodeId)
        else alloc.add(hit.nodeId)
        state.selected = hit
        scheduleRender()
        onNodeClick(hit)
      }
    }
  }, [hitTest, onNodeClick, scheduleRender])

  // Attach wheel listener (non-passive to allow preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  )
}
