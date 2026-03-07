"use client"

/**
 * Navbar — Wraex Codex
 *
 * WHY "use client":
 * Two things require the browser runtime:
 * 1. `scrollY` — reading scroll position needs window, which doesn't exist on server
 * 2. Mobile menu open/close state — useState
 *
 * Everything else (links, logo, nav items) would be fine as Server Components,
 * but since this file needs "use client" anyway, it's all here.
 *
 * Design decisions:
 * - Transparent on top of hero, gains glass background after 60px scroll
 * - 64px height — tall enough to feel premium, not so tall it steals viewport
 * - Mobile: hamburger → full-screen overlay menu (not a dropdown — more dramatic)
 * - Search trigger opens the CommandPalette (⌘K) — wired to Meilisearch in Week 2
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_LINKS = [
  { label: "Items",  href: "/items",  description: "Item database" },
  { label: "Skills", href: "/skills", description: "Skill gem database" },
  { label: "Builds", href: "/builds", description: "Community build guides" },
  { label: "Nexus",  href: "/nexus",  description: "Interactive passive tree" },
  { label: "Oracle", href: "/oracle", description: "AI build advisor",  isAI: true },
] as const

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <>
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 h-16 transition-all duration-300",
          scrolled
            ? "border-b border-border-subtle bg-forge-950/90 shadow-navbar backdrop-blur-md"
            : "bg-transparent",
        ].join(" ")}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6">

          {/* ── Logo ── */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group select-none"
            aria-label="Wraex Codex — Home"
          >
            {/* Sigil mark */}
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute inset-0 rounded-sm bg-ember/10 transition-colors duration-200 group-hover:bg-ember/20" />
              <svg
                width="18" height="18" viewBox="0 0 18 18" fill="none"
                className="relative z-10"
                aria-hidden
              >
                {/* Stylised "W" sigil — ember gold */}
                <path
                  d="M2 3L5.5 13L9 6L12.5 13L16 3"
                  stroke="#e67e22" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                />
                <path
                  d="M5.5 13L9 15.5L12.5 13"
                  stroke="#f39c12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                  opacity="0.7"
                />
              </svg>
            </div>

            {/* Wordmark */}
            <span className="font-display text-base font-bold tracking-wide text-parchment transition-colors duration-200 group-hover:text-ember-light">
              Wraex <span className="text-gradient-ember">Codex</span>
            </span>
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "relative px-3.5 py-2 font-ui text-sm font-medium uppercase tracking-wider",
                    "rounded-sm transition-colors duration-150",
                    "isAI" in link && link.isAI
                      ? isActive
                        ? "text-rune"
                        : "text-parchment-muted hover:text-rune"
                      : isActive
                        ? "text-ember"
                        : "text-parchment-muted hover:text-parchment",
                  ].join(" ")}
                >
                  {link.label}
                  {"isAI" in link && link.isAI && (
                    <span className="ml-1.5 rounded-sm bg-rune/10 px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider text-rune">
                      AI
                    </span>
                  )}
                  {/* Active underline */}
                  {isActive && (
                    <span
                      className={[
                        "absolute bottom-0 left-3.5 right-3.5 h-px",
                        "isAI" in link && link.isAI ? "bg-rune" : "bg-ember",
                      ].join(" ")}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* ── Right side actions ── */}
          <div className="flex items-center gap-2">

            {/* Search trigger */}
            <button
              onClick={() => {
                // Dispatch custom event — CommandPalette listens for this
                window.dispatchEvent(new CustomEvent("wraex:search:open"))
              }}
              className="flex h-8 items-center gap-2 rounded-sm border border-border-default bg-surface-1 px-3 font-ui text-xs text-parchment-muted transition-all duration-150 hover:border-ember/40 hover:text-parchment md:w-44"
              aria-label="Open search"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="hidden md:inline">Search...</span>
              <kbd className="ml-auto hidden rounded border border-border-default px-1 font-mono text-[9px] md:inline">
                ⌘K
              </kbd>
            </button>

            {/* Sign In */}
            <Link
              href="/sign-in"
              className="hidden h-8 items-center rounded-sm border border-ember/40 px-4 font-ui text-xs font-semibold uppercase tracking-wider text-ember transition-all duration-150 hover:border-ember hover:bg-ember/10 md:flex"
            >
              Sign In
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 rounded-sm md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <span
                className={[
                  "h-px w-5 bg-parchment transition-transform duration-200",
                  mobileOpen ? "translate-y-[3px] rotate-45" : "",
                ].join(" ")}
              />
              <span
                className={[
                  "h-px w-5 bg-parchment transition-opacity duration-200",
                  mobileOpen ? "opacity-0" : "",
                ].join(" ")}
              />
              <span
                className={[
                  "h-px w-5 bg-parchment transition-transform duration-200",
                  mobileOpen ? "-translate-y-[7px] -rotate-45" : "",
                ].join(" ")}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-forge-950/98 backdrop-blur-lg md:hidden"
          style={{ paddingTop: "64px" }}
        >
          <nav className="flex flex-col px-6 pt-8" aria-label="Mobile navigation">
            {NAV_LINKS.map((link, i) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "flex items-center justify-between border-b border-border-subtle py-5",
                    "font-display text-2xl font-bold transition-colors duration-150",
                    isActive ? "text-ember" : "text-parchment hover:text-ember",
                  ].join(" ")}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span>{link.label}</span>
                  {"isAI" in link && link.isAI && (
                    <span className="rounded-sm bg-rune/10 px-2 py-1 font-ui text-xs uppercase tracking-wider text-rune">
                      AI
                    </span>
                  )}
                </Link>
              )
            })}

            <Link
              href="/sign-in"
              className="mt-8 flex h-12 items-center justify-center rounded-sm border border-ember bg-ember/10 font-ui text-sm font-semibold uppercase tracking-wider text-ember"
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
