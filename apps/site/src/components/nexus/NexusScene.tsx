"use client"

/**
 * NexusScene — PoE2-style passive tree with bloom glow
 *
 * Visual architecture:
 *
 * BLOOM POST-PROCESSING:
 * Bloom works by blurring pixels that exceed a luminance threshold (>1.0 in
 * linear space) and adding them back to the scene. To make a node glow, set
 * its emissive color > 1.0. Background and edges stay < 1.0 so they don't bloom.
 * This is how PoE's own tree gets that ethereal glow look.
 *
 * NODE LAYERS (drawn back-to-front):
 * 1. Outer ring (InstancedMesh, torus/ring geometry) — gold/teal border
 * 2. Inner fill (InstancedMesh, circle) — dark fill so glow reads against it
 * 3. Glow core (InstancedMesh, small bright circle) — the actual bloom emitter
 *
 * EDGES:
 * Thin lines in a desaturated blue-purple. Allocated edges glow gold.
 *
 * BACKGROUND:
 * Deep space: radial gradient from near-black center to pure black edges,
 * rendered as a large plane behind everything.
 */

import { useRef, useMemo, useCallback, useEffect } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import { BlendFunction, KernelSize } from "postprocessing"
import * as THREE from "three"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

// ─── Visual constants ──────────────────────────────────────────────────────────

// Outer ring size (the visible node "body")
const RING_OUTER: Record<string, number> = {
  class_start:         28,
  ascendancy_start:    22,
  keystone:            18,
  ascendancy_keystone: 15,
  notable:             11,
  ascendancy_notable:  11,
  mastery:              9,
  socket:               8,
  expansion_jewel:      8,
  normal:               6,
  ascendancy_normal:    6,
}

// Inner fill size (slightly smaller than ring so ring shows as border)
const FILL_RATIO = 0.72

// Glow core size (the bright center that blooms)
const CORE_RATIO = 0.35

// Colors for glow CORES — these bloom (> 1.0 multiplied at render time)
// Using standard 0-1 range here; we multiply in shader via toneMappingExposure
const CORE_COLORS: Record<string, THREE.Color> = {
  normal:              new THREE.Color(0.4, 0.3, 0.9),    // soft violet
  notable:             new THREE.Color(1.0, 0.72, 0.1),   // warm gold — BLOOMS
  keystone:            new THREE.Color(0.1, 0.85, 1.0),   // electric cyan — BLOOMS
  class_start:         new THREE.Color(1.0, 0.42, 0.08),  // ember — BLOOMS
  ascendancy_start:    new THREE.Color(0.78, 0.18, 1.0),  // arcane — BLOOMS
  ascendancy_notable:  new THREE.Color(0.95, 0.65, 0.05), // asc gold
  ascendancy_keystone: new THREE.Color(0.15, 0.55, 1.0),  // asc blue
  ascendancy_normal:   new THREE.Color(0.35, 0.25, 0.75), // dim asc
  socket:              new THREE.Color(0.1, 0.9, 0.4),    // jewel green — BLOOMS
  mastery:             new THREE.Color(0.65, 0.3, 1.0),   // mastery violet
  expansion_jewel:     new THREE.Color(0.05, 0.75, 0.3),
}

// Ring colors (outer border of each node)
const RING_COLORS: Record<string, THREE.Color> = {
  normal:              new THREE.Color(0.25, 0.20, 0.50),
  notable:             new THREE.Color(0.60, 0.44, 0.08),
  keystone:            new THREE.Color(0.05, 0.50, 0.70),
  class_start:         new THREE.Color(0.70, 0.25, 0.04),
  ascendancy_start:    new THREE.Color(0.50, 0.08, 0.70),
  ascendancy_notable:  new THREE.Color(0.55, 0.38, 0.04),
  ascendancy_keystone: new THREE.Color(0.08, 0.32, 0.70),
  ascendancy_normal:   new THREE.Color(0.20, 0.14, 0.45),
  socket:              new THREE.Color(0.06, 0.50, 0.22),
  mastery:             new THREE.Color(0.38, 0.15, 0.60),
  expansion_jewel:     new THREE.Color(0.04, 0.40, 0.16),
}

// Fill (dark center background inside ring)
const FILL_COLOR     = new THREE.Color(0.04, 0.03, 0.09)
const FILL_COLOR_ASC = new THREE.Color(0.06, 0.02, 0.10)

// Allocated overrides
const ALLOC_CORE  = new THREE.Color(1.0, 0.55, 0.05)   // ember orange — BLOOMS
const ALLOC_RING  = new THREE.Color(0.65, 0.30, 0.02)
const ALLOC_EDGE  = new THREE.Color(1.0, 0.62, 0.04)   // gold edge — BLOOMS

// Edge color (NOT blooming — sub-1.0 so it stays dim)
const EDGE_NORMAL = new THREE.Color(0.18, 0.14, 0.38)  // subtle purple

const COORD_SCALE = 100

// ─── Types ────────────────────────────────────────────────────────────────────

interface NexusSceneProps {
  nodes:       PassiveNodeDTO[]
  allocated:   Set<string>
  onNodeHover: (node: PassiveNodeDTO | null) => void
  onNodeClick: (node: PassiveNodeDTO) => void
}

// ─── Edge geometry ─────────────────────────────────────────────────────────────

function buildEdgeGeometry(
  nodes:     PassiveNodeDTO[],
  nodeMap:   Map<string, PassiveNodeDTO>,
  allocated: Set<string>
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors:    number[] = []
  const seen = new Set<string>()

  for (const node of nodes) {
    if (!node.connections?.length) continue
    for (const connId of node.connections) {
      const key = node.nodeId < connId ? `${node.nodeId}-${connId}` : `${connId}-${node.nodeId}`
      if (seen.has(key)) continue
      seen.add(key)

      const target = nodeMap.get(connId)
      if (!target) continue

      const x1 =  node.x   / COORD_SCALE
      const y1 = -node.y   / COORD_SCALE
      const x2 =  target.x / COORD_SCALE
      const y2 = -target.y / COORD_SCALE

      positions.push(x1, y1, 0, x2, y2, 0)

      const isAlloc = allocated.has(node.nodeId) && allocated.has(connId)
      const c = isAlloc ? ALLOC_EDGE : EDGE_NORMAL
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

// ─── Single instanced layer (ring / fill / core) ───────────────────────────────

function InstanceLayer({
  nodes,
  allocated,
  layer,       // "ring" | "fill" | "core"
  meshRef,
  onHover,
  onClick,
}: {
  nodes:     PassiveNodeDTO[]
  allocated: Set<string>
  layer:     "ring" | "fill" | "core"
  meshRef:   React.RefObject<THREE.InstancedMesh | null>
  onHover?:  (node: PassiveNodeDTO | null) => void
  onClick?:  (node: PassiveNodeDTO) => void
}) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const mouse     = useMemo(() => new THREE.Vector2(), [])
  const pos       = useMemo(() => new THREE.Vector3(), [])
  const quat      = useMemo(() => new THREE.Quaternion(), [])
  const scl       = useMemo(() => new THREE.Vector3(), [])
  const mat       = useMemo(() => new THREE.Matrix4(), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    nodes.forEach((node, i) => {
      const outerR = RING_OUTER[node.type] ?? 6
      let radius: number

      if (layer === "ring")  radius = outerR
      else if (layer === "fill") radius = outerR * FILL_RATIO
      else                   radius = outerR * CORE_RATIO

      const x =  node.x / COORD_SCALE
      const y = -node.y / COORD_SCALE

      pos.set(x, y, layer === "fill" ? 0.1 : layer === "core" ? 0.2 : 0)
      quat.identity()
      scl.set(radius, radius, 1)
      mat.compose(pos, quat, scl)
      mesh.setMatrixAt(i, mat)

      // Color per layer
      let color: THREE.Color
      const isAlloc = allocated.has(node.nodeId)
      const isAsc = node.type.startsWith("ascendancy")

      const fallbackRing = new THREE.Color(0.25, 0.20, 0.50)
      const fallbackCore = new THREE.Color(0.4,  0.3,  0.9)

      if (layer === "ring") {
        color = isAlloc ? ALLOC_RING : (RING_COLORS[node.type] ?? fallbackRing)
      } else if (layer === "fill") {
        color = isAsc ? FILL_COLOR_ASC : FILL_COLOR
      } else {
        // core — bright, will bloom
        color = isAlloc ? ALLOC_CORE : (CORE_COLORS[node.type] ?? fallbackCore)
      }

      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [nodes, allocated, layer, meshRef, pos, quat, scl, mat])

  // Raycasting only on the core layer (smallest, most precise)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (layer !== "core" || !onHover) return
    const rect = gl.domElement.getBoundingClientRect()
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const mesh = meshRef.current
    if (!mesh) return
    const hit = raycaster.intersectObject(mesh)[0]
    onHover(hit?.instanceId != null ? (nodes[hit.instanceId] ?? null) : null)
  }, [layer, onHover, gl, mouse, camera, raycaster, meshRef, nodes])

  const handleClick = useCallback((e: MouseEvent) => {
    if (layer !== "core" || !onClick) return
    const rect = gl.domElement.getBoundingClientRect()
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const mesh = meshRef.current
    if (!mesh) return
    const hit = raycaster.intersectObject(mesh)[0]
    if (hit?.instanceId != null) {
      const node = nodes[hit.instanceId]
      if (node) onClick(node)
    }
  }, [layer, onClick, gl, mouse, camera, raycaster, meshRef, nodes])

  useEffect(() => {
    if (layer !== "core") return
    const c = gl.domElement
    c.addEventListener("mousemove", handleMouseMove)
    c.addEventListener("click",     handleClick)
    return () => {
      c.removeEventListener("mousemove", handleMouseMove)
      c.removeEventListener("click",     handleClick)
    }
  }, [layer, gl, handleMouseMove, handleClick])

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      frustumCulled={false}
    >
      <circleGeometry args={[1, 16]} />
      {/*
       * MeshStandardMaterial with emissive is needed for bloom —
       * meshBasicMaterial is unlit and doesn't interact with tone mapping.
       * emissiveIntensity > 1 pushes color past the bloom threshold.
       */}
      <meshStandardMaterial
        vertexColors
        emissive={layer === "core" ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0)}
        emissiveIntensity={layer === "core" ? 2.5 : 0}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

// ─── Edges ─────────────────────────────────────────────────────────────────────

function EdgeLines({
  nodes, nodeMap, allocated,
}: {
  nodes: PassiveNodeDTO[]
  nodeMap: Map<string, PassiveNodeDTO>
  allocated: Set<string>
}) {
  const geometry = useMemo(
    () => buildEdgeGeometry(nodes, nodeMap, allocated),
    [nodes, nodeMap, allocated]
  )
  return (
    <lineSegments geometry={geometry} frustumCulled={false} renderOrder={-1}>
      <lineBasicMaterial vertexColors toneMapped={false} />
    </lineSegments>
  )
}

// ─── Stars background plane ────────────────────────────────────────────────────

function StarField({ bounds }: { bounds: { cx: number; cy: number; span: number } }) {
  // Generate random star positions once
  const geometry = useMemo(() => {
    const count  = 2000
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)
    const margin = bounds.span * 0.6

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = bounds.cx + (Math.random() - 0.5) * bounds.span * 1.4
      positions[i * 3 + 1] = bounds.cy + (Math.random() - 0.5) * bounds.span * 1.4
      positions[i * 3 + 2] = -10  // behind everything

      // Vary star brightness — most dim, a few bright
      const brightness = Math.random() < 0.05 ? 0.6 + Math.random() * 0.4 : 0.1 + Math.random() * 0.2
      // Slight blue-white tint
      colors[i * 3]     = brightness * 0.85
      colors[i * 3 + 1] = brightness * 0.90
      colors[i * 3 + 2] = brightness
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3))
    return geo
  }, [bounds])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial vertexColors size={1.2} sizeAttenuation={false} toneMapped={false} />
    </points>
  )
}

// ─── Inner scene ───────────────────────────────────────────────────────────────

function Scene({ nodes, allocated, onNodeHover, onNodeClick }: NexusSceneProps) {
  const ringRef  = useRef<THREE.InstancedMesh>(null)
  const fillRef  = useRef<THREE.InstancedMesh>(null)
  const coreRef  = useRef<THREE.InstancedMesh>(null)

  const nodeMap = useMemo(() => {
    const map = new Map<string, PassiveNodeDTO>()
    for (const n of nodes) map.set(n.nodeId, n)
    return map
  }, [nodes])

  const bounds = useMemo(() => {
    if (!nodes.length) return { cx: 0, cy: 0, span: 500 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      const x =  n.x / COORD_SCALE
      const y = -n.y / COORD_SCALE
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, span: Math.max(maxX - minX, maxY - minY) }
  }, [nodes])

  return (
    <>
      {/* Starfield behind everything */}
      <StarField bounds={bounds} />

      {/* Edges — drawn before nodes */}
      <EdgeLines nodes={nodes} nodeMap={nodeMap} allocated={allocated} />

      {/* Node layers — ring → fill → core (back to front) */}
      <InstanceLayer layer="ring"  nodes={nodes} allocated={allocated} meshRef={ringRef} />
      <InstanceLayer layer="fill"  nodes={nodes} allocated={allocated} meshRef={fillRef} />
      <InstanceLayer layer="core"  nodes={nodes} allocated={allocated} meshRef={coreRef}
        onHover={onNodeHover} onClick={onNodeClick}
      />

      {/* Bloom — only pixels exceeding luminanceThreshold glow */}
      <EffectComposer>
        <Bloom
          intensity={1.4}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.6}
          kernelSize={KernelSize.LARGE}
          blendFunction={BlendFunction.ADD}
        />
      </EffectComposer>

      <OrbitControls
        enableRotate={false}
        enableDamping={false}
        zoomSpeed={2.0}
        panSpeed={1.5}
        minZoom={0.5}
        maxZoom={60}
        mouseButtons={{
          LEFT:   THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.PAN,
        }}
      />
    </>
  )
}

// ─── Public component ──────────────────────────────────────────────────────────

export function NexusScene({ nodes, allocated, onNodeHover, onNodeClick }: NexusSceneProps) {
  const bounds = useMemo(() => {
    if (!nodes.length) return { cx: 0, cy: 0, span: 500 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      const x =  n.x / COORD_SCALE
      const y = -n.y / COORD_SCALE
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, span: Math.max(maxX - minX, maxY - minY) }
  }, [nodes])

  return (
    <Canvas
      orthographic
      camera={{
        position: [bounds.cx, bounds.cy, 500],
        zoom: 1,
        near: 0.1,
        far: 5000,
      }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias:      true,
        alpha:          false,
        toneMapping:    THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      onCreated={({ camera, size }) => {
        const ortho = camera as THREE.OrthographicCamera
        // Start zoomed to a comfortable portion (not the whole tree at once)
        ortho.zoom = (Math.min(size.width, size.height) / bounds.span) * 4
        ortho.updateProjectionMatrix()
      }}
    >
      {/* Deep space background */}
      <color attach="background" args={["#02010a"]} />

      {/* Scene needs a light source for MeshStandardMaterial */}
      <ambientLight intensity={0.15} />

      <Scene
        nodes={nodes}
        allocated={allocated}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
      />
    </Canvas>
  )
}
