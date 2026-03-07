/**
 * /builds — Build Guide Browser
 *
 * Server Component. ISR 6h.
 *
 * WHY build guides matter for SEO + revenue:
 * "ranger build poe2", "witch build guide", "best league starter poe2" are some
 * of the highest-volume PoE2 searches. Build pages = long session time = high RPM
 * for display ads + the most natural place for Pro upsell ("unlock advanced builds").
 *
 * Current state: DB is empty (no builds seeded yet). The page renders a compelling
 * empty state with a Submit CTA rather than hiding the route — this is important
 * for SEO (the route should exist and be indexable even when empty) and for signalling
 * to early visitors that the feature is coming.
 *
 * Filters:
 * - class: warrior | ranger | witch | sorceress | mercenary | monk
 * - difficulty: starter | intermediate | advanced
 * - isStarter: boolean flag
 *
 * Sort: score DESC (precomputed = upvotes − downvotes + views * 0.001)
 *
 * URL pattern: /builds?class=ranger&difficulty=starter&page=2
 */

import type { Metadata } from "next"
import Link from "next/link"
import { db, sql, eq, and } from "@wraexcodex/db"
import { builds, users } from "@wraexcodex/db/schema"
import type { SQL } from "@wraexcodex/db"
import type { Build } from "@wraexcodex/db"

export const revalidate = 21600

// ── Metadata ───────────────────────────────────────────────────────────────

export function generateMetadata(): Metadata {
  return {
    title: "Build Guides — Wraex Codex",
    description:
      "Path of Exile 2 build guides for every class. Warrior, Ranger, Witch, Sorceress, Mercenary, and Monk builds — starter to endgame.",
    openGraph: {
      title: "PoE2 Build Guides — Wraex Codex",
      description: "Expert build guides for Path of Exile 2. Find the best build for your playstyle.",
    },
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 24

const CLASSES = [
  { id: "warrior",   label: "Warrior",    icon: "⚔️",  color: "text-[#c67c3c]", border: "border-[#c67c3c]/30", activeBg: "bg-[#c67c3c]/10" },
  { id: "ranger",    label: "Ranger",     icon: "🏹",  color: "text-[#5f9f3f]", border: "border-[#5f9f3f]/30", activeBg: "bg-[#5f9f3f]/10" },
  { id: "witch",     label: "Witch",      icon: "🌑",  color: "text-[#9b6bc5]", border: "border-[#9b6bc5]/30", activeBg: "bg-[#9b6bc5]/10" },
  { id: "sorceress", label: "Sorceress",  icon: "❄️",  color: "text-[#4f9fbd]", border: "border-[#4f9fbd]/30", activeBg: "bg-[#4f9fbd]/10" },
  { id: "mercenary", label: "Mercenary",  icon: "🔫",  color: "text-[#aa9e82]", border: "border-[#aa9e82]/30", activeBg: "bg-[#aa9e82]/10" },
  { id: "monk",      label: "Monk",       icon: "🥋",  color: "text-[#1ba29b]", border: "border-[#1ba29b]/30", activeBg: "bg-[#1ba29b]/10" },
] as const

const DIFFICULTIES = [
  { id: "starter",      label: "Starter",      badge: "bg-green-900/40 text-green-400 border-green-800/40" },
  { id: "intermediate", label: "Intermediate", badge: "bg-yellow-900/40 text-yellow-400 border-yellow-800/40" },
  { id: "advanced",     label: "Advanced",     badge: "bg-red-900/40 text-red-400 border-red-800/40" },
] as const

type ValidClass = typeof CLASSES[number]["id"]
type ValidDifficulty = typeof DIFFICULTIES[number]["id"]

// ── Page ───────────────────────────────────────────────────────────────────

export default async function BuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; difficulty?: string; starter?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  const offset = (page - 1) * PAGE_SIZE

  const validClasses = CLASSES.map((c) => c.id) as string[]
  const validDiffs = DIFFICULTIES.map((d) => d.id) as string[]

  const activeClass = validClasses.includes(params.class ?? "") ? (params.class as ValidClass) : undefined
  const activeDiff = validDiffs.includes(params.difficulty ?? "") ? (params.difficulty as ValidDifficulty) : undefined
  const starterOnly = params.starter === "1"

  // Build WHERE conditions
  const conditions: SQL[] = [eq(builds.status, "published")]
  if (activeClass)   conditions.push(eq(builds.class, activeClass))
  if (activeDiff)    conditions.push(eq(builds.difficulty, activeDiff))
  if (starterOnly)   conditions.push(eq(builds.isStarter, true))
  const where = conditions.length === 1 ? conditions[0] : and(...conditions)

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:         builds.id,
        slug:       builds.slug,
        title:      builds.title,
        summary:    builds.summary,
        class:      builds.class,
        difficulty: builds.difficulty,
        tags:       builds.tags,
        budgetMin:  builds.budgetMin,
        budgetMax:  builds.budgetMax,
        isStarter:  builds.isStarter,
        isEndgame:  builds.isEndgame,
        isProVerified: builds.isProVerified,
        views:      builds.views,
        upvotes:    builds.upvotes,
        score:      builds.score,
        patchVersion: builds.patchVersion,
        updatedAt:  builds.updatedAt,
      })
      .from(builds)
      .where(where)
      .orderBy(sql`score DESC`)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(builds)
      .where(where),
  ])

  const total = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(overrides: { class?: string; difficulty?: string; starter?: string; page?: string }) {
    const p = new URLSearchParams()
    const merged = {
      class: activeClass,
      difficulty: activeDiff,
      starter: starterOnly ? "1" : undefined,
      page: String(page),
      ...overrides,
    }
    if (merged.class) p.set("class", merged.class)
    if (merged.difficulty) p.set("difficulty", merged.difficulty)
    if (merged.starter) p.set("starter", merged.starter)
    if (merged.page && merged.page !== "1") p.set("page", merged.page)
    return `/builds${p.toString() ? `?${p.toString()}` : ""}`
  }

  return (
    <div className="min-h-screen">

      {/* ── Header ── */}
      <div className="border-b border-border-subtle bg-forge-900/60 py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <nav className="mb-4 flex items-center gap-2 font-ui text-xs text-parchment-muted">
            <Link href="/" className="hover:text-parchment transition-colors">Home</Link>
            <span className="opacity-40">/</span>
            <span className="text-parchment">Builds</span>
          </nav>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-parchment md:text-4xl">
                Build Guides
              </h1>
              <p className="mt-2 font-body text-parchment-muted">
                {total > 0
                  ? `${total.toLocaleString()} community builds for Path of Exile 2`
                  : "Community build guides — coming soon"}
              </p>
            </div>
            {/* Submit CTA — drives community engagement */}
            <Link
              href="/builds/submit"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-sm border border-ember bg-ember/10 px-5 font-ui text-sm font-semibold uppercase tracking-wider text-ember transition-colors hover:bg-ember/20"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Submit Build
            </Link>
          </div>
        </div>
      </div>

      {/* ── Class filter strip ── */}
      <div className="border-b border-border-subtle bg-forge-950/80">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex items-center gap-0.5 overflow-x-auto py-2 scrollbar-none">
            <Link
              href={buildUrl({ class: undefined, page: "1" })}
              className={[
                "inline-flex shrink-0 items-center rounded-sm px-4 py-2 font-ui text-sm font-medium transition-colors",
                !activeClass ? "bg-ember/10 text-ember" : "text-parchment-muted hover:text-parchment",
              ].join(" ")}
            >
              All Classes
            </Link>
            {CLASSES.map((cls) => (
              <Link
                key={cls.id}
                href={buildUrl({ class: cls.id === activeClass ? undefined : cls.id, page: "1" })}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 font-ui text-sm transition-colors",
                  activeClass === cls.id
                    ? `${cls.activeBg} ${cls.color}`
                    : "text-parchment-muted hover:text-parchment",
                ].join(" ")}
              >
                <span>{cls.icon}</span>
                {cls.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="flex gap-8 lg:gap-12">

          {/* ── Sidebar ── */}
          <aside className="hidden w-52 shrink-0 lg:block">

            {/* Difficulty */}
            <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-[0.25em] text-ember opacity-70">
              Difficulty
            </p>
            <nav className="mb-6 flex flex-col gap-0.5">
              <Link
                href={buildUrl({ difficulty: undefined, page: "1" })}
                className={[
                  "flex items-center rounded-sm px-3 py-2 font-ui text-sm transition-colors",
                  !activeDiff ? "bg-ember/10 text-ember" : "text-parchment-muted hover:bg-forge-800/60 hover:text-parchment",
                ].join(" ")}
              >
                All Difficulties
              </Link>
              {DIFFICULTIES.map((d) => (
                <Link
                  key={d.id}
                  href={buildUrl({ difficulty: d.id === activeDiff ? undefined : d.id, page: "1" })}
                  className={[
                    "flex items-center gap-2 rounded-sm px-3 py-2 font-ui text-sm transition-colors",
                    activeDiff === d.id ? "bg-ember/10 text-ember" : "text-parchment-muted hover:bg-forge-800/60 hover:text-parchment",
                  ].join(" ")}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    d.id === "starter" ? "bg-green-400" : d.id === "intermediate" ? "bg-yellow-400" : "bg-red-400"
                  }`} />
                  {d.label}
                </Link>
              ))}
            </nav>

            {/* Special flags */}
            <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-[0.25em] text-ember opacity-70">
              Filter
            </p>
            <nav className="flex flex-col gap-0.5">
              <Link
                href={buildUrl({ starter: starterOnly ? undefined : "1", page: "1" })}
                className={[
                  "flex items-center gap-2 rounded-sm px-3 py-2 font-ui text-sm transition-colors",
                  starterOnly ? "bg-ember/10 text-ember" : "text-parchment-muted hover:bg-forge-800/60 hover:text-parchment",
                ].join(" ")}
              >
                <span className="text-green-400">★</span>
                League Starters
              </Link>
            </nav>
          </aside>

          {/* ── Main content ── */}
          <div className="min-w-0 flex-1">

            {/* Mobile filter pills */}
            <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
              {DIFFICULTIES.map((d) => (
                <Link
                  key={d.id}
                  href={buildUrl({ difficulty: d.id === activeDiff ? undefined : d.id, page: "1" })}
                  className={[
                    "inline-flex items-center gap-1 rounded-sm border px-3 py-1.5 font-ui text-xs transition-colors",
                    activeDiff === d.id
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-border-subtle text-parchment-muted hover:border-border-strong hover:text-parchment",
                  ].join(" ")}
                >
                  {d.label}
                </Link>
              ))}
              <Link
                href={buildUrl({ starter: starterOnly ? undefined : "1", page: "1" })}
                className={[
                  "inline-flex items-center gap-1 rounded-sm border px-3 py-1.5 font-ui text-xs transition-colors",
                  starterOnly
                    ? "border-ember bg-ember/10 text-ember"
                    : "border-border-subtle text-parchment-muted hover:border-border-strong hover:text-parchment",
                ].join(" ")}
              >
                ★ Starters
              </Link>
            </div>

            {/* Empty state */}
            {rows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((build) => (
                  <BuildCard key={build.id} build={build} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: String(page - 1) })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border-subtle px-4 font-ui text-sm text-parchment-muted hover:border-border-strong hover:text-parchment"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="font-ui text-sm text-parchment-muted">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={buildUrl({ page: String(page + 1) })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border-subtle px-4 font-ui text-sm text-parchment-muted hover:border-border-strong hover:text-parchment"
                  >
                    Next →
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────
//
// WHY a rich empty state (not just "no results"):
// - The page is indexed by Google immediately. Rich content = crawlable text.
// - Communicates value to first visitors before builds exist.
// - The class cards link back to /builds?class=X — keeps internal link graph intact.
// - Discord CTA captures the community early.

function EmptyState() {
  return (
    <div className="space-y-10">
      {/* Hero empty message */}
      <div className="rounded-sm border border-border-subtle bg-forge-900/60 p-8 text-center">
        <div className="mb-4 text-4xl">⚒️</div>
        <h2 className="font-display text-2xl font-bold text-parchment">
          Build Guides Coming Soon
        </h2>
        <p className="mx-auto mt-3 max-w-lg font-body text-parchment-muted leading-relaxed">
          We&apos;re building a curated library of expert Path of Exile 2 build guides. 
          Be among the first to submit your build and get featured.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/builds/submit"
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-ember bg-ember/10 px-6 font-ui text-sm font-semibold uppercase tracking-wider text-ember transition-colors hover:bg-ember/20"
          >
            Submit Your Build
          </Link>
          <a
            href="https://discord.gg/wraexcodex"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-border-strong px-6 font-ui text-sm text-parchment-muted transition-colors hover:border-parchment-muted hover:text-parchment"
          >
            Join Discord
          </a>
        </div>
      </div>

      {/* Class cards — always visible, link to filtered view */}
      <div>
        <h2 className="mb-4 font-display text-lg font-bold text-parchment">Browse by Class</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {CLASSES.map((cls) => (
            <Link
              key={cls.id}
              href={`/builds?class=${cls.id}`}
              className={[
                "flex flex-col items-center gap-2 rounded-sm border p-4 text-center transition-all duration-150",
                "border-border-subtle bg-forge-card hover:-translate-y-0.5 hover:shadow-card",
                `hover:${cls.border}`,
              ].join(" ")}
            >
              <span className="text-3xl">{cls.icon}</span>
              <span className={`font-ui text-xs font-medium ${cls.color}`}>{cls.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* What makes a good build guide — content for SEO */}
      <div className="rounded-sm border border-border-subtle bg-forge-900/60 p-6">
        <h2 className="mb-4 font-display text-base font-bold text-parchment">
          What to Expect from Wraex Codex Build Guides
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: "📊",
              title: "Patch-verified",
              desc: "Every build shows which patch it was last verified on. No outdated guides.",
            },
            {
              icon: "💰",
              title: "Budget breakdowns",
              desc: "League starter options and best-in-slot upgrades, priced in divine orbs.",
            },
            {
              icon: "🌿",
              title: "Skill tree included",
              desc: "Full passive tree export codes compatible with Path of Building.",
            },
          ].map((f) => (
            <div key={f.title} className="flex gap-3">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="font-ui text-sm font-semibold text-parchment">{f.title}</p>
                <p className="mt-0.5 font-body text-xs text-parchment-muted leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── BuildCard ──────────────────────────────────────────────────────────────

type BuildRow = Pick<Build,
  "id" | "slug" | "title" | "summary" | "class" | "difficulty" |
  "tags" | "budgetMin" | "budgetMax" | "isStarter" | "isEndgame" |
  "isProVerified" | "views" | "upvotes" | "score" | "patchVersion" | "updatedAt"
>

function BuildCard({ build }: { build: BuildRow }) {
  const cls = CLASSES.find((c) => c.id === build.class)
  const diff = DIFFICULTIES.find((d) => d.id === build.difficulty)

  return (
    <Link
      href={`/builds/${build.slug}`}
      className="group flex flex-col rounded-sm border border-border-subtle bg-forge-card p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card"
    >
      {/* Top: class + difficulty badges */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 font-ui text-xs font-medium ${cls?.color ?? "text-parchment-muted"}`}>
          {cls?.icon} {cls?.label ?? build.class}
        </span>
        <div className="flex items-center gap-1.5">
          {build.isStarter && (
            <span className="rounded-sm border border-green-800/40 bg-green-900/40 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider text-green-400">
              Starter
            </span>
          )}
          {build.isProVerified && (
            <span className="rounded-sm border border-[#e67e22]/40 bg-[#e67e22]/10 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider text-ember">
              Pro
            </span>
          )}
          {diff && (
            <span className={`rounded-sm border px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider ${diff.badge}`}>
              {diff.label}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display text-base font-bold leading-snug text-parchment group-hover:text-ember-light transition-colors">
        {build.title}
      </h3>

      {/* Summary */}
      <p className="mt-2 line-clamp-2 font-body text-xs leading-relaxed text-parchment-muted">
        {build.summary}
      </p>

      {/* Tags */}
      {build.tags && (build.tags as string[]).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {(build.tags as string[]).slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-sm border border-border-subtle bg-forge-800/40 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider text-parchment-dim"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: budget + stats */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="font-ui text-xs text-parchment-muted">
          {(build.budgetMin ?? 0) === 0 && (build.budgetMax ?? 0) === 0
            ? "Budget TBD"
            : `${build.budgetMin}–${build.budgetMax} div`}
        </span>
        <div className="flex items-center gap-3 font-ui text-xs text-parchment-muted">
          <span>{(build.views ?? 0).toLocaleString()} views</span>
          <span className="text-green-400">▲ {build.upvotes ?? 0}</span>
        </div>
      </div>
    </Link>
  )
}
