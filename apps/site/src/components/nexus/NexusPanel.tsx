"use client"

/**
 * NexusPanel — Side panel showing selected node details + allocated count
 *
 * Appears on the left when a node is clicked/selected.
 * Shows full stats, description, and a "deselect" button.
 */

import type { PassiveNodeDTO } from "@/app/api/passives/route"

interface NexusPanelProps {
  selected: PassiveNodeDTO | null
  allocated: Set<string>
  onDeselect: () => void
  onClearAllocated: () => void
}

const TYPE_COLORS: Record<string, string> = {
  keystone: "#00d4ff",
  ascendancy_keystone: "#00d4ff",
  notable: "#f39c12",
  ascendancy_notable: "#f39c12",
  class_start: "#e67e22",
  ascendancy_start: "#c084fc",
  socket: "#4ade80",
  mastery: "#a78bfa",
  normal: "#6b7280",
  ascendancy_normal: "#6b7280",
  expansion_jewel: "#4ade80",
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

export function NexusPanel({ selected, allocated, onDeselect, onClearAllocated }: NexusPanelProps) {
  const typeColor = selected ? (TYPE_COLORS[selected.type] ?? "#6b7280") : "#6b7280"

  return (
    <div
      className="absolute left-4 top-4 bottom-4 w-72 z-10 flex flex-col gap-3"
      style={{ pointerEvents: "none" }}
    >
      {/* Stats bar */}
      <div
        className="rounded-lg px-4 py-3 flex items-center justify-between"
        style={{
          background: "rgba(5, 5, 8, 0.85)",
          border: "1px solid rgba(230, 126, 34, 0.2)",
          backdropFilter: "blur(8px)",
          pointerEvents: "auto",
        }}
      >
        <div>
          <div
            className="text-xs uppercase tracking-widest"
            style={{ fontFamily: "Barlow Condensed, sans-serif", color: "#6b7280" }}
          >
            Nexus — Passive Tree
          </div>
          <div
            className="text-sm mt-0.5"
            style={{ fontFamily: "Barlow, sans-serif", color: "#e8e0d0" }}
          >
            <span style={{ color: "#f39c12", fontWeight: 600 }}>{allocated.size}</span>
            {" "}nodes allocated
          </div>
        </div>
        {allocated.size > 0 && (
          <button
            onClick={onClearAllocated}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              fontFamily: "Barlow Condensed, sans-serif",
              background: "rgba(230, 126, 34, 0.1)",
              border: "1px solid rgba(230, 126, 34, 0.3)",
              color: "#e67e22",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLElement).style.background = "rgba(230, 126, 34, 0.2)"
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLElement).style.background = "rgba(230, 126, 34, 0.1)"
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Selected node detail */}
      {selected && (
        <div
          className="rounded-lg flex-1 overflow-y-auto"
          style={{
            background: "rgba(5, 5, 8, 0.9)",
            border: `1px solid ${typeColor}30`,
            borderTop: `2px solid ${typeColor}`,
            backdropFilter: "blur(8px)",
            pointerEvents: "auto",
          }}
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3
                  className="text-sm font-bold leading-tight"
                  style={{ fontFamily: "Cinzel, serif", color: typeColor }}
                >
                  {selected.name}
                </h3>
                <div
                  className="text-xs mt-1 uppercase tracking-widest"
                  style={{ fontFamily: "Barlow Condensed, sans-serif", color: "#6b7280" }}
                >
                  {TYPE_LABELS[selected.type] ?? selected.type}
                  {selected.ascendancy && ` · ${selected.ascendancy}`}
                  {selected.classStart && ` · ${selected.classStart}`}
                </div>
              </div>
              <button
                onClick={onDeselect}
                style={{
                  color: "#6b7280",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  fontSize: 18,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label="Deselect node"
              >
                ×
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: `${typeColor}20`, marginBottom: 12 }} />

            {/* Stats */}
            {(selected.stats ?? []).length > 0 && (
              <ul className="space-y-1.5 mb-3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {selected.stats!.map((stat, i) => (
                  <li
                    key={i}
                    style={{
                      fontFamily: "Barlow, sans-serif",
                      fontSize: 13,
                      color: "#e8e0d0",
                      lineHeight: 1.5,
                    }}
                  >
                    {stat}
                  </li>
                ))}
              </ul>
            )}

            {/* Keystone description */}
            {selected.description && (
              <p
                style={{
                  fontFamily: "Barlow, sans-serif",
                  fontSize: 12,
                  color: "#9ca3af",
                  fontStyle: "italic",
                  lineHeight: 1.6,
                  borderTop: (selected.stats ?? []).length > 0 ? `1px solid ${typeColor}15` : "none",
                  paddingTop: (selected.stats ?? []).length > 0 ? 10 : 0,
                  marginTop: (selected.stats ?? []).length > 0 ? 10 : 0,
                }}
              >
                {selected.description}
              </p>
            )}

            {/* Connections count */}
            <div
              className="mt-4 text-xs"
              style={{ fontFamily: "Barlow Condensed, sans-serif", color: "#4b5563" }}
            >
              {(selected.connections ?? []).length} connection
              {(selected.connections ?? []).length !== 1 ? "s" : ""}
              {" · "}node #{selected.nodeId}
            </div>
          </div>
        </div>
      )}

      {/* Instructions hint */}
      {!selected && (
        <div
          className="rounded-lg px-4 py-3 text-center"
          style={{
            background: "rgba(5, 5, 8, 0.7)",
            border: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              fontFamily: "Barlow, sans-serif",
              fontSize: 12,
              color: "#4b5563",
              lineHeight: 1.6,
            }}
          >
            Click a node to inspect it.
            <br />
            Click again to toggle allocation.
            <br />
            Scroll to zoom · Drag to pan.
          </div>
        </div>
      )}
    </div>
  )
}
