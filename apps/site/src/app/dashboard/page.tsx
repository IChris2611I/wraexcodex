/**
 * /dashboard — User dashboard
 *
 * Protected route — Clerk middleware redirects to /sign-in if not authenticated.
 *
 * v1 scope: simple welcome page with links to key actions.
 * Later: saved builds, price watchlist, Oracle history.
 */

import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard — Wraex Codex",
  robots: { index: false, follow: false },
}

export default async function DashboardPage() {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const displayName = user.firstName ?? user.username ?? user.emailAddresses[0]?.emailAddress ?? "Exile"

  return (
    <div className="min-h-screen px-4 py-16 md:px-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-10">
          <p className="font-ui text-xs uppercase tracking-widest text-ember opacity-70">Dashboard</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-parchment md:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-2 font-body text-parchment-muted">
            Your Wraeclast Codex command centre.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashCard
            href="/builds/submit"
            icon="⚒️"
            title="Submit a Build"
            desc="Share your Path of Exile 2 build with the community."
            cta="Create Build"
          />
          <DashCard
            href="/oracle"
            icon="🔮"
            title="Ask the Oracle"
            desc="AI-powered build advisor — describe your playstyle, get a build."
            cta="Open Oracle"
            accent="rune"
          />
          <DashCard
            href="/nexus"
            icon="🌐"
            title="Explore the Nexus"
            desc="Interactive 3D passive skill tree for Path of Exile 2."
            cta="Open Nexus"
          />
          <DashCard
            href="/items"
            icon="⚔️"
            title="Item Database"
            desc="Browse 2550+ items with live prices and trade links."
            cta="Browse Items"
          />
          <DashCard
            href="/skills"
            icon="⚡"
            title="Skill Gems"
            desc="All 732 skill and support gems with stats."
            cta="Browse Skills"
          />
          <DashCard
            href="/builds"
            icon="📖"
            title="Build Guides"
            desc="Community build guides for every class and playstyle."
            cta="Browse Builds"
          />
        </div>

        {/* Coming soon notice */}
        <div className="mt-10 rounded-sm border border-border-subtle bg-forge-900/60 p-5">
          <p className="font-ui text-xs uppercase tracking-widest text-ember opacity-70">Coming soon</p>
          <p className="mt-2 font-body text-sm text-parchment-muted leading-relaxed">
            Saved builds, price watchlist, Oracle conversation history, and Pro features are on the roadmap.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── DashCard ───────────────────────────────────────────────────────────────

function DashCard({
  href, icon, title, desc, cta, accent = "ember",
}: {
  href: string
  icon: string
  title: string
  desc: string
  cta: string
  accent?: "ember" | "rune"
}) {
  const accentClass = accent === "rune" ? "text-rune border-rune/40 hover:bg-rune/10" : "text-ember border-ember/40 hover:bg-ember/10"
  return (
    <div className="flex flex-col rounded-sm border border-border-subtle bg-forge-card p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card">
      <span className="mb-3 text-3xl">{icon}</span>
      <h2 className="font-display text-base font-bold text-parchment">{title}</h2>
      <p className="mt-1 flex-1 font-body text-xs leading-relaxed text-parchment-muted">{desc}</p>
      <Link
        href={href}
        className={`mt-4 inline-flex h-8 items-center justify-center rounded-sm border px-4 font-ui text-xs font-semibold uppercase tracking-wider transition-colors ${accentClass}`}
      >
        {cta}
      </Link>
    </div>
  )
}
