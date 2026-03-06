/**
 * /items/[slug] — Item Detail Page
 *
 * Server Component. ISR every 6h.
 *
 * Design: in-game tooltip aesthetic — dark parchment background, coloured
 * borders matching item rarity, stat lines as white/gold text.
 *
 * SEO strategy:
 * - generateMetadata pulls real item name + description → rich Google snippets
 * - generateStaticParams pre-builds the 2550 most important pages at deploy time
 *   (Vercel will ISR the rest on first hit)
 *
 * WHY generateStaticParams only for uniques:
 * - Uniques are the pages players search by name ("Andvarius ring", "Mageblood belt")
 * - Base types are less commonly searched by exact name
 * - This keeps build time under 2 minutes; ISR handles the long tail
 */

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import Image from "next/image"
import { db, eq } from "@wraexcodex/db"
import { items } from "@wraexcodex/db/schema"
import { resolveIconUrl } from "@/lib/item-icon"

export const revalidate = 21600

// ── Static params ──────────────────────────────────────────────────────────
//
// WHY we return [] here (empty):
// Returning an empty array tells Next.js "no pages pre-built at deploy time".
// All item pages are generated on first request (ISR — revalidate: 21600).
//
// WHY not pre-build at deploy time:
// - The DB connection at build time hits Supabase's transaction pooler which
//   requires a persistent session — it rejects connections during `next build`.
// - 2,550 pages × ~10ms each = 25 seconds of build time just for DB fetches.
// - ISR gives us the same result: sub-100ms HTML on first hit, then cached.
//
// In future, we could pre-build the top ~100 uniques (highest traffic) by
// hardcoding their slugs in a seed list, avoiding any DB call at build time.
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
  const item = await getItem(slug)

  if (!item) {
    return { title: "Item Not Found — Wraex Codex" }
  }

  return {
    title: `${item.name} — ${item.category} — Wraex Codex`,
    description: item.metaDescription ?? `${item.name} in Path of Exile 2. Stats, drop locations, and trade prices.`,
    openGraph: {
      title: `${item.name} — PoE2`,
      description: item.metaDescription ?? undefined,
      images: item.iconUrl ? [{ url: item.iconUrl, width: 64, height: 64 }] : [],
    },
  }
}

// ── Data fetching ──────────────────────────────────────────────────────────

async function getItem(slug: string) {
  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.slug, slug))
    .limit(1)
  return item ?? null
}

// ── Constants ──────────────────────────────────────────────────────────────

type RarityStyle = { border: string; title: string; bg: string; badge: string }

const RARITY_STYLES = {
  unique: {
    border: "border-[#af6025]",
    title:  "text-[#af6025]",
    bg:     "bg-[#0d0700]",
    badge:  "border-[#af6025]/40 bg-[#af6025]/10 text-[#af6025]",
  },
  currency: {
    border: "border-[#7d6a47]",
    title:  "text-[#aa9e82]",
    bg:     "bg-forge-950",
    badge:  "border-[#7d6a47]/40 bg-[#7d6a47]/10 text-[#aa9e82]",
  },
  gem: {
    border: "border-[#1ba29b]",
    title:  "text-[#1ba29b]",
    bg:     "bg-forge-950",
    badge:  "border-[#1ba29b]/40 bg-[#1ba29b]/10 text-[#1ba29b]",
  },
  rare: {
    border: "border-[#888800]",
    title:  "text-[#ffff77]",
    bg:     "bg-forge-950",
    badge:  "border-[#888800]/40 bg-[#888800]/10 text-[#ffff77]",
  },
  magic: {
    border: "border-[#5555cc]",
    title:  "text-[#8888ff]",
    bg:     "bg-forge-950",
    badge:  "border-[#5555cc]/40 bg-[#5555cc]/10 text-[#8888ff]",
  },
  normal: {
    border: "border-border-strong",
    title:  "text-parchment",
    bg:     "bg-forge-950",
    badge:  "border-border-strong bg-forge-800/60 text-parchment-muted",
  },
}

const CATEGORY_LABELS: Record<string, string> = {
  weapon:          "Weapon",
  armour:          "Armour",
  accessory:       "Accessory",
  flask:           "Flask",
  gem:             "Skill Gem",
  currency:        "Currency",
  map:             "Map",
  fragment:        "Fragment",
  divination_card: "Divination Card",
  misc:            "Miscellaneous",
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const item = await getItem(slug)

  if (!item) notFound()

  const styles: RarityStyle = (RARITY_STYLES as Record<string, RarityStyle>)[item.rarity] ?? RARITY_STYLES.normal
  const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category
  const rarityLabel = item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)

  return (
    <div className="min-h-screen">

      {/* ── Breadcrumb / header bar ── */}
      <div className="border-b border-border-subtle bg-forge-900/60 px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <nav className="flex items-center gap-2 font-ui text-xs text-parchment-muted">
            <Link href="/"     className="hover:text-parchment transition-colors">Home</Link>
            <span className="opacity-40">/</span>
            <Link href="/items" className="hover:text-parchment transition-colors">Items</Link>
            <span className="opacity-40">/</span>
            <Link
              href={`/items?category=${item.category}`}
              className="hover:text-parchment transition-colors"
            >
              {categoryLabel}
            </Link>
            <span className="opacity-40">/</span>
            <span className={styles.title}>{item.name}</span>
          </nav>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8 lg:flex-row">

          {/* ── Left: Tooltip card ── */}
          <div className="lg:w-80 xl:w-96 shrink-0">
            {/* Tooltip — mimics in-game item hover */}
            <div className={`rounded-sm border-2 ${styles.border} ${styles.bg} overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]`}>

              {/* Header band */}
              <div className={`border-b ${styles.border} px-5 py-4 text-center`}>
                {/* Icon */}
                {resolveIconUrl(item.iconUrl) ? (
                  <div className="mb-3 flex justify-center">
                    <Image
                      src={resolveIconUrl(item.iconUrl)!}
                      alt={item.name}
                      width={64}
                      height={64}
                      className="h-16 w-16 object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="mb-3 flex justify-center">
                    <div className={`h-16 w-16 rounded-sm border ${styles.border} flex items-center justify-center text-3xl`}>
                      {CATEGORY_ICONS[item.category] ?? "📦"}
                    </div>
                  </div>
                )}

                {/* Item name */}
                <h1 className={`font-display text-xl font-bold leading-tight ${styles.title}`}>
                  {item.name}
                </h1>

                {/* Base type (uniques) */}
                {item.baseType && (
                  <p className="mt-1 font-body text-sm text-parchment-muted">
                    {item.baseType}
                  </p>
                )}

                {/* Rarity + category badges */}
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <span className={`rounded-sm border px-2 py-0.5 font-ui text-[10px] uppercase tracking-wider ${styles.badge}`}>
                    {rarityLabel}
                  </span>
                  <span className="rounded-sm border border-border-subtle bg-forge-800/60 px-2 py-0.5 font-ui text-[10px] uppercase tracking-wider text-parchment-muted">
                    {categoryLabel}
                  </span>
                </div>
              </div>

              {/* Stats body */}
              <div className="px-5 py-4 space-y-1">
                {/* Stats from JSONB — empty for now, will be filled by enrichment job */}
                {item.stats && Object.keys(item.stats).length > 0 ? (
                  Object.entries(item.stats).map(([key, val]) => (
                    <StatLine key={key} label={formatStatKey(key)} value={String(val)} />
                  ))
                ) : (
                  <p className="font-body text-xs text-parchment-muted opacity-50 italic">
                    Detailed stats coming soon — check back after the next sync.
                  </p>
                )}

                {/* Implicits */}
                {item.implicits && item.implicits.length > 0 && (
                  <>
                    <div className="my-2 border-t border-border-subtle opacity-30" />
                    {item.implicits.map((mod, i) => (
                      <p key={i} className="font-body text-xs text-[#8888ff]">{mod.text}</p>
                    ))}
                  </>
                )}

                {/* Explicits */}
                {item.explicits && item.explicits.length > 0 && (
                  <>
                    <div className="my-2 border-t border-border-subtle opacity-30" />
                    {item.explicits.map((mod, i) => (
                      <p key={i} className="font-body text-xs text-[#8888ff]">{mod.text}</p>
                    ))}
                  </>
                )}

                {/* Flavour text */}
                {item.flavourText && (
                  <>
                    <div className="my-2 border-t border-border-subtle opacity-30" />
                    <p className="font-body text-xs italic text-[#af6025] leading-relaxed">
                      {item.flavourText}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Trade button — affiliate opportunity */}
            <a
              href={`https://www.pathofexile.com/trade2/search/poe2/Standard?q=${encodeURIComponent(item.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-ember bg-ember/10 font-ui text-sm font-semibold uppercase tracking-wider text-ember transition-colors hover:bg-ember/20"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 2H2v12h12V9M10 2h4v4M14 2 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Trade on PoE.com
            </a>
          </div>

          {/* ── Right: Details ── */}
          <div className="flex-1 space-y-6">

            {/* Meta description */}
            {item.metaDescription && (
              <p className="font-body text-parchment-muted leading-relaxed">
                {item.metaDescription}
              </p>
            )}

            {/* Quick facts grid */}
            <div>
              <h2 className="mb-4 font-display text-lg font-bold text-parchment">Item Details</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <DetailCell label="Category"    value={categoryLabel} />
                <DetailCell label="Rarity"      value={rarityLabel} />
                <DetailCell label="Drop Enabled" value={item.dropEnabled ? "Yes" : "No"} />
                {item.dropLevelMin != null && (
                  <DetailCell label="Min Drop Level" value={String(item.dropLevelMin)} />
                )}
                {item.dropLevelMax != null && (
                  <DetailCell label="Max Drop Level" value={String(item.dropLevelMax)} />
                )}
                {item.width != null && item.height != null && (
                  <DetailCell label="Inventory Size" value={`${item.width}×${item.height}`} />
                )}
              </div>
            </div>

            {/* Lore / flavour text (larger version) */}
            {item.loreText && (
              <div className="rounded-sm border border-border-subtle bg-forge-900/60 p-5">
                <h2 className="mb-3 font-display text-base font-bold text-parchment">Lore</h2>
                <p className="font-body text-sm italic leading-relaxed text-[#af6025]">
                  {item.loreText}
                </p>
              </div>
            )}

            {/* Price placeholder — will be populated by poe.ninja sync */}
            <div className="rounded-sm border border-border-subtle bg-forge-900/60 p-5">
              <h2 className="mb-1 font-display text-base font-bold text-parchment">
                Market Price
              </h2>
              <p className="font-body text-xs text-parchment-muted">
                Live poe.ninja prices coming in Week 2. For now, check{" "}
                <a
                  href={`https://poe.ninja/economy/poe2/standard`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ember hover:text-ember-light underline underline-offset-2"
                >
                  poe.ninja
                </a>
                {" "}directly.
              </p>
            </div>

            {/* Drop areas (if populated) */}
            {item.dropAreas && item.dropAreas.length > 0 && (
              <div>
                <h2 className="mb-4 font-display text-lg font-bold text-parchment">Drop Locations</h2>
                <div className="flex flex-wrap gap-2">
                  {item.dropAreas.map((area) => (
                    <span
                      key={area}
                      className="rounded-sm border border-border-subtle bg-forge-800/60 px-3 py-1.5 font-ui text-xs text-parchment-muted"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Micro-components ───────────────────────────────────────────────────────

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 font-body text-xs">
      <span className="text-parchment-muted">{label}</span>
      <span className="text-parchment font-medium">{value}</span>
    </div>
  )
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border-subtle bg-forge-900/60 px-4 py-3">
      <p className="font-ui text-[10px] uppercase tracking-wider text-parchment-muted opacity-60">{label}</p>
      <p className="mt-1 font-ui text-sm font-medium text-parchment">{value}</p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  weapon:          "⚔️",
  armour:          "🛡️",
  accessory:       "💎",
  flask:           "🧪",
  gem:             "💠",
  currency:        "🪙",
  map:             "🗺️",
  fragment:        "🔷",
  divination_card: "🃏",
  misc:            "📦",
}

function formatStatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
