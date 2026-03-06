/**
 * Footer — Wraex Codex
 *
 * Server Component — static HTML, no interactivity needed.
 *
 * Structure:
 * - Brand column: logo, tagline, Discord link
 * - Four link columns: Codex, Builds, Tools, Meta
 * - Bottom bar: copyright, legal links, "Built for Wraeclast"
 */

import Link from "next/link"

const FOOTER_LINKS = {
  Codex: [
    { label: "Items",   href: "/items" },
    { label: "Skills",  href: "/skills" },
    { label: "Bosses",  href: "/bosses" },
    { label: "Passives",href: "/passives" },
    { label: "Economy", href: "/economy" },
  ],
  Builds: [
    { label: "Browse Builds",  href: "/builds" },
    { label: "Submit a Build", href: "/builds/new" },
    { label: "Starter Builds", href: "/builds?filter=starter" },
    { label: "Endgame Builds", href: "/builds?filter=endgame" },
    { label: "Tier List",      href: "/meta" },
  ],
  Tools: [
    { label: "The Nexus",    href: "/nexus",   badge: "NEW" },
    { label: "The Oracle",   href: "/oracle",  badge: "AI" },
    { label: "DPS Calc",     href: "/tools/dps" },
    { label: "Price Alerts", href: "/economy/alerts" },
    { label: "Discord Bot",  href: "/bot" },
  ],
  Meta: [
    { label: "About",    href: "/about" },
    { label: "Roadmap",  href: "/roadmap" },
    { label: "Discord",  href: "https://discord.gg/wraexcodex", external: true },
    { label: "GitHub",   href: "https://github.com/IChris2611I/wraexcodex", external: true },
    { label: "Feedback", href: "/feedback" },
  ],
} as const

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative mt-auto border-t border-border-subtle">

      {/* Top ember glow line */}
      <div className="divider-ember absolute top-0 inset-x-0" />

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">

          {/* ── Brand column ── */}
          <div className="lg:col-span-1">
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-ember/10">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M2 3L5.5 13L9 6L12.5 13L16 3" stroke="#e67e22" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5.5 13L9 15.5L12.5 13" stroke="#f39c12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
                </svg>
              </div>
              <span className="font-display text-sm font-bold text-parchment">
                Wraex <span className="text-gradient-ember">Codex</span>
              </span>
            </Link>

            <p className="mt-4 font-body text-sm leading-relaxed text-parchment-muted">
              The knowledge of Wraeclast, forged into data. The definitive Path of Exile 2 reference platform.
            </p>

            {/* Discord CTA */}
            <a
              href="https://discord.gg/wraexcodex"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-sm border border-border-default bg-surface-1 px-3 py-2 font-ui text-xs text-parchment-muted transition-colors duration-150 hover:border-border-strong hover:text-parchment"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Join the Discord
            </a>
          </div>

          {/* ── Link columns ── */}
          {(Object.entries(FOOTER_LINKS) as [string, readonly { label: string; href: string; badge?: string; external?: boolean }[]][]).map(([section, links]) => (
            <div key={section}>
              <h3 className="mb-4 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-parchment-dim">
                {section}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      target={"external" in link && link.external ? "_blank" : undefined}
                      rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-2 font-body text-sm text-parchment-muted transition-colors duration-150 hover:text-parchment"
                    >
                      {link.label}
                      {"badge" in link && link.badge && (
                        <span className={[
                          "rounded-sm px-1 py-0.5 font-ui text-[9px] uppercase tracking-wider",
                          link.badge === "AI"
                            ? "bg-rune/10 text-rune"
                            : "bg-ember/10 text-ember",
                        ].join(" ")}>
                          {link.badge}
                        </span>
                      )}
                      {"external" in link && link.external && (
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden className="opacity-40">
                          <path d="M6 3H3v10h10v-3M9 3h4m0 0v4m0-4L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border-subtle pt-8 md:flex-row">
          <p className="font-body text-xs text-parchment-dim">
            © {year} Wraex Codex. Not affiliated with Grinding Gear Games.
          </p>

          <p className="font-ui text-xs uppercase tracking-[0.2em] text-parchment-dim">
            Forged for Wraeclast
          </p>

          <div className="flex gap-4">
            {["Privacy", "Terms"].map((label) => (
              <Link
                key={label}
                href={`/${label.toLowerCase()}`}
                className="font-body text-xs text-parchment-dim transition-colors hover:text-parchment-muted"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
