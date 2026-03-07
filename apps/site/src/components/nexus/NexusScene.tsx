"use client"

/**
 * NexusScene — Three.js passive skill tree renderer
 *
 * Architecture decisions:
 *
 * 1. InstancedMesh for nodes (ONE draw call for all 4975 nodes):
 *    Naive approach = 4975 separate Mesh objects = 4975 draw calls = GPU death.
 *    InstancedMesh renders all nodes in a single draw call by encoding each
 *    node's position/scale/color into a matrix. This is 100-500x faster.
 *
 * 2. LineSegments for edges (ONE draw call for all connections):
 *    Same principle — we build one giant BufferGeometry with all edge vertex
 *    pairs and render it in one draw call.
 *
 * 3. Raycasting for hover/click:
 *    Three.js Raycaster fires a ray from camera through the mouse position.
 *    InstancedMesh.raycast() checks which instance was hit. O(n) but runs
 *    only on mouse events, not every frame.
 *
 * 4. OrbitControls (2D mode):
 *    We lock rotation (enableRotate=false), enable pan + zoom only.
 *    This gives a familiar 2D map experience while running on a 3D engine
 *    (which gives us free depth effects, glow, etc.)
 *
 * 5. Node sizes by type:
 *    keystone > notable > normal — matches GGG's visual hierarchy.
 *    class_start nodes are the largest (character origin points).
 */

import { useRef, useMemo, useCallback, useEffect, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, GradientTexture } from "@react-three/drei"
import * as THREE from "three"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_SIZES: Record<string, number> = {
  class_start: 18,
  keystone: 12,
  notable: 7,
  ascendancy_keystone: 10,
  ascendancy_notable: 7,
  normal: 4,
  ascendancy_normal: 4,
  ascendancy_start: 14,
  socket: 5,
  mastery: 6,
  expansion_jewel: 6,
}

// Forge design colors as THREE.Color
const COLORS = {
  normal: new THREE.Color(0x3a3040),         // dark muted purple
  notable: new THREE.Color(0x7a5c2e),        // warm gold
  keystone: new THREE.Color(0x1a6b8a),       // deep teal
  class_start: new THREE.Color(0x9b3a1a),    // ember red
  ascendancy_start: new THREE.Color(0x6b1a8a), // arcane purple
  ascendancy_notable: new THREE.Color(0x8a5c1a), // ascendancy gold
  ascendancy_keystone: new THREE.Color(0x1a4a8a), // ascendancy blue
  ascendancy_normal: new THREE.Color(0x2a2040),   // dim ascendancy
  socket: new THREE.Color(0x2a4a2a),         // jewel green
  mastery: new THREE.Color(0x4a3060),        // mastery purple
  expansion_jewel: new THREE.Color(0x1a4a1a),
  // Allocated states (ember orange)
  allocated: new THREE.Color(0xe67e22),
  allocatedKeystone: new THREE.Color(0xf39c12),
  // Hover highlight
  hover: new THREE.Color(0xffd700),
}

const EDGE_COLOR_NORMAL = new THREE.Color(0x2a2535)
const EDGE_COLOR_ALLOCATED = new THREE.Color(0xe67e22)

// ─── Types ────────────────────────────────────────────────────────────────────

interface NexusSceneProps {
  nodes: PassiveNodeDTO[]
  allocated: Set<string>
  onNodeHover: (node: PassiveNodeDTO | null) => void
  onNodeClick: (node: PassiveNodeDTO) => void
}

// ─── Edge geometry builder ─────────────────────────────────────────────────────

function buildEdgeGeometry(
  nodes: PassiveNodeDTO[],
  nodeMap: Map<string, PassiveNodeDTO>,
  allocated: Set<string>
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const seen = new Set<string>()

  for (const node of nodes) {
    if (!node.connections) continue
    for (const connId of node.connections) {
      const key = [node.nodeId, connId].sort().join("-")
      if (seen.has(key)) continue
      seen.add(key)

      const target = nodeMap.get(connId)
      if (!target) continue

      // Scale coordinates to Three.js units (divide by 100 to fit in view)
      const x1 = node.x / 100
      const y1 = -node.y / 100 // flip Y (screen Y is down, Three.js Y is up)
      const x2 = target.x / 100
      const y2 = -target.y / 100

      positions.push(x1, y1, 0, x2, y2, 0)

      // Color edges gold if both endpoints are allocated
      const isAllocated = allocated.has(node.nodeId) && allocated.has(connId)
      const c = isAllocated ? EDGE_COLOR_ALLOCATED : EDGE_COLOR_NORMAL
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

// ─── Nodes instanced mesh ──────────────────────────────────────────────────────

function NodeInstances({
  nodes,
  allocated,
  onHover,
  onClick,
}: {
  nodes: PassiveNodeDTO[]
  allocated: Set<string>
  onHover: (node: PassiveNodeDTO | null) => void
  onClick: (node: PassiveNodeDTO) => void
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const mouse = useMemo(() => new THREE.Vector2(), [])
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  // Build instance matrices and colors
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    nodes.forEach((node, i) => {
      const size = NODE_SIZES[node.type] ?? 4
      const x = node.x / 100
      const y = -node.y / 100

      tempMatrix.makeScale(size, size, 1)
      tempMatrix.setPosition(x, y, 0)
      mesh.setMatrixAt(i, tempMatrix)

      // Color
      let color: THREE.Color
      if (allocated.has(node.nodeId)) {
        color = node.type === "keystone" ? COLORS.allocatedKeystone : COLORS.allocated
      } else {
        color = COLORS[node.type as keyof typeof COLORS] ?? COLORS.normal
      }
      mesh.setColorAt(i, color)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [nodes, allocated, tempMatrix])

  // Raycast on mouse move
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = gl.domElement
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const mesh = meshRef.current
      if (!mesh) return

      const hits = raycaster.intersectObject(mesh)
      const hit = hits[0]
      if (hit != null && hit.instanceId != null) {
        onHover(nodes[hit.instanceId] ?? null)
      } else {
        onHover(null)
      }
    },
    [camera, gl, mouse, nodes, onHover, raycaster]
  )

  // Click handler
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const canvas = gl.domElement
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const mesh = meshRef.current
      if (!mesh) return

      const hits = raycaster.intersectObject(mesh)
      const hit = hits[0]
      if (hit != null && hit.instanceId != null) {
        const node = nodes[hit.instanceId]
        if (node) onClick(node)
      }
    },
    [camera, gl, mouse, nodes, onClick, raycaster]
  )

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("click", handleClick)
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("click", handleClick)
    }
  }, [gl, handleMouseMove, handleClick])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]} frustumCulled={false}>
      {/* Circle-like geometry — 8 segments is plenty at this scale */}
      <circleGeometry args={[1, 8]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  )
}

// ─── Edges line segments ───────────────────────────────────────────────────────

function EdgeLines({
  nodes,
  nodeMap,
  allocated,
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
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors opacity={0.5} transparent />
    </lineSegments>
  )
}

// ─── Inner scene (needs useThree context) ─────────────────────────────────────

function Scene({ nodes, allocated, onNodeHover, onNodeClick }: NexusSceneProps) {
  // Build nodeId → node lookup map once
  const nodeMap = useMemo(() => {
    const map = new Map<string, PassiveNodeDTO>()
    for (const node of nodes) map.set(node.nodeId, node)
    return map
  }, [nodes])

  return (
    <>
      {/* Ambient scene light (unused by meshBasicMaterial but good practice) */}
      <ambientLight intensity={0.5} />

      {/* Edges rendered BEFORE nodes so nodes draw on top */}
      <EdgeLines nodes={nodes} nodeMap={nodeMap} allocated={allocated} />

      {/* Nodes */}
      <NodeInstances
        nodes={nodes}
        allocated={allocated}
        onHover={onNodeHover}
        onClick={onNodeClick}
      />

      {/* 2D pan + zoom only — no rotation */}
      <OrbitControls
        enableRotate={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={20}
        maxDistance={2000}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    </>
  )
}

// ─── Public component ──────────────────────────────────────────────────────────

export function NexusScene({ nodes, allocated, onNodeHover, onNodeClick }: NexusSceneProps) {
  // Compute initial camera position to frame the whole tree
  const bounds = useMemo(() => {
    if (!nodes.length) return { cx: 0, cy: 0, size: 500 }
    const xs = nodes.map((n) => n.x / 100)
    const ys = nodes.map((n) => -n.y / 100)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      size: Math.max(maxX - minX, maxY - minY),
    }
  }, [nodes])

  return (
    <Canvas
      orthographic
      camera={{
        position: [bounds.cx, bounds.cy, 1000],
        zoom: 1,
        near: 0.1,
        far: 10000,
      }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera }) => {
        // Zoom to fit the whole tree on initial load
        const ortho = camera as THREE.OrthographicCamera
        ortho.zoom = Math.min(
          window.innerWidth / bounds.size,
          window.innerHeight / bounds.size
        ) * 0.8
        ortho.updateProjectionMatrix()
      }}
    >
      <color attach="background" args={["#050508"]} />
      <Scene
        nodes={nodes}
        allocated={allocated}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
      />
    </Canvas>
  )
}
