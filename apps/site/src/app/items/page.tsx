/**
 * /items — Item Database Browse Page
 *
 * Server Component — fully static-capable (ISR every 6 hours to reflect syncs).
 *
 * WHY ISR not SSG:
 * - Item data is updated by sync jobs, not at build time.
 * - ISR lets us serve cached HTML instantly and regenerate in background.
 * - revalidate: 21600 = 6 hours, matches the sync job cadence.
 *
 * URL structure: /items?category=weapon&rarity=unique&page=2
 * - All filters are search params → shareable URLs, no client state needed.
 * - Google can crawl every filter combination via sitemap.
 */

import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { db, eq, and, sql } from "@wraexcodex/db"
import { resolveIconUrl } from "@/lib/item-icon"
import type { SQL } from "@wraexcodex/db"
import { items } from "@wraexcodex/db/schema"

export const revalidate = 21600 // 6 hours

// ── Types ──────────────────────────────────────────────────────────────────

type Category =
  | "weapon"
  | "armour"
  | "accessory"
  | "flask"
  | "gem"
  | "currency"
  | "map"
  | "fragment"
  | "divination_card"
  | "misc"

type Rarity = "normal" | "unique" | "currency" | "gem"

type SearchParams = {
  category?: string
  rarity?: string
  page?: string
}

// ── Metadata ───────────────────────────────────────────────────────────────

export function generateMetadata(): Metadata {
  return {
    title: "Item Database — Wraex Codex",
    description:
      "Complete Path of Exile 2 item database. Browse 2,500+ base types and unique items by category. Stats, drop locations, and live trade prices.",
    openGraph: {
      title: "PoE2 Item Database — Wraex Codex",
      description: "Every item in Path of Exile 2. Searchable, filterable, with live prices.",
    },
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 48

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "weapon",        label: "Weapons",          icon: "⚔️" },
  { id: "armour",        label: "Armour",            icon: "🛡️" },
  { id: "accessory",     label: "Accessories",       icon: "💎" },
  { id: "flask",         label: "Flasks",            icon: "🧪" },
  { id: "gem",           label: "Gems",              icon: "💠" },
  { id: "currency",      label: "Currency",          icon: "🪙" },
  { id: "map",           label: "Maps",              icon: "🗺️" },
  { id: "fragment",      label: "Fragments",         icon: "🔷" },
  { id: "divination_card", label: "Divination Cards", icon: "🃏" },
  { id: "misc",          label: "Misc",              icon: "📦" },
]

const RARITIES: { id: Rarity; label: string }[] = [
  { id: "normal",   label: "Base Types" },
  { id: "unique",   label: "Uniques"    },
  { id: "currency", label: "Currency"   },
  { id: "gem",      label: "Gems"       },
]

const RARITY_COLORS: Record<string, string> = {
  unique:   "text-[#af6025]",
  currency: "text-[#aa9e82]",
  gem:      "text-[#1ba29b]",
  normal:   "text-parchment-muted",
  magic:    "text-[#8888ff]",
  rare:     "text-[#ffff77]",
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10))
  const offset = (page - 1) * PAGE_SIZE

  // Validate category/rarity params (don't trust URL input)
  const validCategories = CATEGORIES.map((c) => c.id) as string[]
  const validRarities = RARITIES.map((r) => r.id) as string[]
  const activeCategory = validCategories.includes(params.category ?? "")
    ? (params.category as Category)
    : undefined
  const activeRarity = validRarities.includes(params.rarity ?? "")
    ? (params.rarity as Rarity)
    : undefined

  // Build WHERE conditions
  const conditions: SQL[] = []
  if (activeCategory) conditions.push(eq(items.category, activeCategory))
  if (activeRarity)   conditions.push(eq(items.rarity,   activeRarity))
  const where = conditions.length ? and(...conditions) : undefined

  // Fetch page + total count in parallel.
  // WHY leftJoin on prices:
  // We want to show a chaos badge on item cards — but we can't do N+1 queries
  // (one per card). A single LEFT JOIN fetches prices for all 48 cards at once.
  // We take the most recent price per item via a DISTINCT ON subquery approach;
  // here we just order by recordedAt desc and rely on Postgres collapsing it via
  // the DISTINCT ON in the lateral — but for simplicity we just join and take
  // the first match (Drizzle ORM doesn't support DISTINCT ON directly, so we
  // use a lateral subquery via raw SQL alias).
  // Simpler: just LEFT JOIN and accept that duplicate prices are possible in edge
  // cases (same item priced in two leagues). We disambiguate by LIMIT 1.
  const [rows, countResult] = await Promise.all([
    db
      .select({
        id:         items.id,
        slug:       items.slug,
        name:       items.name,
        baseType:   items.baseType,
        rarity:     items.rarity,
        category:   items.category,
        iconUrl:    items.iconUrl,
        chaosValue: sql<number | null>`(
          SELECT p.chaos_value FROM prices p
          WHERE p.item_id = ${items.id}
          ORDER BY p.recorded_at DESC
          LIMIT 1
        )`,
      })
      .from(items)
      .where(where)
      .orderBy(items.name)
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(items)
      .where(where),
  ])

  const total = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Build query-param helpers
  function buildUrl(overrides: Partial<SearchParams>) {
    const p = new URLSearchParams()
    const merged = { category: activeCategory, rarity: activeRarity, page: String(page), ...overrides }
    if (merged.category) p.set("category", merged.category)
    if (merged.rarity)   p.set("rarity",   merged.rarity)
    if (merged.page && merged.page !== "1") p.set("page", merged.page)
    const qs = p.toString()
    return `/items${qs ? `?${qs}` : ""}`
  }

  const activeCategoryLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "All Items"

  return (
    <div className="min-h-screen">

      {/* ── Page header ── */}
      <div className="border-b border-border-subtle bg-forge-900/60 py-10 px-4">
        <div className="mx-auto max-w-7xl">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-2 font-ui text-xs text-parchment-muted">
            <Link href="/" className="hover:text-parchment transition-colors">Home</Link>
            <span className="opacity-40">/</span>
            <span className="text-parchment">Items</span>
          </nav>
          <h1 className="font-display text-3xl font-bold text-parchment md:text-4xl">
            Item Database
          </h1>
          <p className="mt-2 font-body text-parchment-muted">
            {total.toLocaleString()} {activeCategory ? activeCategoryLabel.toLowerCase() : "items"} in Path of Exile 2
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="flex gap-8 lg:gap-12">

          {/* ── Sidebar filters ── */}
          <aside className="hidden w-52 shrink-0 lg:block">
            {/* Category filter */}
            <div className="mb-8">
              <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-[0.25em] text-ember opacity-70">
                Category
              </p>
              <nav className="flex flex-col gap-0.5">
                <FilterLink
                  href={buildUrl({ category: undefined, page: "1" })}
                  active={!activeCategory}
                  label="All Items"
                  count={undefined}
                />
                {CATEGORIES.map((cat) => (
                  <FilterLink
                    key={cat.id}
                    href={buildUrl({ category: cat.id, page: "1" })}
                    active={activeCategory === cat.id}
                    label={`${cat.icon} ${cat.label}`}
                    count={undefined}
                  />
                ))}
              </nav>
            </div>

            {/* Rarity filter */}
            <div>
              <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-[0.25em] text-ember opacity-70">
                Rarity
              </p>
              <nav className="flex flex-col gap-0.5">
                <FilterLink
                  href={buildUrl({ rarity: undefined, page: "1" })}
                  active={!activeRarity}
                  label="All Rarities"
                  count={undefined}
                />
                {RARITIES.map((rar) => (
                  <FilterLink
                    key={rar.id}
                    href={buildUrl({ rarity: rar.id, page: "1" })}
                    active={activeRarity === rar.id}
                    label={rar.label}
                    count={undefined}
                  />
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Main grid ── */}
          <div className="min-w-0 flex-1">

            {/* Mobile filter pills */}
            <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  href={buildUrl({ category: cat.id === activeCategory ? undefined : cat.id, page: "1" })}
                  className={[
                    "inline-flex items-center gap-1 rounded-sm border px-3 py-1.5 font-ui text-xs transition-colors",
                    activeCategory === cat.id
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-border-subtle text-parchment-muted hover:border-border-strong hover:text-parchment",
                  ].join(" ")}
                >
                  {cat.icon} {cat.label}
                </Link>
              ))}
            </div>

            {/* Active filters bar */}
            {(activeCategory || activeRarity) && (
              <div className="mb-6 flex items-center gap-3">
                <span className="font-ui text-xs text-parchment-muted">Filtered by:</span>
                {activeCategory && (
                  <Link
                    href={buildUrl({ category: undefined, page: "1" })}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-ember/30 bg-ember/8 px-2.5 py-1 font-ui text-xs text-ember hover:bg-ember/15"
                  >
                    {CATEGORIES.find(c => c.id === activeCategory)?.label}
                    <span className="opacity-60">×</span>
                  </Link>
                )}
                {activeRarity && (
                  <Link
                    href={buildUrl({ rarity: undefined, page: "1" })}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-ember/30 bg-ember/8 px-2.5 py-1 font-ui text-xs text-ember hover:bg-ember/15"
                  >
                    {RARITIES.find(r => r.id === activeRarity)?.label}
                    <span className="opacity-60">×</span>
                  </Link>
                )}
                <Link href="/items" className="font-ui text-xs text-parchment-muted hover:text-parchment underline underline-offset-2">
                  Clear all
                </Link>
              </div>
            )}

            {/* Grid */}
            {rows.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <p className="font-display text-xl text-parchment-muted">No items found</p>
                <Link href="/items" className="mt-4 font-ui text-sm text-ember hover:text-ember-light underline underline-offset-2">
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {rows.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: String(page - 1) })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border-subtle px-4 font-ui text-sm text-parchment-muted hover:border-border-strong hover:text-parchment"
                  >
                    ← Prev
                  </Link>
                )}

                <div className="flex items-center gap-1">
                  {getPaginationRange(page, totalPages).map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-parchment-muted">…</span>
                    ) : (
                      <Link
                        key={p}
                        href={buildUrl({ page: String(p) })}
                        className={[
                          "inline-flex h-9 w-9 items-center justify-center rounded-sm border font-ui text-sm transition-colors",
                          p === page
                            ? "border-ember bg-ember/10 text-ember"
                            : "border-border-subtle text-parchment-muted hover:border-border-strong hover:text-parchment",
                        ].join(" ")}
                        aria-current={p === page ? "page" : undefined}
                      >
                        {p}
                      </Link>
                    )
                  )}
                </div>

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

            {/* Page info */}
            {rows.length > 0 && (
              <p className="mt-4 text-center font-ui text-xs text-parchment-muted opacity-50">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()} items
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

type ItemRow = {
  id: string
  slug: string
  name: string
  baseType: string | null
  rarity: string
  category: string
  iconUrl: string | null
  chaosValue: number | null
}

function ItemCard({ item }: { item: ItemRow }) {
  const nameColor = RARITY_COLORS[item.rarity] ?? "text-parchment"

  return (
    <Link
      href={`/items/${item.slug}`}
      className="group flex flex-col items-center gap-2 rounded-sm border border-border-subtle bg-forge-card p-3 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-ember/30 hover:shadow-card"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-forge-800/60 ring-1 ring-border-subtle group-hover:ring-ember/20">
        {resolveIconUrl(item.iconUrl) ? (
          <Image
            src={resolveIconUrl(item.iconUrl)!}
            alt={item.name}
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
            unoptimized
          />
        ) : (
          <ItemPlaceholderIcon category={item.category} />
        )}
      </div>

      {/* Name */}
      <p className={`font-ui text-xs font-medium leading-tight ${nameColor} line-clamp-2`}>
        {item.name}
      </p>

      {/* Base type (for uniques) */}
      {item.baseType && (
        <p className="font-ui text-[10px] text-parchment-muted opacity-60 line-clamp-1">
          {item.baseType}
        </p>
      )}

      {/* Chaos price badge — only shown when we have price data */}
      {item.chaosValue != null && (
        <span className="inline-flex items-center gap-0.5 rounded-sm border border-[#8b2252]/30 bg-[#1a0a1a]/60 px-1.5 py-0.5 font-ui text-[10px] text-parchment-muted">
          <span className="text-[#c45caa]">✦</span>
          {item.chaosValue >= 10
            ? Math.round(item.chaosValue).toLocaleString()
            : item.chaosValue.toFixed(1)}
          c
        </span>
      )}
    </Link>
  )
}

function ItemPlaceholderIcon({ category }: { category: string }) {
  const icons: Record<string, string> = {
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
  return <span className="text-2xl">{icons[category] ?? "📦"}</span>
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: string
  count: number | undefined
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center justify-between rounded-sm px-3 py-2 font-ui text-sm transition-colors",
        active
          ? "bg-ember/10 text-ember"
          : "text-parchment-muted hover:bg-forge-800/60 hover:text-parchment",
      ].join(" ")}
    >
      {label}
    </Link>
  )
}

// Generate smart pagination ranges: [1, 2, "...", 8, 9, 10] etc.
function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "...")[] = []
  const addPage = (p: number) => { if (!pages.includes(p)) pages.push(p) }
  const addEllipsis = () => {
    if (pages[pages.length - 1] !== "...") pages.push("...")
  }
  addPage(1)
  if (current > 3) addEllipsis()
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) addPage(p)
  if (current < total - 2) addEllipsis()
  addPage(total)
  return pages
}
