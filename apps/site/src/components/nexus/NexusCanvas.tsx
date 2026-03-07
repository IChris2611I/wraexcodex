"use client"

/**
 * NexusCanvas — Canvas 2D passive tree renderer (v4, clean rewrite)
 *
 * Root causes fixed vs previous versions:
 *
 * 1. CAMERA BUG: canvas.width/height are 0 until the browser lays out the element.
 *    Using canvas.getBoundingClientRect() gives the REAL pixel dimensions immediately,
 *    unlike canvas.width/height which start at 300x150 default.
 *    Previous: `zoom = Math.min(canvas.width / treeW, ...)` → wrong zoom
 *    This:     `zoom = Math.min(rect.width / treeW, ...)`   → correct
 *
 * 2. ZOOM BUG: minZoom computed dynamically = half the fit-zoom.
 *    This guarantees you can always zoom out to see the full tree.
 *
 * 3. GLOW BUG: shadowBlur must be set + ctx.save/restore per-node.
 *    Previous code either had no glow or leaked shadow state.
 *
 * 4. STATE BUG: canvas no longer manages its own allocated ref.
 *    allocated + selected come in as props → Clear button works instantly.
 */

import { useRef, useEffect, useCallback, useMemo } from "react"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

// ─── Design tokens ─────────────────────────────────────────────────────────────

const BG           = "#000000"
const EDGE_COLOR   = "rgba(120, 100, 58, 0.7)"
const EDGE_ALLOC   = "#d4920a"

const BASE_R: Record<string, number> = {
  class_start:         11,
  ascendancy_start:     8,
  keystone:             6.5,
  ascendancy_keystone:  5.5,
  notable:              4.2,
  ascendancy_notable:   4.0,
  mastery:              3.2,
  socket:               2.8,
  expansion_jewel:      2.8,
  normal:               2.2,
  ascendancy_normal:    2.0,
}

const NODE_COLOR: Record<string, string> = {
  normal:              "#8878c8",
  notable:             "#e8b830",
  keystone:            "#22c8e8",
  class_start:         "#e84010",
  ascendancy_start:    "#c038f8",
  ascendancy_notable:  "#d09820",
  ascendancy_keystone: "#3878f8",
  ascendancy_normal:   "#6858b8",
  socket:              "#28d068",
  mastery:             "#a850e8",
  expansion_jewel:     "#18b848",
}

const ALLOC_COLOR = "#f0a020"
const ALLOC_FILL  = "#1e1002"
const BASE_FILL   = "#080610"
const MAX_ZOOM    = 20

const GLOW_TYPES = new Set([
  "notable", "keystone", "class_start",
  "ascendancy_start", "ascendancy_notable", "ascendancy_keystone",
])

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NexusCanvasProps {
  nodes:     PassiveNodeDTO[]
  allocated: Set<string>
  selected:  PassiveNodeDTO | null
  onHover:   (node: PassiveNodeDTO | null, screenX: number, screenY: number) => void
  onClick:   (node: PassiveNodeDTO) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NexusCanvas({ nodes, allocated, selected, onHover, onClick }: NexusCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cam       = useRef({ ox: 0, oy: 0, zoom: 1, minZoom: 0.05, ready: false })
  const drag      = useRef({ active: false, moved: false, startX: 0, startY: 0, startOx: 0, startOy: 0 })
  const hovRef    = useRef<PassiveNodeDTO | null>(null)
  const dirty     = useRef(true)
  const rafId     = useRef(0)

  // ── Precompute edges + bounds ─────────────────────────────────────────────

  const computed = useMemo(() => {
    if (!nodes.length) return null

    const nodeMap = new Map<string, PassiveNodeDTO>()
    for (const n of nodes) nodeMap.set(n.nodeId, n)

    const seen  = new Set<string>()
    const edges: [PassiveNodeDTO, PassiveNodeDTO][] = []
    for (const n of nodes) {
      for (const cid of (n.connections ?? [])) {
        const key = n.nodeId < cid ? `${n.nodeId}-${cid}` : `${cid}-${n.nodeId}`
        if (seen.has(key)) continue
        seen.add(key)
        const t = nodeMap.get(cid)
        if (t) edges.push([n, t])
      }
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
    }

    return {
      edges,
      nodeMap,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w:  maxX - minX,
      h:  maxY - minY,
    }
  }, [nodes])

  // ── Spatial grid ─────────────────────────────────────────────────────────────

  const hitGrid = useMemo(() => {
    if (!nodes.length) return null
    const CELL = 400
    const cells = new Map<string, PassiveNodeDTO[]>()
    for (const n of nodes) {
      const key = `${Math.floor(n.x / CELL)},${Math.floor(n.y / CELL)}`
      if (!cells.has(key)) cells.set(key, [])
      cells.get(key)!.push(n)
    }
    return (wx: number, wy: number, wr: number): PassiveNodeDTO[] => {
      const out: PassiveNodeDTO[] = []
      for (let cx = Math.floor((wx - wr) / CELL); cx <= Math.ceil((wx + wr) / CELL); cx++)
        for (let cy = Math.floor((wy - wr) / CELL); cy <= Math.ceil((wy + wr) / CELL); cy++) {
          const cell = cells.get(`${cx},${cy}`)
          if (cell) out.push(...cell)
        }
      return out
    }
  }, [nodes])

  // ── Camera init — KEY FIX: use getBoundingClientRect() ──────────────────────

  const initCamera = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !computed) return

    // getBoundingClientRect() returns real CSS pixel size immediately — never 0
    const rect = canvas.getBoundingClientRect()
    const cw   = rect.width
    const ch   = rect.height
    if (!cw || !ch) return

    // Sync canvas pixel buffer to display size × DPR
    const dpr       = window.devicePixelRatio || 1
    canvas.width    = Math.round(cw * dpr)
    canvas.height   = Math.round(ch * dpr)

    const { cx, cy, w, h } = computed
    const fitZoom   = Math.min(cw / w, ch / h) * 0.88

    cam.current = {
      ox:      cw / 2 - cx * fitZoom,
      oy:      ch / 2 - cy * fitZoom,
      zoom:    fitZoom,
      minZoom: fitZoom * 0.45,   // can zoom out to ~half the fit size
      ready:   true,
    }
    dirty.current = true
  }, [computed])

  // ── Draw ─────────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !computed || !cam.current.ready) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { ox, oy, zoom } = cam.current
    const dpr = window.devicePixelRatio || 1
    const cw  = canvas.width  / dpr
    const ch  = canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Clear
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, cw, ch)

    const sx  = (x: number) => x * zoom + ox
    const sy  = (y: number) => y * zoom + oy
    const edW = Math.max(0.5, zoom * 0.3)

    // ── Normal edges (batch) ──────────────────────────────────────────────
    ctx.beginPath()
    ctx.lineWidth   = edW
    ctx.strokeStyle = EDGE_COLOR
    for (const [a, b] of computed.edges) {
      if (allocated.has(a.nodeId) && allocated.has(b.nodeId)) continue
      const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y)
      if (ax < -20 && bx < -20) continue
      if (ax > cw + 20 && bx > cw + 20) continue
      if (ay < -20 && by < -20) continue
      if (ay > ch + 20 && by > ch + 20) continue
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.stroke()

    // ── Allocated edges ───────────────────────────────────────────────────
    if (allocated.size > 0) {
      ctx.beginPath()
      ctx.lineWidth   = Math.max(0.8, zoom * 0.45)
      ctx.strokeStyle = EDGE_ALLOC
      for (const [a, b] of computed.edges) {
        if (!allocated.has(a.nodeId) || !allocated.has(b.nodeId)) continue
        ctx.moveTo(sx(a.x), sy(a.y))
        ctx.lineTo(sx(b.x), sy(b.y))
      }
      ctx.stroke()
    }

    // ── Nodes ─────────────────────────────────────────────────────────────
    const hov = hovRef.current

    for (const node of nodes) {
      const px = sx(node.x)
      const py = sy(node.y)

      // Node radius in screen px — 1.5px minimum so always a visible dot
      const nr = Math.max(1.5, (BASE_R[node.type] ?? 2.2) * zoom)

      // Off-screen cull
      if (px < -(nr + 10) || px > cw + nr + 10) continue
      if (py < -(nr + 10) || py > ch + nr + 10) continue

      const isAlloc = allocated.has(node.nodeId)
      const isHov   = hov?.nodeId     === node.nodeId
      const isSel   = selected?.nodeId === node.nodeId
      const color   = isAlloc ? ALLOC_COLOR : (NODE_COLOR[node.type] ?? "#8878c8")
      const fill    = isAlloc ? ALLOC_FILL  : BASE_FILL

      // Glow — only for special nodes, only when big enough to see
      if (GLOW_TYPES.has(node.type) && nr > 2.5) {
        ctx.save()
        ctx.shadowColor  = color
        ctx.shadowBlur   = nr * 2.8
        ctx.globalAlpha  = 0.4
        ctx.beginPath()
        ctx.arc(px, py, nr * 0.85, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.restore()
      }

      // Hover / selected ring
      if (isHov || isSel) {
        ctx.beginPath()
        ctx.arc(px, py, nr + Math.max(2, nr * 0.55), 0, Math.PI * 2)
        ctx.strokeStyle = isSel ? "#f0a020bb" : "#ffffff55"
        ctx.lineWidth   = Math.max(1, nr * 0.25)
        ctx.stroke()
      }

      // Dark fill
      ctx.beginPath()
      ctx.arc(px, py, nr, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()

      // Colored ring border
      ctx.beginPath()
      ctx.arc(px, py, nr, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth   = Math.max(0.8, nr * 0.42)
      ctx.stroke()

      // Center dot — always visible
      ctx.beginPath()
      ctx.arc(px, py, Math.max(0.8, nr * 0.38), 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }

    dirty.current = false
  }, [nodes, computed, allocated, selected])

  // ── RAF loop ──────────────────────────────────────────────────────────────────

  const frame = useCallback(() => {
    if (dirty.current) draw()
    rafId.current = requestAnimationFrame(frame)
  }, [draw])

  useEffect(() => {
    rafId.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId.current)
  }, [frame])

  // Mark dirty when props change
  useEffect(() => { dirty.current = true }, [allocated, selected])

  // ── Resize ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => { initCamera() })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [initCamera])

  // Init on data load
  useEffect(() => { if (computed) initCamera() }, [computed, initCamera])

  // ── Hit test ──────────────────────────────────────────────────────────────────

  const hitTest = useCallback((screenX: number, screenY: number): PassiveNodeDTO | null => {
    if (!hitGrid) return null
    const { ox, oy, zoom } = cam.current
    const wx = (screenX - ox) / zoom
    const wy = (screenY - oy) / zoom
    const wr = Math.max(15, 25 / zoom)
    const candidates = hitGrid(wx, wy, wr)

    let best: PassiveNodeDTO | null = null
    let bestDist = Infinity
    for (const n of candidates) {
      const dx   = n.x - wx, dy = n.y - wy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const hitR = (BASE_R[n.type] ?? 2.2) + 10 / zoom
      if (dist < hitR && dist < bestDist) { best = n; bestDist = dist }
    }
    return best
  }, [hitGrid])

  // ── Wheel ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect   = canvas.getBoundingClientRect()
      const mx     = e.clientX - rect.left
      const my     = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const c      = cam.current
      const newZ   = Math.max(c.minZoom, Math.min(c.zoom * factor, MAX_ZOOM))
      if (newZ === c.zoom) return   // already at limit — do nothing
      const scale  = newZ / c.zoom
      c.ox   = mx - (mx - c.ox) * scale
      c.oy   = my - (my - c.oy) * scale
      c.zoom = newZ
      dirty.current = true
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [])

  // ── Pointer ───────────────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = {
      active: true, moved: false,
      startX: e.clientX, startY: e.clientY,
      startOx: cam.current.ox, startOy: cam.current.oy,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (d.active) {
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
      cam.current.ox = d.startOx + dx
      cam.current.oy = d.startOy + dy
      hovRef.current = null
      dirty.current  = true
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const hit  = hitTest(e.clientX - rect.left, e.clientY - rect.top)
    if (hit?.nodeId !== hovRef.current?.nodeId) {
      hovRef.current = hit
      onHover(hit, e.clientX, e.clientY)
      dirty.current  = true
    }
  }, [hitTest, onHover])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    d.active = false
    if (d.moved) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const hit  = hitTest(e.clientX - rect.left, e.clientY - rect.top)
    if (hit) onClick(hit)
  }, [hitTest, onClick])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", cursor: "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
