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
 *
 * 5. Matrix composition fix:
 *    makeScale() then setPosition() REPLACES the matrix — we must use
 *    compose() or makeTranslation() * makeScale() to get both.
 */

import { useRef, useMemo, useCallback, useEffect } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { PassiveNodeDTO } from "@/app/api/passives/route"

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_SIZES: Record<string, number> = {
  class_start:        22,
  ascendancy_start:   18,
  keystone:           14,
  ascendancy_keystone:12,
  notable:             9,
  ascendancy_notable:  9,
  mastery:             8,
  socket:              7,
  expansion_jewel:     7,
  normal:              5,
  ascendancy_normal:   5,
}

// Bright, visible colors — forge palette but much lighter so they pop on dark bg
const COLORS = {
  normal:              new THREE.Color(0x6655aa),  // soft purple
  notable:             new THREE.Color(0xc8922a),  // warm gold
  keystone:            new THREE.Color(0x29a8d4),  // bright teal/cyan
  class_start:         new THREE.Color(0xe55a1c),  // ember orange-red
  ascendancy_start:    new THREE.Color(0xb44fe8),  // vivid arcane purple
  ascendancy_notable:  new THREE.Color(0xd4a020),  // ascendancy gold
  ascendancy_keystone: new THREE.Color(0x3a7fe0),  // bright ascendancy blue
  ascendancy_normal:   new THREE.Color(0x5544aa),  // muted ascendancy purple
  socket:              new THREE.Color(0x38b864),  // jewel green
  mastery:             new THREE.Color(0x9966dd),  // mastery violet
  expansion_jewel:     new THREE.Color(0x30a850),  // expansion green
  // Allocated states
  allocated:           new THREE.Color(0xe67e22),  // ember orange
  allocatedKeystone:   new THREE.Color(0xf39c12),  // gold
}

const EDGE_COLOR_NORMAL    = new THREE.Color(0x8877cc)  // bright lavender — clearly visible
const EDGE_COLOR_ALLOCATED = new THREE.Color(0xf39c12)  // gold for allocated paths

// Coordinate scale — raw poe2db coords are in thousands, divide to fit Three.js units
const COORD_SCALE = 100

// ─── Types ────────────────────────────────────────────────────────────────────

interface NexusSceneProps {
  nodes:       PassiveNodeDTO[]
  allocated:   Set<string>
  onNodeHover: (node: PassiveNodeDTO | null) => void
  onNodeClick: (node: PassiveNodeDTO) => void
}

// ─── Edge geometry builder ─────────────────────────────────────────────────────

function buildEdgeGeometry(
  nodes:    PassiveNodeDTO[],
  nodeMap:  Map<string, PassiveNodeDTO>,
  allocated: Set<string>
): THREE.BufferGeometry {
  const positions: number[] = []
  const colors:    number[] = []
  const seen = new Set<string>()

  for (const node of nodes) {
    if (!node.connections?.length) continue
    for (const connId of node.connections) {
      const key = node.nodeId < connId
        ? `${node.nodeId}-${connId}`
        : `${connId}-${node.nodeId}`
      if (seen.has(key)) continue
      seen.add(key)

      const target = nodeMap.get(connId)
      if (!target) continue

      const x1 =  node.x   / COORD_SCALE
      const y1 = -node.y   / COORD_SCALE
      const x2 =  target.x / COORD_SCALE
      const y2 = -target.y / COORD_SCALE

      positions.push(x1, y1, 0, x2, y2, 0)

      const isAllocated = allocated.has(node.nodeId) && allocated.has(connId)
      const c = isAllocated ? EDGE_COLOR_ALLOCATED : EDGE_COLOR_NORMAL
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

// ─── Nodes instanced mesh ──────────────────────────────────────────────────────

function NodeInstances({
  nodes,
  allocated,
  onHover,
  onClick,
}: {
  nodes:     PassiveNodeDTO[]
  allocated: Set<string>
  onHover:   (node: PassiveNodeDTO | null) => void
  onClick:   (node: PassiveNodeDTO) => void
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const mouse     = useMemo(() => new THREE.Vector2(), [])

  // Reusable objects — avoid allocating inside the loop
  const position   = useMemo(() => new THREE.Vector3(), [])
  const quaternion = useMemo(() => new THREE.Quaternion(), [])
  const scale      = useMemo(() => new THREE.Vector3(), [])
  const matrix     = useMemo(() => new THREE.Matrix4(), [])

  // Build instance matrices and colors whenever data changes
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    nodes.forEach((node, i) => {
      const size = NODE_SIZES[node.type] ?? 5
      const x =  node.x / COORD_SCALE
      const y = -node.y / COORD_SCALE

      // compose() = position + rotation + scale — correct way to set all three
      position.set(x, y, 0)
      quaternion.identity()
      scale.set(size, size, 1)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)

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
  }, [nodes, allocated, position, quaternion, scale, matrix])

  // Mouse move → hover detection via raycasting
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = gl.domElement
      const rect   = canvas.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const mesh = meshRef.current
      if (!mesh) return

      const hits = raycaster.intersectObject(mesh)
      const hit  = hits[0]
      if (hit != null && hit.instanceId != null) {
        onHover(nodes[hit.instanceId] ?? null)
      } else {
        onHover(null)
      }
    },
    [camera, gl, mouse, nodes, onHover, raycaster]
  )

  // Click → select / toggle allocation
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const canvas = gl.domElement
      const rect   = canvas.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const mesh = meshRef.current
      if (!mesh) return

      const hits = raycaster.intersectObject(mesh)
      const hit  = hits[0]
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
    canvas.addEventListener("click",     handleClick)
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("click",     handleClick)
    }
  }, [gl, handleMouseMove, handleClick])

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      frustumCulled={false}
    >
      {/* 12-segment circle — smooth enough at any zoom level */}
      <circleGeometry args={[1, 12]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  )
}

// ─── Edges ─────────────────────────────────────────────────────────────────────

function EdgeLines({
  nodes,
  nodeMap,
  allocated,
}: {
  nodes:     PassiveNodeDTO[]
  nodeMap:   Map<string, PassiveNodeDTO>
  allocated: Set<string>
}) {
  const geometry = useMemo(
    () => buildEdgeGeometry(nodes, nodeMap, allocated),
    [nodes, nodeMap, allocated]
  )

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      {/* opacity:1 — no transparency needed, color is the brightness control */}
      <lineBasicMaterial vertexColors />
    </lineSegments>
  )
}

// ─── Inner scene ───────────────────────────────────────────────────────────────

function Scene({ nodes, allocated, onNodeHover, onNodeClick }: NexusSceneProps) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, PassiveNodeDTO>()
    for (const node of nodes) map.set(node.nodeId, node)
    return map
  }, [nodes])

  return (
    <>
      <EdgeLines nodes={nodes} nodeMap={nodeMap} allocated={allocated} />
      <NodeInstances
        nodes={nodes}
        allocated={allocated}
        onHover={onNodeHover}
        onClick={onNodeClick}
      />
      <OrbitControls
        enableRotate={false}
        enableDamping={false}   // damping adds 1-frame lag on every interaction — kills zoom feel
        zoomSpeed={2.0}         // snappier zoom
        panSpeed={1.5}
        minZoom={0.5}
        maxZoom={50}
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
  // Compute tree bounds to center the camera
  const bounds = useMemo(() => {
    if (!nodes.length) return { cx: 0, cy: 0, span: 500 }
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      const x =  n.x / COORD_SCALE
      const y = -n.y / COORD_SCALE
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    return {
      cx:   (minX + maxX) / 2,
      cy:   (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY),
    }
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
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera, size }) => {
        const ortho = camera as THREE.OrthographicCamera
        // Start zoomed so the tree fills ~80% of the viewport
        // Then back off by 4x so the user sees a comfortable portion — not the whole tree squished tiny
        const fitZoom = Math.min(size.width, size.height) / bounds.span
        ortho.zoom = fitZoom * 4   // 4x = start at a readable zoom level
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
