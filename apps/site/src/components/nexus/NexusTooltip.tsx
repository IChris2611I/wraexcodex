"use client"

/**
 * NexusTooltip — HTML overlay tooltip for hovered passive nodes
 *
 * WHY HTML overlay instead of Three.js text?
 * Three.js text (troika-three-text etc.) is heavy and hard to style.
 * A CSS div positioned via pointer coordinates is instant and fully styleable.
 * The canvas fires onNodeHover → parent stores hovered node + mouse pos →
 * this component renders absolutely positioned over the canvas.
 */

import type { PassiveNodeDTO } from "@/app/api/passives/route"

interface NexusTooltipProps {
  node: PassiveNodeDTO | null
  mouseX: number
  mouseY: number
}

const TYPE_LABELS: Record<string, string> = {
  normal: "Passive",
  notable: "Notable",
  keystone: "Keystone",
  class_start: "Class Origin",
  ascendancy_start: "Ascendancy Origin",
  ascendancy_normal: "Ascendancy Passive",
  ascendancy_notable: "Ascendancy Notable",
  ascendancy_keystone: "Ascendancy Keystone",
  socket: "Jewel Socket",
  mastery: "Mastery",
  expansion_jewel: "Expansion Jewel",
}

const TYPE_COLORS: Record<string, string> = {
  keystone: "#00d4ff",           // rune cyan
  ascendancy_keystone: "#00d4ff",
  notable: "#f39c12",            // ember gold
  ascendancy_notable: "#f39c12",
  class_start: "#e67e22",
  ascendancy_start: "#c084fc",   // arcane purple
  socket: "#4ade80",             // jewel green
  mastery: "#a78bfa",
  normal: "#9ca3af",
  ascendancy_normal: "#9ca3af",
  expansion_jewel: "#4ade80",
}

export function NexusTooltip({ node, mouseX, mouseY }: NexusTooltipProps) {
  if (!node) return null

  // Position tooltip: prefer right+above cursor, flip if near edge
  const OFFSET = 16
  const tooltipWidth = 280
  const left = mouseX + OFFSET + tooltipWidth > window.innerWidth
    ? mouseX - OFFSET - tooltipWidth
    : mouseX + OFFSET
  const top = mouseY - OFFSET

  const typeLabel = TYPE_LABELS[node.type] ?? node.type
  const typeColor = TYPE_COLORS[node.type] ?? "#9ca3af"
  const stats = node.stats ?? []

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: tooltipWidth,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0d0d18 0%, #12101e 100%)",
          border: `1px solid ${typeColor}40`,
          borderTop: `2px solid ${typeColor}`,
          borderRadius: 6,
          padding: "10px 14px",
          boxShadow: `0 4px 24px rgba(0,0,0,0.8), 0 0 12px ${typeColor}20`,
        }}
      >
        {/* Node name */}
        <div
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: 13,
            fontWeight: 700,
            color: typeColor,
            marginBottom: 2,
            letterSpacing: "0.04em",
          }}
        >
          {node.name}
        </div>

        {/* Type badge */}
        <div
          style={{
            fontFamily: "Barlow Condensed, sans-serif",
            fontSize: 11,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: stats.length > 0 ? 8 : 0,
          }}
        >
          {typeLabel}
          {node.ascendancy && ` · ${node.ascendancy}`}
          {node.classStart && ` · ${node.classStart}`}
        </div>

        {/* Stats list */}
        {stats.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {stats.map((stat, i) => (
              <li
                key={i}
                style={{
                  fontFamily: "Barlow, sans-serif",
                  fontSize: 12,
                  color: "#e8e0d0",
                  lineHeight: 1.5,
                  borderTop: i > 0 ? "1px solid #1e1b2e" : "none",
                  paddingTop: i > 0 ? 4 : 0,
                  marginTop: i > 0 ? 4 : 0,
                }}
              >
                {stat}
              </li>
            ))}
          </ul>
        )}

        {/* Keystone description */}
        {node.description && (
          <p
            style={{
              fontFamily: "Barlow, sans-serif",
              fontSize: 11,
              color: "#9ca3af",
              margin: stats.length > 0 ? "8px 0 0" : "4px 0 0",
              fontStyle: "italic",
              lineHeight: 1.5,
              borderTop: stats.length > 0 ? "1px solid #1e1b2e" : "none",
              paddingTop: stats.length > 0 ? 6 : 0,
            }}
          >
            {node.description}
          </p>
        )}
      </div>
    </div>
  )
}
