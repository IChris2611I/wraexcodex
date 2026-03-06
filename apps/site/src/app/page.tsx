/**
 * Homepage — the first thing a player sees.
 *
 * This is a Server Component. It renders on the server with zero client JS
 * for the shell. The animated elements will be progressively enhanced with
 * client-side Framer Motion in Week 2.
 *
 * Structure:
 * 1. Hero — tagline, search bar, call to action
 * 2. Feature highlights — The Codex, The Forge, The Oracle, The Nexus
 * 3. Live economy strip — top 5 items by price (placeholder for now)
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-forge-gradient">
      {/* === HERO === */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
        {/* Background glow */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(230,126,34,0.08)_0%,transparent_60%)]"
          aria-hidden
        />

        {/* Eyebrow */}
        <p className="font-ui text-xs font-semibold uppercase tracking-[0.3em] text-ember opacity-80">
          Path of Exile 2 Reference
        </p>

        {/* Title */}
        <h1 className="mt-4 font-display text-5xl font-black leading-tight tracking-tight text-parchment md:text-7xl lg:text-8xl">
          Loot
          <span className="bg-ember-gradient bg-clip-text text-transparent">Reference</span>
        </h1>

        {/* Tagline */}
        <p className="mt-6 max-w-xl font-body text-lg text-parchment-muted md:text-xl">
          The knowledge of Wraeclast, forged into data.
        </p>

        {/* Search bar — placeholder, wired to Meilisearch in Week 2 */}
        <div className="mt-10 w-full max-w-xl">
          <div className="relative">
            <input
              type="search"
              placeholder="Search items, skills, builds, bosses..."
              className="w-full rounded-sm border border-parchment-dim bg-forge-900 px-5 py-4 font-body text-base text-parchment placeholder:text-parchment-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
              aria-label="Search LootReference"
            />
            <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-ui text-xs text-parchment-dim">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/builds"
            className="inline-flex h-10 items-center rounded-sm border border-ember bg-ember px-6 font-ui text-sm font-semibold tracking-wide text-forge-950 transition-all hover:bg-ember-light"
          >
            Browse Builds
          </a>
          <a
            href="/items"
            className="inline-flex h-10 items-center rounded-sm border border-parchment-dim px-6 font-ui text-sm font-semibold tracking-wide text-parchment-muted transition-all hover:border-parchment hover:text-parchment"
          >
            Item Database
          </a>
        </div>
      </section>

      {/* === FEATURES === */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <h2 className="text-center font-display text-3xl font-bold text-parchment">
          Everything You Need. Nothing You Don&apos;t.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>
    </main>
  )
}

type Feature = {
  icon: string
  title: string
  description: string
  href: string
  accent: "ember" | "rune"
}

const features: Feature[] = [
  {
    icon: "📖",
    title: "The Codex",
    description: "Every item, skill, boss, and passive. Full stats, drop locations, and pixel-perfect item tooltips.",
    href: "/items",
    accent: "ember",
  },
  {
    icon: "⚒️",
    title: "The Forge",
    description: "Build browser, community guides, gear planners, and budget calculators.",
    href: "/builds",
    accent: "ember",
  },
  {
    icon: "🔮",
    title: "The Oracle",
    description: "AI-powered build advisor. Describe what you want — get a full expert recommendation.",
    href: "/oracle",
    accent: "rune",
  },
  {
    icon: "🌐",
    title: "The Nexus",
    description: "Full interactive passive tree. Zoom, pan, allocate nodes, import builds — in the browser.",
    href: "/nexus",
    accent: "rune",
  },
]

function FeatureCard({ icon, title, description, href, accent }: Feature) {
  const borderColor = accent === "rune" ? "border-rune/20 hover:border-rune/50" : "border-ember/20 hover:border-ember/40"
  const iconBg = accent === "rune" ? "bg-rune/10 text-rune" : "bg-ember/10 text-ember"

  return (
    <a
      href={href}
      className={`group block rounded-sm border ${borderColor} bg-forge-900 p-6 transition-all duration-200 hover:bg-forge-800`}
    >
      <div className={`mb-4 inline-flex size-10 items-center justify-center rounded-sm text-lg ${iconBg}`}>
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold text-parchment">{title}</h3>
      <p className="mt-2 font-body text-sm text-parchment-muted">{description}</p>
    </a>
  )
}
