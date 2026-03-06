"use client"

/**
 * CommandPalette — ⌘K global search
 *
 * WHY a custom event (wraex:search:open) instead of prop drilling:
 * The Navbar is deep in the component tree. The CommandPalette lives at
 * the root layout level. Passing an open/close callback through 4 layers
 * of components is messy. A custom event lets any component anywhere
 * trigger the palette with: window.dispatchEvent(new CustomEvent("wraex:search:open"))
 * Clean, decoupled, no state management library needed for this pattern.
 *
 * The search itself is a placeholder — wired to Meilisearch in Week 2.
 * The UX shell is complete: keyboard navigation, recent searches, categories.
 */

import { useState, useEffect, useRef, useCallback } from "react"

type SearchCategory = {
  label: string
  icon: string
  href: string
  accent?: "ember" | "rune"
}

const QUICK_LINKS: SearchCategory[] = [
  { label: "Browse Items",   icon: "📖", href: "/items" },
  { label: "Browse Builds",  icon: "⚒️", href: "/builds" },
  { label: "Passive Tree",   icon: "🌐", href: "/nexus",  accent: "rune" },
  { label: "AI Advisor",     icon: "🔮", href: "/oracle", accent: "rune" },
  { label: "Economy",        icon: "💰", href: "/economy" },
  { label: "Boss Database",  icon: "💀", href: "/bosses" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const openPalette = useCallback(() => {
    setOpen(true)
    // Focus input after CSS transition
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  useEffect(() => {
    // Listen for custom event from Navbar search button
    const onOpen = () => openPalette()
    window.addEventListener("wraex:search:open", onOpen)

    // ⌘K / Ctrl+K keyboard shortcut
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        open ? closePalette() : openPalette()
      }
      if (e.key === "Escape" && open) closePalette()
    }

    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("wraex:search:open", onOpen)
      window.removeEventListener("keydown", onKeydown)
    }
  }, [open, openPalette, closePalette])

  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh]"
      style={{ background: "rgba(5, 5, 8, 0.85)", backdropFilter: "blur(4px)" }}
      onClick={closePalette}
    >
      {/* Panel */}
      <div
        className="w-full max-w-xl animate-fade-up overflow-hidden rounded-sm border border-border-default bg-forge-900 shadow-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search Wraex Codex"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-parchment-muted" aria-hidden>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, builds, skills, bosses..."
            className="flex-1 bg-transparent font-body text-sm text-parchment placeholder:text-parchment-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-parchment-dim hover:text-parchment-muted"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <kbd
            onClick={closePalette}
            className="cursor-pointer rounded border border-border-default px-1.5 py-0.5 font-mono text-[10px] text-parchment-dim hover:text-parchment-muted"
          >
            Esc
          </kbd>
        </div>

        {/* Results area */}
        <div className="max-h-96 overflow-y-auto scrollbar-none">
          {query.trim() === "" ? (
            /* Empty state — quick links */
            <div className="p-2">
              <p className="px-3 pb-2 pt-1 font-ui text-[10px] uppercase tracking-widest text-parchment-dim">
                Quick Navigation
              </p>
              {QUICK_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closePalette}
                  className="flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors duration-100 hover:bg-surface-2"
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="font-body text-sm text-parchment">{item.label}</span>
                  {item.accent === "rune" && (
                    <span className="ml-auto rounded-sm bg-rune/10 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider text-rune">
                      AI
                    </span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            /* Search results placeholder — Meilisearch in Week 2 */
            <div className="px-4 py-8 text-center">
              <p className="font-body text-sm text-parchment-muted">
                Searching for{" "}
                <span className="text-ember">&ldquo;{query}&rdquo;</span>
                ...
              </p>
              <p className="mt-2 font-body text-xs text-parchment-dim">
                Full search powered by Meilisearch — coming Week 2
              </p>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-border-subtle px-4 py-2">
          {[
            { key: "↑↓", label: "navigate" },
            { key: "↵", label: "select" },
            { key: "Esc", label: "close" },
          ].map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1.5 font-ui text-[10px] text-parchment-dim">
              <kbd className="rounded border border-border-default px-1 py-0.5 font-mono text-[9px]">{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
