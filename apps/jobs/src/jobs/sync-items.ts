import { db } from "@wraexcodex/db/client"
import { items } from "@wraexcodex/db/schema"
import { z } from "zod"

/**
 * Item Sync — GGG Trade API v2
 *
 * Endpoint: https://www.pathofexile.com/api/trade2/data/items
 * Returns: 9 categories, 2550 base types + unique items
 *
 * Entry shapes:
 *   Base type:   { type: "Gold Amulet" }
 *   Unique item: { type: "Gold Ring", name: "Andvarius", text: "Andvarius Gold Ring", flags: { unique: true } }
 *
 * WHY two-pass approach:
 *   Some unique items share the same display name across different base types
 *   (e.g. "The Surrender" as both a shield and a chest). A naive single-pass
 *   would hit the slug UNIQUE constraint on the second occurrence.
 *
 *   Pass 1: collect every (slug → [poeId, ...]) mapping across all entries
 *   Pass 2: for entries whose slug has >1 claimant, append the category id as
 *           a suffix so each gets a distinct, stable slug.
 *
 * Category → our itemCategoryEnum mapping defined below.
 */

const EntrySchema = z.object({
  type: z.string(),
  name: z.string().optional(),
  text: z.string().optional(),
  flags: z
    .object({
      unique: z.boolean().optional(),
      prophecy: z.boolean().optional(),
    })
    .optional(),
})

const CategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  entries: z.array(EntrySchema),
})

const ApiResponseSchema = z.object({
  result: z.array(CategorySchema),
})

// Map GGG category IDs to our DB enum values
const CATEGORY_MAP: Record<
  string,
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
> = {
  weapon: "weapon",
  armour: "armour",
  accessory: "accessory",
  flask: "flask",
  gem: "gem",
  currency: "currency",
  map: "map",
  fragment: "fragment",
  card: "divination_card",
  // catch-all
  monster: "misc",
  leaguestone: "misc",
}

function toSlug(name: string, suffix?: string): string {
  const base = name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return suffix ? `${base}-${suffix}` : base
}

// Generate a stable poeId from category + type + optional name
function toPoeId(categoryId: string, type: string, name?: string): string {
  const base = name ? `${categoryId}:${name}:${type}` : `${categoryId}:${type}`
  return base.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_:]/g, "")
}

// Intermediate record used in both passes
type ItemRecord = {
  poeId: string
  baseSlug: string // slug without any suffix
  categorySuffixedSlug: string // slug with category suffix (used when baseSlug collides)
  displayName: string
  baseType: string | null
  isUnique: boolean
  category: (typeof CATEGORY_MAP)[keyof typeof CATEGORY_MAP]
  categoryId: string
  categoryLabel: string
  metaDescription: string
}

export async function syncItems(): Promise<void> {
  console.log("[sync-items] Fetching from GGG Trade API v2...")

  const res = await fetch("https://www.pathofexile.com/api/trade2/data/items", {
    headers: {
      "User-Agent": "WraexCodex/1.0 (contact@wraexcodex.com)",
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    throw new Error(`GGG API returned ${res.status}: ${res.statusText}`)
  }

  const rawData: unknown = await res.json()
  const parsed = ApiResponseSchema.safeParse(rawData)

  if (!parsed.success) {
    console.error("[sync-items] Schema mismatch:", parsed.error.format())
    throw new Error("GGG API response did not match expected schema")
  }

  // ── Pass 1: build full record list + slug frequency maps ─────────────────
  // We need two levels of collision detection:
  //   Level 1 — baseSlug: same display name across ANY category
  //             → resolved by appending categoryId
  //   Level 2 — categorySuffixedSlug: same display name + categoryId
  //             (same unique exists in multiple base types within a category)
  //             → resolved by appending the base type slug
  const records: ItemRecord[] = []
  const baseSlugCount = new Map<string, number>()
  const catSlugCount = new Map<string, number>()

  for (const category of parsed.data.result) {
    const dbCategory = CATEGORY_MAP[category.id] ?? "misc"

    for (const entry of category.entries) {
      const displayName = entry.name ?? entry.type
      const isUnique = entry.flags?.unique === true
      const baseSlug = toSlug(displayName)

      if (!baseSlug) continue // skip purely-symbol names

      const poeId = toPoeId(category.id, entry.type, entry.name)
      const categorySuffixedSlug = toSlug(displayName, category.id)

      records.push({
        poeId,
        baseSlug,
        categorySuffixedSlug,
        displayName,
        baseType: entry.name ? entry.type : null,
        isUnique,
        category: dbCategory,
        categoryId: category.id,
        categoryLabel: category.label,
        metaDescription: `${displayName} — Path of Exile 2 ${category.label}. Stats, drop locations, and current trade value.`,
      })

      baseSlugCount.set(baseSlug, (baseSlugCount.get(baseSlug) ?? 0) + 1)
      catSlugCount.set(categorySuffixedSlug, (catSlugCount.get(categorySuffixedSlug) ?? 0) + 1)
    }
  }

  const baseCollisions = [...baseSlugCount.values()].filter((n) => n > 1).length
  const catCollisions = [...catSlugCount.values()].filter((n) => n > 1).length
  console.log(
    `[sync-items] ${records.length} entries collected. ` +
      `${baseCollisions} base-slug collisions, ${catCollisions} category-slug collisions.`
  )

  // ── Pass 2: upsert with collision-aware slugs ────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  let upsertCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const record of records) {
    // Three-level slug resolution:
    //   1. baseSlug alone if globally unique
    //   2. categorySuffixedSlug if only the base was a collision
    //   3. baseType suffix appended if even the category-slug collides
    //      (same unique name exists in multiple base types in same category)
    let slug: string
    if ((baseSlugCount.get(record.baseSlug) ?? 1) === 1) {
      slug = record.baseSlug
    } else if ((catSlugCount.get(record.categorySuffixedSlug) ?? 1) === 1) {
      slug = record.categorySuffixedSlug
    } else {
      // Append both category AND base type to guarantee uniqueness
      const baseTypePart = record.baseType ? toSlug(record.baseType) : toSlug(record.displayName)
      slug = `${record.categorySuffixedSlug}-${baseTypePart}`
    }

    if (!slug) {
      skipCount++
      continue
    }

    const rarity = record.isUnique
      ? "unique"
      : record.category === "currency"
        ? "currency"
        : record.category === "gem"
          ? "gem"
          : "normal"

    try {
      await db
        .insert(items)
        .values({
          poeId: record.poeId,
          slug,
          name: record.displayName,
          baseType: record.baseType,
          rarity,
          category: record.category,
          dataVersion: today,
          metaDescription: record.metaDescription,
        })
        .onConflictDoUpdate({
          target: items.poeId,
          set: {
            // Re-apply slug in case it changed due to collision logic
            slug,
            name: record.displayName,
            baseType: record.baseType,
            dataVersion: today,
            updatedAt: new Date(),
          },
        })

      upsertCount++
    } catch (err) {
      errorCount++
      console.error(`[sync-items] Failed: ${record.displayName} (${slug})`, err)
    }
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  const countResult = await db.execute(
    // Raw SQL — Drizzle's count helper requires an import we don't need to add
    // for a one-off verification query. ts-expect-error suppresses the overload warning.
    // @ts-expect-error raw SQL
    `SELECT COUNT(*)::int AS count FROM items`
  )

  const dbTotal = (countResult as unknown as Array<{ count: number }>)[0]?.count ?? "?"

  console.log(`\n[sync-items] ✓ Done`)
  console.log(`  Collected: ${records.length}`)
  console.log(`  Upserted:  ${upsertCount}`)
  console.log(`  Skipped:   ${skipCount}`)
  console.log(`  Errors:    ${errorCount}`)
  console.log(`  DB total:  ${dbTotal} items`)
}
