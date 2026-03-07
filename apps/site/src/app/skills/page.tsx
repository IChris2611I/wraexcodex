/**
 * /skills — Skill Gem Database
 *
 * Server Component, ISR 6h.
 *
 * WHY this page matters for SEO:
 * Players search things like "spark gem poe2", "best support gems poe2",
 * "fireball skill". A dedicated /skills page with individual gem pages
 * captures long-tail search traffic that item pages don't.
 *
 * URL: /skills?type=active|support&page=2
 */

import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { db, eq, sql } from "@wraexcodex/db"
import { skills } from "@wraexcodex/db/schema"
import type { SQL } from "@wraexcodex/db"

export const revalidate = 21600

// ── Metadata ───────────────────────────────────────────────────────────────

export function generateMetadata(): Metadata {
  return {
    title: "Skill Gem Database — Wraex Codex",
    description:
      "Complete Path of Exile 2 skill gem database. Browse all active and support gems with stats, level progression, and build guides.",
    openGraph: {
      title: "PoE2 Skill Gems — Wraex Codex",
      description: "Every skill gem in Path of Exile 2. Stats, level data, and support compatibility.",
    },
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 48

const GEM_TYPES = [
  { id: "active",  label: "Active Skills",  icon: "⚡" },
  { id: "support", label: "Support Gems",   icon: "🔗" },
]

// ── Page ───────────────────────────────────────────────────────────────────

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  const offset = (page - 1) * PAGE_SIZE

  const validTypes = GEM_TYPES.map((t) => t.id)
  const activeType = validTypes.includes(params.type ?? "") ? params.type : undefined

  const conditions: SQL[] = []
  if (activeType === "active")  conditions.push(eq(skills.isSupport, false))
  if (activeType === "support") conditions.push(eq(skills.isSupport, true))
  const where = conditions.length ? conditions[0] : undefined

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:        skills.id,
        slug:      skills.slug,
        name:      skills.name,
        isSupport: skills.isSupport,
        iconUrl:   skills.iconUrl,
        description: skills.description,
      })
      .from(skills)
      .where(where)
      .orderBy(skills.name)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(skills)
      .where(where),
  ])

  const total = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(overrides: { type?: string; page?: string }) {
    const p = new URLSearchParams()
    const merged = { type: activeType, page: String(page), ...overrides }
    if (merged.type) p.set("type", merged.type)
    if (merged.page && merged.page !== "1") p.set("page", merged.page)
    return `/skills${p.toString() ? `?${p.toString()}` : ""}`
  }

  return (
    <div className="min-h-screen">

      {/* ── Header ── */}
      <div className="border-b border-border-subtle bg-forge-900/60 py-10 px-4">
        <div className="mx-auto max-w-7xl">
          <nav className="mb-4 flex items-center gap-2 font-ui text-xs text-parchment-muted">
            <Link href="/" className="hover:text-parchment transition-colors">Home</Link>
            <span className="opacity-40">/</span>
            <span className="text-parchment">Skills</span>
          </nav>
          <h1 className="font-display text-3xl font-bold text-parchment md:text-4xl">
            Skill Gem Database
          </h1>
          <p className="mt-2 font-body text-parchment-muted">
            {total.toLocaleString()} {activeType ? (activeType === "active" ? "active skills" : "support gems") : "skill gems"} in Path of Exile 2
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="flex gap-8 lg:gap-12">

          {/* ── Sidebar ── */}
          <aside className="hidden w-52 shrink-0 lg:block">
            <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-[0.25em] text-ember opacity-70">
              Gem Type
            </p>
            <nav className="flex flex-col gap-0.5">
              <Link
                href={buildUrl({ type: undefined, page: "1" })}
                className={[
                  "flex items-center rounded-sm px-3 py-2 font-ui text-sm transition-colors",
                  !activeType ? "bg-ember/10 text-ember" : "text-parchment-muted hover:bg-forge-800/60 hover:text-parchment",
                ].join(" ")}
              >
                All Gems
              </Link>
              {GEM_TYPES.map((t) => (
                <Link
                  key={t.id}
                  href={buildUrl({ type: t.id, page: "1" })}
                  className={[
                    "flex items-center gap-2 rounded-sm px-3 py-2 font-ui text-sm transition-colors",
                    activeType === t.id ? "bg-ember/10 text-ember" : "text-parchment-muted hover:bg-forge-800/60 hover:text-parchment",
                  ].join(" ")}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* ── Main ── */}
          <div className="min-w-0 flex-1">

            {/* Mobile filter pills */}
            <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
              {GEM_TYPES.map((t) => (
                <Link
                  key={t.id}
                  href={buildUrl({ type: t.id === activeType ? undefined : t.id, page: "1" })}
                  className={[
                    "inline-flex items-center gap-1 rounded-sm border px-3 py-1.5 font-ui text-xs transition-colors",
                    activeType === t.id
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-border-subtle text-parchment-muted hover:border-border-strong hover:text-parchment",
                  ].join(" ")}
                >
                  {t.icon} {t.label}
                </Link>
              ))}
            </div>

            {/* Empty state */}
            {rows.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <p className="font-display text-xl text-parchment-muted">No skills found</p>
                <p className="mt-2 font-body text-sm text-parchment-muted opacity-60">
                  Run <code className="rounded bg-forge-800 px-1.5 py-0.5 text-ember">bun run src/index.ts sync-skills</code> in apps/jobs
                </p>
                <Link href="/skills" className="mt-4 font-ui text-sm text-ember hover:text-ember-light underline underline-offset-2">
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {rows.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
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

            {rows.length > 0 && (
              <p className="mt-4 text-center font-ui text-xs text-parchment-muted opacity-50">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()} gems
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SkillCard ──────────────────────────────────────────────────────────────

type SkillRow = {
  id: string
  slug: string
  name: string
  isSupport: boolean
  iconUrl: string | null
  description: string | null
}

function SkillCard({ skill }: { skill: SkillRow }) {
  const accentColor = skill.isSupport ? "text-[#1ba29b]" : "text-[#8888ff]"
  const borderColor = skill.isSupport ? "hover:border-[#1ba29b]/30" : "hover:border-[#5555cc]/30"

  return (
    <Link
      href={`/skills/${skill.slug}`}
      className={`group flex flex-col items-center gap-2 rounded-sm border border-border-subtle bg-forge-card p-3 text-center transition-all duration-150 hover:-translate-y-0.5 ${borderColor} hover:shadow-card`}
    >
      {/* Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-forge-800/60 ring-1 ring-border-subtle group-hover:ring-[#5555cc]/20">
        {skill.iconUrl ? (
          <Image
            src={skill.iconUrl}
            alt={skill.name}
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
            unoptimized
          />
        ) : (
          <span className="text-2xl">{skill.isSupport ? "🔗" : "⚡"}</span>
        )}
      </div>

      {/* Name */}
      <p className={`font-ui text-xs font-medium leading-tight ${accentColor} line-clamp-2`}>
        {skill.name}
      </p>

      {/* Type badge */}
      <span className="rounded-sm border border-border-subtle bg-forge-800/40 px-1.5 py-0.5 font-ui text-[9px] uppercase tracking-wider text-parchment-dim">
        {skill.isSupport ? "Support" : "Active"}
      </span>
    </Link>
  )
}
