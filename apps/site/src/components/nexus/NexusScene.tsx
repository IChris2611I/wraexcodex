"use client"

/**
 * NexusScene — PoE2 passive tree renderer
 *
 * Visual design philosophy (v3 — no bloom):
 *
 * Bloom post-processing is unpredictable without a calibrated render loop.
 * Instead we get a premium look through:
 *   1. TWO instanced meshes per node type group: outer ring + inner fill
 *      The ring is the colored border. The fill is dark. Together they read
 *      as the classic PoE node aesthetic.
 *   2. SEPARATE ring meshes for notable/keystone — larger, brighter borders
 *   3. BRIGHT, saturated colors against a near-black background
 *      The contrast does the work that bloom was trying to fake.
 *   4. Edge lines with 2 brightness levels: dim for normal, bright for allocated
 *   5. Starfield points for depth — tiny, not competing with nodes
 *
 * Draw order (back → front):
 *   background plane → starfield → edges → node fills → node rings → node icons (text-like dots)
 */

import { useRef, useMemo, useCallback, useEffect } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

// ─── Design tokens ─────────────────────────────────────────────────────────────

const COORD_SCALE = 100

// Outer radius of each node type (ring outer edge)
const R: Record<string, number> = {
  class_start:         20,
  ascendancy_start:    16,
  keystone:            13,
  ascendancy_keystone: 11,
  notable:              9,
  ascendancy_notable:   9,
  mastery:              7,
  socket:               6,
  expansion_jewel:      6,
  normal:               5,
  ascendancy_normal:    4.5,
}

// Ring border thickness as fraction of radius
const RING_FRAC = 0.28

// Node fill color (dark center) — all nodes share this, the ring color differentiates them
const C_FILL        = new THREE.Color("#0a0816")
const C_FILL_ASC    = new THREE.Color("#0d0618")
const C_FILL_KS     = new THREE.Color("#030d14")

// Ring / border colors per type — these are the "identity" colors
const C_RING: Record<string, string> = {
  normal:              "#5b4fa8",   // muted violet
  notable:             "#c8940a",   // warm gold
  keystone:            "#0fc4e8",   // electric cyan
  class_start:         "#e84a0c",   // ember red-orange
  ascendancy_start:    "#b030f0",   // vivid purple
  ascendancy_notable:  "#d09010",   // asc gold
  ascendancy_keystone: "#2870e8",   // asc blue
  ascendancy_normal:   "#4838a0",   // dim asc
  socket:              "#20c060",   // jewel green
  mastery:             "#8840e0",   // mastery violet
  expansion_jewel:     "#18a040",   // expansion green
}

// Allocated ring color
const C_ALLOC_RING = "#f39c12"
const C_ALLOC_FILL = "#1a0e04"
const C_ALLOC_CORE = "#e67e22"

// Edge colors
const C_EDGE_NORMAL  = "#2e2850"   // dim purple-indigo
const C_EDGE_ALLOC   = "#d4820a"   // gold

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hex(c: string) { return new THREE.Color(c) }

// ─── Types ────────────────────────────────────────────────────────────────────

interface NexusSceneProps {
  nodes:       PassiveNodeDTO[]
  allocated:   Set<string>
  onNodeHover: (node: PassiveNodeDTO | null) => void
  onNodeClick: (node: PassiveNodeDTO) => void
}

// ─── Edge geometry ─────────────────────────────────────────────────────────────

function buildEdgeGeometry(
  nodes: PassiveNodeDTO[],
  nodeMap: Map<string, PassiveNodeDTO>,
  allocated: Set<string>
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const seen = new Set<string>()
  const cNorm  = hex(C_EDGE_NORMAL)
  const cAlloc = hex(C_EDGE_ALLOC)

  for (const node of nodes) {
    if (!node.connections?.length) continue
    for (const connId of node.connections) {
      const key = node.nodeId < connId ? `${node.nodeId}-${connId}` : `${connId}-${node.nodeId}`
      if (seen.has(key)) continue
      seen.add(key)
      const target = nodeMap.get(connId)
      if (!target) continue

      const x1 =  node.x   / COORD_SCALE, y1 = -node.y   / COORD_SCALE
      const x2 =  target.x / COORD_SCALE, y2 = -target.y / COORD_SCALE
      positions.push(x1, y1, 0, x2, y2, 0)

      const c = allocated.has(node.nodeId) && allocated.has(connId) ? cAlloc : cNorm
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

// ─── Node layers ───────────────────────────────────────────────────────────────
// We render two instanced meshes per node: FILL (dark center) and RING (colored border)
// The ring is drawn as a circle at full radius; the fill is drawn on top at (1-RING_FRAC)*radius
// This gives a clean bordered circle without needing a torus geometry.

type NodeLayer = "ring" | "fill"

function NodeLayer({
  nodes, allocated, layer, zOffset,
  meshRef, onHover, onClick,
}: {
  nodes: PassiveNodeDTO[]
  allocated: Set<string>
  layer: NodeLayer
  zOffset: number
  meshRef: React.RefObject<THREE.InstancedMesh | null>
  onHover?: (n: PassiveNodeDTO | null) => void
  onClick?: (n: PassiveNodeDTO) => void
}) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const mouse     = useMemo(() => new THREE.Vector2(), [])
  const p  = useMemo(() => new THREE.Vector3(), [])
  const q  = useMemo(() => new THREE.Quaternion(), [])
  const s  = useMemo(() => new THREE.Vector3(), [])
  const m  = useMemo(() => new THREE.Matrix4(), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    nodes.forEach((node, i) => {
      const outerR = R[node.type] ?? 5
      const radius = layer === "ring"
        ? outerR
        : outerR * (1 - RING_FRAC)

      p.set(node.x / COORD_SCALE, -node.y / COORD_SCALE, zOffset)
      q.identity()
      s.set(radius, radius, 1)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)

      let color: THREE.Color
      const isAlloc = allocated.has(node.nodeId)
      const isAsc   = node.type.startsWith("ascendancy")

      if (layer === "ring") {
        color = isAlloc ? hex(C_ALLOC_RING) : hex(C_RING[node.type] ?? C_RING.normal!)
      } else {
        // fill — dark center, slightly different per category
        if (isAlloc) color = hex(C_ALLOC_FILL)
        else if (node.type === "keystone" || node.type === "ascendancy_keystone") color = C_FILL_KS
        else if (isAsc) color = C_FILL_ASC
        else color = C_FILL
      }

      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [nodes, allocated, layer, zOffset, meshRef, p, q, s, m])

  // Hover — only on the ring layer (it's the outermost hit target)
  const handleMove = useCallback((e: MouseEvent) => {
    if (layer !== "ring" || !onHover) return
    const rect = gl.domElement.getBoundingClientRect()
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const hit = raycaster.intersectObject(meshRef.current!)[0]
    onHover(hit?.instanceId != null ? (nodes[hit.instanceId] ?? null) : null)
  }, [layer, onHover, gl, mouse, camera, raycaster, meshRef, nodes])

  const handleClick = useCallback((e: MouseEvent) => {
    if (layer !== "ring" || !onClick) return
    const rect = gl.domElement.getBoundingClientRect()
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const hit = raycaster.intersectObject(meshRef.current!)[0]
    if (hit?.instanceId != null) {
      const node = nodes[hit.instanceId]
      if (node) onClick(node)
    }
  }, [layer, onClick, gl, mouse, camera, raycaster, meshRef, nodes])

  useEffect(() => {
    if (layer !== "ring") return
    const c = gl.domElement
    c.addEventListener("mousemove", handleMove)
    c.addEventListener("click",     handleClick)
    return () => { c.removeEventListener("mousemove", handleMove); c.removeEventListener("click", handleClick) }
  }, [layer, gl, handleMove, handleClick])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]} frustumCulled={false}>
      <circleGeometry args={[1, 16]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  )
}

// ─── Notable / keystone outer glow ring (extra decorative ring) ────────────────
// Drawn as a slightly larger, dimmer ring behind the main ring for these special types

function AccentRings({ nodes, allocated }: { nodes: PassiveNodeDTO[], allocated: Set<string> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const p = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const m = useMemo(() => new THREE.Matrix4(), [])

  // Only notable, keystone, class_start, ascendancy_start get accent rings
  const accentTypes = new Set(["notable","keystone","class_start","ascendancy_start","ascendancy_notable","ascendancy_keystone"])
  const accentNodes = useMemo(() => nodes.filter(n => accentTypes.has(n.type)), [nodes])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    accentNodes.forEach((node, i) => {
      const outerR = (R[node.type] ?? 9) * 1.55  // 55% larger than main ring
      p.set(node.x / COORD_SCALE, -node.y / COORD_SCALE, -0.1)  // behind main ring
      q.identity()
      s.set(outerR, outerR, 1)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)

      const isAlloc = allocated.has(node.nodeId)
      const baseColor = isAlloc ? hex(C_ALLOC_RING) : hex(C_RING[node.type] ?? C_RING.normal!)
      // Dim it to ~25% brightness for a subtle outer halo
      mesh.setColorAt(i, baseColor.clone().multiplyScalar(0.25))
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [accentNodes, allocated, p, q, s, m])

  if (accentNodes.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, accentNodes.length]} frustumCulled={false}>
      <circleGeometry args={[1, 16]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  )
}

// ─── Edges ─────────────────────────────────────────────────────────────────────

function EdgeLines({ nodes, nodeMap, allocated }: {
  nodes: PassiveNodeDTO[], nodeMap: Map<string, PassiveNodeDTO>, allocated: Set<string>
}) {
  const geo = useMemo(() => buildEdgeGeometry(nodes, nodeMap, allocated), [nodes, nodeMap, allocated])
  return (
    <lineSegments geometry={geo} frustumCulled={false} renderOrder={-1}>
      <lineBasicMaterial vertexColors />
    </lineSegments>
  )
}

// ─── Starfield ─────────────────────────────────────────────────────────────────

function Starfield({ cx, cy, span }: { cx: number, cy: number, span: number }) {
  const geo = useMemo(() => {
    const N = 1800
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos[i*3]   = cx + (Math.random() - 0.5) * span * 1.6
      pos[i*3+1] = cy + (Math.random() - 0.5) * span * 1.6
      pos[i*3+2] = -50
      const b = Math.random() < 0.04 ? 0.55 + Math.random() * 0.3 : 0.08 + Math.random() * 0.15
      col[i*3]   = b * 0.82; col[i*3+1] = b * 0.88; col[i*3+2] = b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute("color",    new THREE.Float32BufferAttribute(col, 3))
    return g
  }, [cx, cy, span])

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial vertexColors size={1.5} sizeAttenuation={true} />
    </points>
  )
}

// ─── Scene ─────────────────────────────────────────────────────────────────────

function Scene({ nodes, allocated, onNodeHover, onNodeClick }: NexusSceneProps) {
  const ringRef = useRef<THREE.InstancedMesh>(null)
  const fillRef = useRef<THREE.InstancedMesh>(null)

  const nodeMap = useMemo(() => {
    const map = new Map<string, PassiveNodeDTO>()
    for (const n of nodes) map.set(n.nodeId, n)
    return map
  }, [nodes])

  const bounds = useMemo(() => {
    if (!nodes.length) return { cx: 0, cy: 0, span: 500 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      const x = n.x / COORD_SCALE, y = -n.y / COORD_SCALE
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    return { cx: (minX+maxX)/2, cy: (minY+maxY)/2, span: Math.max(maxX-minX, maxY-minY) }
  }, [nodes])

  return (
    <>
      <Starfield cx={bounds.cx} cy={bounds.cy} span={bounds.span} />
      <EdgeLines nodes={nodes} nodeMap={nodeMap} allocated={allocated} />
      {/* Accent halos behind rings */}
      <AccentRings nodes={nodes} allocated={allocated} />
      {/* Fill first (drawn on top of edges, under ring) */}
      <NodeLayer layer="fill" nodes={nodes} allocated={allocated}
        zOffset={0.1} meshRef={fillRef} />
      {/* Ring on top — also handles raycasting */}
      <NodeLayer layer="ring" nodes={nodes} allocated={allocated}
        zOffset={0.2} meshRef={ringRef}
        onHover={onNodeHover} onClick={onNodeClick} />

      <OrbitControls
        enableRotate={false}
        enableDamping={false}
        zoomSpeed={2.0}
        panSpeed={1.5}
        minZoom={0.5}
        maxZoom={60}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      />
    </>
  )
}

// ─── Canvas wrapper ─────────────────────────────────────────────────────────────

export function NexusScene({ nodes, allocated, onNodeHover, onNodeClick }: NexusSceneProps) {
  const bounds = useMemo(() => {
    if (!nodes.length) return { cx: 0, cy: 0, span: 500 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      const x = n.x / COORD_SCALE, y = -n.y / COORD_SCALE
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    return { cx: (minX+maxX)/2, cy: (minY+maxY)/2, span: Math.max(maxX-minX, maxY-minY) }
  }, [nodes])

  return (
    <Canvas
      orthographic
      camera={{ position: [bounds.cx, bounds.cy, 500], zoom: 1, near: 0.1, far: 5000 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera, size }) => {
        const o = camera as THREE.OrthographicCamera
        o.zoom = (Math.min(size.width, size.height) / bounds.span) * 4
        o.updateProjectionMatrix()
      }}
    >
      <color attach="background" args={["#03020d"]} />
      <Scene nodes={nodes} allocated={allocated} onNodeHover={onNodeHover} onNodeClick={onNodeClick} />
    </Canvas>
  )
}
