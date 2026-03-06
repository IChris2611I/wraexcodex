/**
 * Homepage — Wraex Codex
 *
 * Server Component — zero client JS.
 * WHY no "use client": This entire page can render on the server. The HTML
 * is static, styles are CSS, hover effects use Tailwind group-hover (pure CSS).
 * No interactivity here = faster LCP, better SEO, no hydration cost.
 *
 * The onMouseEnter/Leave mistake from before: event handlers are JS — they
 * cannot exist in Server Components. React will throw at runtime. Pure CSS
 * hover via `group` / `group-hover:` is always preferred when no JS state
 * is needed.
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-forge-gradient font-body">

      {/* ═══════════════════════════════════════ HERO ══ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">

        {/* Radial ember glow — pure CSS, no JS */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 35%, rgba(230,126,34,0.10) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        {/* Eyebrow */}
        <p className="font-ui text-xs font-semibold uppercase tracking-[0.35em] text-ember opacity-80">
          Path of Exile 2 Reference
        </p>

        {/* Title */}
        <h1 className="mt-3 font-display text-6xl font-black leading-none tracking-tight text-parchment md:text-7xl lg:text-8xl">
          Wraex{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #e67e22, #f39c12)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Codex
          </span>
        </h1>

        {/* Tagline */}
        <p className="mt-5 max-w-lg font-body text-lg text-parchment-muted md:text-xl">
          The knowledge of Wraeclast, forged into data.
        </p>

        {/* Search */}
        <div className="mt-10 w-full max-w-2xl">
          <div className="relative">
            <input
              type="search"
              placeholder="Search items, skills, builds, bosses..."
              className="w-full rounded-sm border border-parchment-dim bg-forge-900 px-5 py-4 font-body text-base text-parchment placeholder:text-parchment-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
              aria-label="Search Wraex Codex"
            />
            <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded border border-parchment-dim px-1.5 py-0.5 font-ui text-[10px] text-parchment-dim">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/builds"
            className="inline-flex h-11 items-center rounded-sm border border-ember bg-ember px-7 font-ui text-sm font-semibold uppercase tracking-wider text-forge-950 transition-all duration-150 hover:bg-ember-light hover:shadow-ember"
          >
            Browse Builds
          </a>
          <a
            href="/items"
            className="inline-flex h-11 items-center rounded-sm border border-parchment-dim px-7 font-ui text-sm font-semibold uppercase tracking-wider text-parchment-muted transition-all duration-150 hover:border-parchment hover:text-parchment"
          >
            Item Database
          </a>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-25">
          <span className="font-ui text-[10px] uppercase tracking-widest text-parchment-muted">Explore</span>
          <div className="h-6 w-px bg-parchment-muted" />
        </div>
      </section>

      {/* ═══════════════════════════════════ FEATURES ══ */}
      <section className="mx-auto max-w-6xl px-6 pb-32 pt-4">

        <div className="mb-12 text-center">
          <p className="font-ui text-xs uppercase tracking-[0.3em] text-ember opacity-70">
            Four Pillars
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-parchment md:text-4xl">
            Everything You Need. Nothing You Don&apos;t.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>

        <div className="mt-20 flex items-center gap-6">
          <div className="h-px flex-1 bg-parchment-dim opacity-20" />
          <span className="font-ui text-xs uppercase tracking-widest text-parchment-dim opacity-40">
            More coming soon
          </span>
          <div className="h-px flex-1 bg-parchment-dim opacity-20" />
        </div>
      </section>

    </main>
  )
}

/* ── Feature card data ───────────────────────────────────────── */

type Feature = {
  icon: string
  title: string
  subtitle: string
  description: string
  href: string
  accent: "ember" | "rune"
}

const FEATURES: Feature[] = [
  {
    icon: "📖",
    title: "The Codex",
    subtitle: "Item & Skill Database",
    description:
      "Every item, skill, boss, and passive. Full stats, drop locations, in-game tooltips, and live trade prices.",
    href: "/items",
    accent: "ember",
  },
  {
    icon: "⚒️",
    title: "The Forge",
    subtitle: "Build System",
    description:
      "Community build guides, gear planners, budget calculators, and a DPS simulator. Find your perfect build.",
    href: "/builds",
    accent: "ember",
  },
  {
    icon: "🔮",
    title: "The Oracle",
    subtitle: "AI Build Advisor",
    description:
      "Describe what you want in plain language. Cross-references every build and returns expert recommendations.",
    href: "/oracle",
    accent: "rune",
  },
  {
    icon: "🌐",
    title: "The Nexus",
    subtitle: "Interactive Passive Tree",
    description:
      "Full PoE2 passive tree in your browser. Zoom, pan, allocate nodes, import builds. No install required.",
    href: "/nexus",
    accent: "rune",
  },
]

/**
 * FeatureCard — pure Server Component, hover via CSS group utilities.
 *
 * WHY `group` + `group-hover:`:
 * Tailwind's group system lets a parent element expose hover state to its
 * children via CSS selectors — no JavaScript whatsoever.
 * `.group:hover .group-hover\:opacity-100` compiles to a pure CSS rule.
 * This is the correct pattern for Server Components with hover effects.
 */
function FeatureCard({ icon, title, subtitle, description, href, accent }: Feature) {
  const isRune = accent === "rune"

  return (
    <a
      href={href}
      className={[
        "group relative flex flex-col rounded-sm border bg-forge-900 p-6",
        "transition-colors duration-200 hover:bg-forge-800",
        isRune
          ? "border-rune/15 hover:border-rune/50"
          : "border-ember/15 hover:border-ember/40",
      ].join(" ")}
    >
      {/* Icon badge */}
      <div
        className={[
          "mb-4 inline-flex size-11 items-center justify-center rounded-sm text-xl",
          isRune ? "bg-rune/10 text-rune" : "bg-ember/10 text-ember",
        ].join(" ")}
      >
        {icon}
      </div>

      {/* Title */}
      <h3 className="font-display text-lg font-semibold text-parchment">{title}</h3>

      {/* Subtitle */}
      <p
        className={[
          "mt-0.5 font-ui text-xs uppercase tracking-wider opacity-75",
          isRune ? "text-rune" : "text-ember",
        ].join(" ")}
      >
        {subtitle}
      </p>

      {/* Description */}
      <p className="mt-3 font-body text-sm leading-relaxed text-parchment-muted">
        {description}
      </p>

      {/* "Explore →" — hidden until hover, revealed by group-hover (pure CSS) */}
      <span
        className={[
          "mt-4 font-ui text-xs uppercase tracking-wider",
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          isRune ? "text-rune" : "text-ember",
        ].join(" ")}
      >
        Explore →
      </span>
    </a>
  )
}
