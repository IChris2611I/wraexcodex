/**
 * /skills/[slug] — Skill Gem Detail Page
 *
 * Server Component. ISR 6h.
 *
 * Design mirrors the item tooltip aesthetic — dark background with gem-colour
 * borders (blue for active, teal for support), description text as stat lines.
 *
 * SEO strategy:
 * - generateMetadata: real gem name + description for rich Google snippets
 * - "poe2 fireball gem", "spark skill build", "best support gems" → long-tail captures
 * - generateStaticParams returns [] — all 792 gem pages built on first request via ISR
 *
 * WHY no level data table yet:
 * poe.ninja SkillGem endpoint doesn't expose per-level stats directly.
 * The sync job stores them in levelData JSONB but the data is currently empty.
 * We render the section as an empty state with a clear "coming soon" message
 * rather than hiding it — this communicates the site is actively improving.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Image from "next/image"
import { db, eq } from "@wraexcodex/db"
import { skills } from "@wraexcodex/db/schema"
import type { SkillLevelData } from "@wraexcodex/db/schema"

export const revalidate = 21600

// ── Static params ──────────────────────────────────────────────────────────
// Empty → ISR on first request. Same rationale as /items/[slug].

export function generateStaticParams() {
  return []
}

// ── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const skill = await getSkill(slug)

  if (!skill) return { title: "Skill Not Found — Wraex Codex" }

  const gemType = skill.isSupport ? "Support Gem" : "Active Skill"
  const desc = skill.description
    ? `${skill.description.slice(0, 120)}...`
    : `${skill.name} ${gemType} in Path of Exile 2. Stats, level progression, and build synergies.`

  return {
    title: `${skill.name} — ${gemType} — Wraex Codex`,
    description: desc,
    openGraph: {
      title: `${skill.name} — PoE2 ${gemType}`,
      description: desc,
      images: skill.iconUrl ? [{ url: skill.iconUrl, width: 64, height: 64 }] : [],
    },
  }
}

// ── Data fetching ──────────────────────────────────────────────────────────

async function getSkill(slug: string) {
  const [skill] = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1)
  return skill ?? null
}

// ── Style constants ────────────────────────────────────────────────────────

// In-game gem colours: active = blue, support = teal
const ACTIVE_STYLE = {
  border:  "border-[#5555cc]",
  title:   "text-[#8888ff]",
  bg:      "bg-forge-950",
  badge:   "border-[#5555cc]/40 bg-[#5555cc]/10 text-[#8888ff]",
  glow:    "shadow-[0_0_40px_rgba(85,85,204,0.15)]",
  accent:  "#8888ff",
}

const SUPPORT_STYLE = {
  border:  "border-[#1ba29b]",
  title:   "text-[#1ba29b]",
  bg:      "bg-forge-950",
  badge:   "border-[#1ba29b]/40 bg-[#1ba29b]/10 text-[#1ba29b]",
  glow:    "shadow-[0_0_40px_rgba(27,162,155,0.15)]",
  accent:  "#1ba29b",
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const skill = await getSkill(slug)

  if (!skill) notFound()

  const style = skill.isSupport ? SUPPORT_STYLE : ACTIVE_STYLE
  const gemType = skill.isSupport ? "Support Gem" : "Active Skill"

  // Parse description lines — stored as newline-separated text from poe.ninja
  const descLines = skill.description
    ? skill.description.split("\n").filter(Boolean)
    : []

  const levelData = (skill.levelData ?? []) as SkillLevelData[]
  const hasLevelData = levelData.length > 0

  return (
    <div className="min-h-screen">

      {/* ── Breadcrumb / header bar ── */}
      <div className="border-b border-border-subtle bg-forge-900/60 px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <nav className="flex items-center gap-2 font-ui text-xs text-parchment-muted">
            <Link href="/"       className="hover:text-parchment transition-colors">Home</Link>
            <span className="opacity-40">/</span>
            <Link href="/skills" className="hover:text-parchment transition-colors">Skills</Link>
            <span className="opacity-40">/</span>
            {skill.isSupport ? (
              <Link href="/skills?type=support" className="hover:text-parchment transition-colors">
                Support Gems
              </Link>
            ) : (
              <Link href="/skills?type=active" className="hover:text-parchment transition-colors">
                Active Skills
              </Link>
            )}
            <span className="opacity-40">/</span>
            <span className={style.title}>{skill.name}</span>
          </nav>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8 lg:flex-row">

          {/* ── Left: Gem tooltip card ── */}
          <div className="lg:w-80 xl:w-96 shrink-0">
            {/* Tooltip — mirrors in-game gem hover */}
            <div className={`rounded-sm border-2 ${style.border} ${style.bg} overflow-hidden ${style.glow}`}>

              {/* Header band */}
              <div className={`border-b ${style.border} px-5 py-5 text-center`}>
                {/* Icon */}
                <div className="mb-4 flex justify-center">
                  {skill.iconUrl ? (
                    <div className="relative">
                      {/* Glow halo behind icon */}
                      <div
                        className="absolute inset-0 rounded-sm blur-md opacity-30"
                        style={{ backgroundColor: style.accent }}
                      />
                      <Image
                        src={skill.iconUrl}
                        alt={skill.name}
                        width={72}
                        height={72}
                        className="relative h-16 w-16 object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div
                      className={`h-16 w-16 rounded-sm border-2 ${style.border} flex items-center justify-center text-3xl`}
                    >
                      {skill.isSupport ? "🔗" : "⚡"}
                    </div>
                  )}
                </div>

                {/* Gem name */}
                <h1 className={`font-display text-xl font-bold leading-tight ${style.title}`}>
                  {skill.name}
                </h1>

                {/* Type badges */}
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <span className={`rounded-sm border px-2 py-0.5 font-ui text-[10px] uppercase tracking-wider ${style.badge}`}>
                    {gemType}
                  </span>
                </div>
              </div>

              {/* Description / stat lines */}
              <div className="px-5 py-4 space-y-2">
                {descLines.length > 0 ? (
                  descLines.map((line, i) => (
                    <p key={i} className={`font-body text-xs leading-relaxed ${style.title}`}>
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="font-body text-xs italic text-parchment-muted opacity-50">
                    Skill description unavailable.
                  </p>
                )}

                {/* Requirements */}
                {(skill.requiresLevel ?? 1) > 1 && (
                  <>
                    <div className="my-2 border-t border-border-subtle opacity-30" />
                    <div className="flex justify-between font-body text-xs">
                      <span className="text-parchment-muted">Requires Level</span>
                      <span className="text-parchment font-medium">{skill.requiresLevel}</span>
                    </div>
                  </>
                )}
                {skill.requiresStr && (
                  <div className="flex justify-between font-body text-xs">
                    <span className="text-parchment-muted">Requires Str</span>
                    <span className="text-[#c67c3c] font-medium">{skill.requiresStr}</span>
                  </div>
                )}
                {skill.requiresDex && (
                  <div className="flex justify-between font-body text-xs">
                    <span className="text-parchment-muted">Requires Dex</span>
                    <span className="text-[#5f9f3f] font-medium">{skill.requiresDex}</span>
                  </div>
                )}
                {skill.requiresInt && (
                  <div className="flex justify-between font-body text-xs">
                    <span className="text-parchment-muted">Requires Int</span>
                    <span className="text-[#4f7fbd] font-medium">{skill.requiresInt}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Trade link */}
            <a
              href={`https://www.pathofexile.com/trade2/search/poe2/Standard?q=${encodeURIComponent(skill.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-ember bg-ember/10 font-ui text-sm font-semibold uppercase tracking-wider text-ember transition-colors hover:bg-ember/20"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 2H2v12h12V9M10 2h4v4M14 2 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Trade on PoE.com
            </a>

            {/* poe.ninja link for price reference */}
            <a
              href={`https://poe.ninja/economy/poe2/standard/skill-gems?search=${encodeURIComponent(skill.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-border-subtle font-ui text-xs text-parchment-muted transition-colors hover:border-border-strong hover:text-parchment"
            >
              View pricing on poe.ninja
            </a>
          </div>

          {/* ── Right: Details ── */}
          <div className="flex-1 space-y-6">

            {/* Quick facts grid */}
            <div>
              <h2 className="mb-4 font-display text-lg font-bold text-parchment">Gem Details</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <DetailCell label="Type"     value={gemType} />
                <DetailCell label="Role"     value={skill.isSupport ? "Support" : "Active"} />
                {skill.requiresLevel ? (
                  <DetailCell label="Req. Level" value={String(skill.requiresLevel)} />
                ) : null}
                {skill.requiresStr ? (
                  <DetailCell label="Req. Str" value={String(skill.requiresStr)} />
                ) : null}
                {skill.requiresDex ? (
                  <DetailCell label="Req. Dex" value={String(skill.requiresDex)} />
                ) : null}
                {skill.requiresInt ? (
                  <DetailCell label="Req. Int" value={String(skill.requiresInt)} />
                ) : null}
              </div>
            </div>

            {/* Lore text */}
            {skill.loreText && (
              <div className="rounded-sm border border-border-subtle bg-forge-900/60 p-5">
                <h2 className="mb-3 font-display text-base font-bold text-parchment">Lore</h2>
                <p className="font-body text-sm italic leading-relaxed text-[#af6025]">
                  {skill.loreText}
                </p>
              </div>
            )}

            {/* Level progression table */}
            <div className="rounded-sm border border-border-subtle bg-forge-900/60 p-5">
              <h2 className="mb-4 font-display text-base font-bold text-parchment">
                Level Progression
              </h2>
              {hasLevelData ? (
                <LevelTable data={levelData} style={style} />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="font-body text-sm text-parchment-muted">
                    Per-level stats are being gathered and will appear here soon.
                  </p>
                  <p className="mt-1 font-body text-xs text-parchment-muted opacity-50">
                    Check{" "}
                    <a
                      href={`https://poe2db.tw/us/${encodeURIComponent(skill.name.replace(/ /g, "_"))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-parchment"
                    >
                      poe2db
                    </a>
                    {" "}for full level data in the meantime.
                  </p>
                </div>
              )}
            </div>

            {/* Support gem note */}
            {skill.isSupport && (
              <div className="rounded-sm border border-[#1ba29b]/20 bg-[#1ba29b]/5 p-5">
                <h2 className="mb-2 font-display text-base font-bold text-[#1ba29b]">
                  Support Gem
                </h2>
                <p className="font-body text-sm text-parchment-muted leading-relaxed">
                  Support gems modify the behaviour of linked active skills. They must be socketed
                  in the same item or linked through the passive tree to take effect.
                </p>
              </div>
            )}

            {/* Browse related */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/skills?type=${skill.isSupport ? "support" : "active"}`}
                className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 font-ui text-sm transition-colors ${style.badge} hover:bg-opacity-20`}
              >
                Browse all {skill.isSupport ? "Support Gems" : "Active Skills"} →
              </Link>
              <Link
                href="/skills"
                className="inline-flex items-center gap-2 rounded-sm border border-border-subtle px-4 py-2 font-ui text-sm text-parchment-muted transition-colors hover:border-border-strong hover:text-parchment"
              >
                All Skill Gems
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Level Table ────────────────────────────────────────────────────────────
//
// Renders per-level stat progression.
// WHY overflow-x-auto: stat tables can be wide on mobile — horizontal scroll
// is better than breaking the layout or truncating columns.

function LevelTable({
  data,
  style,
}: {
  data: SkillLevelData[]
  style: typeof ACTIVE_STYLE
}) {
  // Collect all stat keys across all levels for column headers
  const statKeys = Array.from(
    new Set(data.flatMap((d) => Object.keys(d.stats ?? {})))
  ).slice(0, 8) // cap at 8 stat columns to keep table readable

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-body text-xs">
        <thead>
          <tr className="border-b border-border-subtle">
            <th className="pb-2 pr-4 font-ui text-[10px] uppercase tracking-wider text-parchment-muted">
              Lvl
            </th>
            {data[0]?.manaCost != null && (
              <th className="pb-2 pr-4 font-ui text-[10px] uppercase tracking-wider text-parchment-muted">
                Mana
              </th>
            )}
            {data[0]?.manaMultiplier != null && (
              <th className="pb-2 pr-4 font-ui text-[10px] uppercase tracking-wider text-parchment-muted">
                Mana ×
              </th>
            )}
            {statKeys.map((k) => (
              <th
                key={k}
                className="pb-2 pr-4 font-ui text-[10px] uppercase tracking-wider text-parchment-muted"
              >
                {formatStatKey(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.level}
              className="border-b border-border-subtle/30 last:border-0 hover:bg-forge-800/30"
            >
              <td className={`py-1.5 pr-4 font-medium ${style.title}`}>{row.level}</td>
              {row.manaCost != null && (
                <td className="py-1.5 pr-4 text-parchment">{row.manaCost}</td>
              )}
              {row.manaMultiplier != null && (
                <td className="py-1.5 pr-4 text-parchment">{row.manaMultiplier}%</td>
              )}
              {statKeys.map((k) => (
                <td key={k} className="py-1.5 pr-4 text-parchment">
                  {row.stats?.[k] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Micro-components ───────────────────────────────────────────────────────

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border-subtle bg-forge-900/60 px-4 py-3">
      <p className="font-ui text-[10px] uppercase tracking-wider text-parchment-muted opacity-60">
        {label}
      </p>
      <p className="mt-1 font-ui text-sm font-medium text-parchment">{value}</p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatStatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
