"use client"

/**
 * SearchButton — thin client wrapper for the hero search bar.
 *
 * WHY a separate component for this:
 * The homepage is a Server Component (better SEO, no hydration cost).
 * But the search button needs an onClick to fire the custom event that
 * opens the CommandPalette. We can't put onClick in a Server Component.
 *
 * Solution: extract ONLY the button into a Client Component.
 * The rest of the homepage stays server-rendered.
 * This is the "islands of interactivity" pattern — minimal client JS.
 */

export function SearchButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("wraex:search:open"))}
      className="group flex w-full items-center gap-3 rounded-sm border border-border-default bg-forge-900/80 px-5 py-4 text-left shadow-card backdrop-blur-sm transition-all duration-200 hover:border-ember/40 hover:shadow-ember"
      aria-label="Open search"
    >
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        className="shrink-0 text-parchment-muted transition-colors duration-150 group-hover:text-ember"
        aria-hidden
      >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="flex-1 font-body text-base text-parchment-muted">
        Search items, builds, skills, bosses...
      </span>
      <kbd className="rounded border border-border-default bg-forge-800 px-2 py-1 font-mono text-[11px] text-parchment-dim">
        ⌘K
      </kbd>
    </button>
  )
}
