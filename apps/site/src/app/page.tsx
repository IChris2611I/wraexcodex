/**
 * Homepage v2 — Wraex Codex
 *
 * Server Component. Zero client JS.
 * Sections:
 * 1. Hero          — atmospheric, title, tagline, search, CTAs
 * 2. Stats strip   — live numbers (DB counts, static for now)
 * 3. Features      — 4 pillar cards
 * 4. "Why" section — differentiators vs existing sites
 * 5. CTA band      — Discord + newsletter
 */

import Link from "next/link"
import { SearchButton } from "@/components/SearchButton"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">

      {/* ═══════════════════════════════════════════════ HERO ══ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">

        {/* Background layers — stacked for depth */}
        {/* Layer 1: base radial from top */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, #1a0d00 0%, #08080f 50%, #050508 100%)",
          }}
          aria-hidden
        />
        {/* Layer 2: ember glow below title */}
        <div
          className="pointer-events-none absolute left-1/2 top-[35%] h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(230,126,34,0.07) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
          aria-hidden
        />
        {/* Layer 3: subtle grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
          aria-hidden
        />

        {/* Content */}
        <div className="relative z-10 flex max-w-4xl flex-col items-center">

          {/* League badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-sm border border-ember/20 bg-ember/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-ember-pulse rounded-full bg-ember" />
            <span className="font-ui text-xs font-medium uppercase tracking-[0.25em] text-ember">
              Path of Exile 2 · Early Access
            </span>
          </div>

          {/* Main title */}
          <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight text-parchment sm:text-6xl md:text-7xl lg:text-8xl">
            The Wraeclast
            <br />
            <span className="text-gradient-ember">Codex</span>
          </h1>

          {/* Tagline */}
          <p className="mt-6 max-w-2xl font-body text-lg leading-relaxed text-parchment-muted md:text-xl">
            Items. Builds. Skills. Passives. Economy. AI-powered advice.
            <br className="hidden md:block" />
            Everything you need to master Path of Exile 2 — in one place.
          </p>

          {/* Search bar — Client Component island */}
          <div className="mt-10 w-full max-w-2xl">
            <SearchButton />
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/builds"
              className="inline-flex h-12 items-center gap-2 rounded-sm border border-ember bg-ember px-8 font-ui text-sm font-semibold uppercase tracking-wider text-forge-950 shadow-ember transition-all duration-150 hover:bg-ember-light hover:shadow-ember-lg"
            >
              Browse Builds
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link
              href="/items"
              className="inline-flex h-12 items-center rounded-sm border border-border-strong px-8 font-ui text-sm font-semibold uppercase tracking-wider text-parchment-muted transition-all duration-150 hover:border-parchment hover:text-parchment"
            >
              Item Database
            </Link>
            <Link
              href="/oracle"
              className="inline-flex h-12 items-center gap-2 rounded-sm border border-rune/30 bg-rune/5 px-8 font-ui text-sm font-semibold uppercase tracking-wider text-rune transition-all duration-150 hover:border-rune/60 hover:bg-rune/10"
            >
              <span>Ask the Oracle</span>
              <span className="rounded-sm bg-rune/15 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider">AI</span>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-3 opacity-30">
          <span className="font-ui text-[9px] uppercase tracking-[0.3em] text-parchment-muted">Scroll</span>
          <div className="h-8 w-px bg-gradient-to-b from-parchment-muted to-transparent" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════ STATS BAR ══ */}
      <div className="border-y border-border-subtle bg-forge-900/60">
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-border-subtle md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center py-6 px-4">
              <span className="font-display text-2xl font-bold text-ember md:text-3xl">
                {stat.value}
              </span>
              <span className="mt-1 font-ui text-xs uppercase tracking-wider text-parchment-muted">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════ FEATURES ══ */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24 md:px-6">

        <div className="mb-14 text-center">
          <p className="font-ui text-xs uppercase tracking-[0.3em] text-ember opacity-70">
            Four Pillars
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-parchment md:text-4xl">
            Everything You Need. Nothing You Don&apos;t.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-body text-parchment-muted">
            Built by players, for players. Every feature designed around how the PoE2 community actually plays.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════ WHY ══ */}
      <section className="border-t border-border-subtle bg-forge-900/40">
        <div className="mx-auto max-w-7xl px-4 py-24 md:px-6">

          <div className="mb-14 text-center">
            <p className="font-ui text-xs uppercase tracking-[0.3em] text-ember opacity-70">
              A New Era
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-parchment md:text-4xl">
              Not Another Wiki
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-body text-parchment-muted">
              Most PoE reference sites were built in 2014 and never evolved. Wraex Codex is built for 2026.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {WHY_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-sm border border-border-subtle bg-forge-800/50 p-6"
              >
                <div className="mb-4 text-2xl">{item.icon}</div>
                <h3 className="font-display text-base font-semibold text-parchment">{item.title}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-parchment-muted">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════ DISCORD CTA ══ */}
      <section className="mx-auto w-full max-w-4xl px-4 py-20 md:px-6">
        <div className="relative overflow-hidden rounded-sm border border-ember/20 bg-forge-900 p-10 text-center shadow-card">
          {/* Background glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(230,126,34,0.12) 0%, transparent 60%)" }}
            aria-hidden
          />
          <div className="relative z-10">
            <p className="font-ui text-xs uppercase tracking-[0.3em] text-ember opacity-70">
              Join the Community
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-parchment md:text-4xl">
              The Herald Awaits
            </h2>
            <p className="mx-auto mt-4 max-w-lg font-body text-parchment-muted">
              Add the Wraex Codex Discord bot to your server. Item lookups, build finder, price checks, and AI advice — all from Discord.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://discord.gg/wraexcodex"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2.5 rounded-sm border border-ember bg-ember px-7 font-ui text-sm font-semibold uppercase tracking-wider text-forge-950 transition-all duration-150 hover:bg-ember-light hover:shadow-ember"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Join Discord
              </a>
              <Link
                href="/roadmap"
                className="inline-flex h-11 items-center rounded-sm border border-border-strong px-7 font-ui text-sm font-semibold uppercase tracking-wider text-parchment-muted transition-all duration-150 hover:border-parchment hover:text-parchment"
              >
                View Roadmap
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}

/* ── Data ─────────────────────────────────────────────────────── */

const STATS = [
  { value: "10,000+", label: "Items" },
  { value: "500+",    label: "Builds" },
  { value: "1,500+",  label: "Passive Nodes" },
  { value: "<50ms",   label: "Search Speed" },
] as const

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
    description: "Every item, skill, boss, and passive. Full stats, drop sources, in-game tooltips, and live poe.ninja prices.",
    href: "/items",
    accent: "ember",
  },
  {
    icon: "⚒️",
    title: "The Forge",
    subtitle: "Build System",
    description: "Community guides, gear planners, DPS calculators, budget filters. Find the perfect build for your playstyle.",
    href: "/builds",
    accent: "ember",
  },
  {
    icon: "🌐",
    title: "The Nexus",
    subtitle: "Interactive Passive Tree",
    description: "Full PoE2 passive tree in your browser. Zoom, pan, allocate nodes, paste build codes, share URLs instantly.",
    href: "/nexus",
    accent: "rune",
  },
  {
    icon: "🔮",
    title: "The Oracle",
    subtitle: "AI Build Advisor",
    description: "Describe what you want in plain language. The Oracle reads every build, every patch note, and answers like an expert.",
    href: "/oracle",
    accent: "rune",
  },
]

const WHY_ITEMS = [
  {
    icon: "⚡",
    title: "Native-app Speed",
    description: "Instant search under 50ms. Every item page statically generated. Sub-second loads from any country via CDN edge.",
  },
  {
    icon: "🧠",
    title: "AI That Actually Knows PoE2",
    description: "The Oracle has read every build guide, every patch note, and has access to live price data. It reasons, not just retrieves.",
  },
  {
    icon: "🌐",
    title: "The Nexus — In Your Browser",
    description: "Path of Building is powerful but desktop-only and ugly. The Nexus is beautiful, instant, and shareable with one link.",
  },
  {
    icon: "💰",
    title: "Live Economy",
    description: "Real-time poe.ninja prices on every item page. Price history charts. Trend indicators. Never overpay again.",
  },
  {
    icon: "🎨",
    title: "Built Like a Game",
    description: "Dark forge aesthetic. Pixel-perfect item tooltips. Atmospheric animations. This feels like part of the game, not a spreadsheet.",
  },
  {
    icon: "🤖",
    title: "Discord Bot in Every Server",
    description: "/item, /build, /price, /oracle — all directly in Discord. Add once, your entire server benefits.",
  },
] as const

/* ── Components ───────────────────────────────────────────────── */

function FeatureCard({ icon, title, subtitle, description, href, accent }: Feature) {
  const isRune = accent === "rune"

  return (
    <Link
      href={href}
      className={[
        "group relative flex flex-col overflow-hidden rounded-sm border p-6",
        "bg-forge-card shadow-card transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-card-hover",
        isRune
          ? "border-rune/15 hover:border-rune/40"
          : "border-ember/15 hover:border-ember/35",
      ].join(" ")}
    >
      {/* Corner glow on hover */}
      <div
        className={[
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          isRune ? "bg-rune/20" : "bg-ember/20",
        ].join(" ")}
        aria-hidden
      />

      {/* Icon */}
      <div
        className={[
          "mb-5 inline-flex h-12 w-12 items-center justify-center rounded-sm text-2xl",
          isRune ? "bg-rune/8 ring-1 ring-rune/15" : "bg-ember/8 ring-1 ring-ember/15",
        ].join(" ")}
      >
        {icon}
      </div>

      {/* Title */}
      <h3 className="font-display text-xl font-bold text-parchment">{title}</h3>

      {/* Subtitle */}
      <p className={[
        "mt-1 font-ui text-xs uppercase tracking-wider opacity-75",
        isRune ? "text-rune" : "text-ember",
      ].join(" ")}>
        {subtitle}
      </p>

      {/* Description */}
      <p className="mt-3 flex-1 font-body text-sm leading-relaxed text-parchment-muted">
        {description}
      </p>

      {/* CTA */}
      <div className={[
        "mt-5 flex items-center gap-1.5 font-ui text-xs font-semibold uppercase tracking-wider",
        "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
        isRune ? "text-rune" : "text-ember",
      ].join(" ")}>
        Explore
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  )
}
