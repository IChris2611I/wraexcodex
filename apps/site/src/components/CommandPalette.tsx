"use client"

/**
 * CommandPalette — ⌘K global search powered by PostgreSQL pg_trgm
 *
 * Architecture:
 * - Client Component (needs state + effects)
 * - Fetches from /api/search (server route, queries Postgres directly)
 * - Debounced at 300ms — feels instant, doesn't hammer the DB
 * - Full keyboard nav: ↑↓ to move, Enter to navigate, Esc to close
 *
 * Search highlights:
 * - We don't get server-side <mark> tags (that's Meilisearch-specific)
 * - Instead we do client-side highlight: split the name on the query substring,
 *   wrap matches in <mark>. Fast, zero deps, works for all cases we care about.
 *
 * WHY custom event (wraex:search:open) instead of prop drilling:
 * The Navbar is deep in the component tree. A custom event lets any component
 * trigger the palette with one line, no context/store required.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import type { SearchHit, SearchResponse } from "@/app/api/search/route"
import { resolveIconUrl } from "@/lib/item-icon"

// ── Quick links (shown when query is empty) ────────────────────────────────

type QuickLink = { label: string; icon: string; href: string; accent?: "ember" | "rune" }

const QUICK_LINKS: QuickLink[] = [
  { label: "Browse Items",  icon: "📖", href: "/items" },
  { label: "Browse Builds", icon: "⚒️", href: "/builds" },
  { label: "Passive Tree",  icon: "🌐", href: "/nexus",  accent: "rune" },
  { label: "AI Advisor",   icon: "🔮", href: "/oracle", accent: "rune" },
  { label: "Economy",      icon: "💰", href: "/economy" },
  { label: "Boss Database",icon: "💀", href: "/bosses" },
]

// ── Colours ────────────────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
  unique:   "text-[#af6025]",
  currency: "text-[#aa9e82]",
  gem:      "text-[#1ba29b]",
  normal:   "text-parchment-muted",
  magic:    "text-[#8888ff]",
  rare:     "text-[#ffff77]",
}

const CATEGORY_ICONS: Record<string, string> = {
  weapon: "⚔️", armour: "🛡️", accessory: "💎", flask: "🧪",
  gem: "💠", currency: "🪙", map: "🗺️", fragment: "🔷",
  divination_card: "🃏", misc: "📦",
}

// ── Helpers ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * Client-side highlight: wraps query matches in <mark>.
 * Returns an array of {text, highlight} segments safe for rendering.
 *
 * WHY client-side instead of server-side:
 * The Postgres query doesn't produce markup — it returns plain strings.
 * Highlighting on the client is fine: it's purely cosmetic, zero security risk
 * (we're only operating on our own DB content), and runs in <1ms.
 */
function highlightSegments(text: string, query: string): { t: string; hi: boolean }[] {
  if (!query || !text) return [{ t: text, hi: false }]
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return [{ t: text, hi: false }]
  return [
    { t: text.slice(0, idx), hi: false },
    { t: text.slice(idx, idx + query.length), hi: true },
    { t: text.slice(idx + query.length), hi: false },
  ].filter((s) => s.t.length > 0)
}

function HighlightedText({
  text,
  query,
  className,
}: {
  text: string
  query: string
  className?: string
}) {
  const segments = highlightSegments(text, query)
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.hi ? (
          <mark key={i} className="bg-transparent font-bold underline underline-offset-2 text-inherit">
            {seg.t}
          </mark>
        ) : (
          <span key={i}>{seg.t}</span>
        )
      )}
    </span>
  )
}

// ── CommandPalette ─────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  // ── Open / close ──────────────────────────────────────────────────────

  const openPalette = useCallback(() => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery("")
    setResults([])
    setActiveIndex(-1)
  }, [])

  // ── Event listeners ───────────────────────────────────────────────────

  useEffect(() => {
    const onOpen = () => openPalette()
    window.addEventListener("wraex:search:open", onOpen)

    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        open ? closePalette() : openPalette()
      }
      if (!open) return
      if (e.key === "Escape") { closePalette(); return }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, (results.length || QUICK_LINKS.length) - 1))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault()
        if (query.trim() && results[activeIndex]) {
          window.location.href = `/items/${results[activeIndex]!.slug}`
          closePalette()
        } else if (!query.trim() && QUICK_LINKS[activeIndex]) {
          window.location.href = QUICK_LINKS[activeIndex]!.href
          closePalette()
        }
      }
    }

    window.addEventListener("keydown", onKeydown)
    return () => {
      window.removeEventListener("wraex:search:open", onOpen)
      window.removeEventListener("keydown", onKeydown)
    }
  }, [open, results, activeIndex, query, openPalette, closePalette])

  // Reset keyboard selection when results change
  useEffect(() => { setActiveIndex(-1) }, [debouncedQuery])

  // ── Search fetch ──────────────────────────────────────────────────────

  useEffect(() => {
    const q = debouncedQuery.trim()

    if (!q || q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
      .then((res) => res.json() as Promise<SearchResponse>)
      .then((data) => {
        if (!cancelled) {
          setResults(data.hits)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([])
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [debouncedQuery])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  if (!open) return null

  const showResults = query.trim().length >= 2

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh]"
      style={{ background: "rgba(5, 5, 8, 0.85)", backdropFilter: "blur(4px)" }}
      onClick={closePalette}
    >
      <div
        className="w-full max-w-xl animate-fade-up overflow-hidden rounded-sm border border-border-default bg-forge-900 shadow-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search Wraex Codex"
      >
        {/* ── Search input ── */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          {loading ? (
            <svg className="h-4 w-4 shrink-0 animate-spin text-ember" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-parchment-muted" aria-hidden>
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, skills, bosses..."
            className="flex-1 bg-transparent font-body text-sm text-parchment placeholder:text-parchment-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]) }}
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

        {/* ── Results area ── */}
        <div ref={listRef} className="max-h-96 overflow-y-auto scrollbar-none">

          {/* Quick links (empty / short query) */}
          {!showResults && (
            <div className="p-2">
              <p className="px-3 pb-2 pt-1 font-ui text-[10px] uppercase tracking-widest text-parchment-dim">
                Quick Navigation
              </p>
              {QUICK_LINKS.map((item, i) => (
                <a
                  key={item.href}
                  href={item.href}
                  data-idx={i}
                  onClick={closePalette}
                  className={[
                    "flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors duration-100",
                    activeIndex === i ? "bg-surface-2" : "hover:bg-surface-2",
                  ].join(" ")}
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
          )}

          {/* Search results */}
          {showResults && results.length > 0 && (
            <div className="p-2">
              <p className="px-3 pb-2 pt-1 font-ui text-[10px] uppercase tracking-widest text-parchment-dim">
                Items
              </p>
              {results.map((hit, i) => {
                const nameColor = RARITY_COLORS[hit.rarity] ?? "text-parchment"
                const iconUrl = resolveIconUrl(hit.iconUrl)

                return (
                  <Link
                    key={hit.id}
                    href={`/items/${hit.slug}`}
                    data-idx={i}
                    onClick={closePalette}
                    className={[
                      "flex items-center gap-3 rounded-sm px-3 py-2 transition-colors duration-100",
                      activeIndex === i ? "bg-surface-2" : "hover:bg-surface-2",
                    ].join(" ")}
                  >
                    {/* Icon */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-forge-800/60">
                      {iconUrl ? (
                        <Image
                          src={iconUrl}
                          alt={hit.name}
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="text-base">{CATEGORY_ICONS[hit.category] ?? "📦"}</span>
                      )}
                    </div>

                    {/* Name + base type */}
                    <div className="min-w-0 flex-1">
                      <HighlightedText
                        text={hit.name}
                        query={debouncedQuery}
                        className={`block truncate font-ui text-sm font-medium leading-tight ${nameColor}`}
                      />
                      {hit.baseType && (
                        <HighlightedText
                          text={hit.baseType}
                          query={debouncedQuery}
                          className="mt-0.5 block truncate font-body text-xs text-parchment-muted"
                        />
                      )}
                    </div>

                    {/* Chaos price */}
                    {hit.chaosValue != null && (
                      <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 rounded-sm border border-[#8b2252]/30 bg-[#1a0a1a]/60 px-1.5 py-0.5 font-ui text-[10px] text-parchment-muted">
                        <span className="text-[#c45caa]">✦</span>
                        {hit.chaosValue >= 10
                          ? Math.round(hit.chaosValue).toLocaleString()
                          : hit.chaosValue.toFixed(1)}c
                      </span>
                    )}

                    {/* Category badge */}
                    <span className="shrink-0 rounded-sm border border-border-subtle bg-forge-800/40 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider text-parchment-dim">
                      {hit.category.replace("_", " ")}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}

          {/* No results */}
          {showResults && !loading && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-body text-sm text-parchment-muted">
                No results for{" "}
                <span className="text-ember">&ldquo;{query}&rdquo;</span>
              </p>
              <Link
                href={`/items`}
                onClick={closePalette}
                className="mt-3 inline-block font-ui text-xs text-ember underline underline-offset-2 hover:text-ember-light"
              >
                Browse all items →
              </Link>
            </div>
          )}

          {/* Searching state */}
          {showResults && loading && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-body text-sm text-parchment-dim">Searching...</p>
            </div>
          )}
        </div>

        {/* ── Footer hints ── */}
        <div className="flex items-center gap-4 border-t border-border-subtle px-4 py-2">
          {[
            { key: "↑↓", label: "navigate" },
            { key: "↵",  label: "select" },
            { key: "Esc", label: "close" },
          ].map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1.5 font-ui text-[10px] text-parchment-dim">
              <kbd className="rounded border border-border-default px-1 py-0.5 font-mono text-[9px]">{key}</kbd>
              {label}
            </span>
          ))}
          {results.length > 0 && (
            <span className="ml-auto font-ui text-[10px] text-parchment-dim opacity-50">
              {results.length} results
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
