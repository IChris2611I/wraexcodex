/**
 * sync-skills — populates the skills table from poe.ninja
 *
 * Source: poe.ninja itemoverview?type=SkillGem
 * Data: gem name, icon, chaos value, level data, tags, description
 *
 * WHY poe.ninja and not GGG directly:
 * GGG has no public skill stats API. poe.ninja aggregates gem data including
 * per-level stats, quality effects, and prices in one endpoint. It's the
 * canonical community source for this data.
 *
 * Slug strategy: same as items — kebab-case name, suffix on collision.
 * e.g. "Fireball" → "fireball", "Fireball II" → "fireball-ii"
 */

import { db } from "@wraexcodex/db/client"
import { skills } from "@wraexcodex/db/schema"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

// WHY "Mercenaries": current active PoE2 league. "Standard" returns PoE1 data.
const CURRENT_LEAGUE = process.env.CURRENT_LEAGUE ?? "Mercenaries"

// ── poe.ninja response schema ──────────────────────────────────────────────

const GemSchema = z.object({
  id: z.number(),
  name: z.string(),
  icon: z.string().optional(),
  gemLevel: z.number().optional(),
  gemQuality: z.number().optional(),
  corrupted: z.boolean().optional(),
  chaosValue: z.number().optional(),
  listingCount: z.number().optional(),
  // Gem details
  variant: z.string().optional(),
  // Tags come as part of the item type description
  itemType: z.string().optional(),
  // Description from ninja
  explicitModifiers: z.array(z.object({
    text: z.string(),
    optional: z.boolean().optional(),
  })).optional(),
})

const ResponseSchema = z.object({
  lines: z.array(GemSchema),
})

// ── Helpers ────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// Infer isSupport from gem name — support gems always end with "Support"
function inferIsSupport(name: string): boolean {
  return name.endsWith(" Support") || name.includes(" Support ")
}

// Map poe.ninja icon URL — they use poecdn format
function normalizeIconUrl(url: string | undefined): string | null {
  if (!url) return null
  // poe.ninja returns full URLs already
  return url
}

// ── Main job ───────────────────────────────────────────────────────────────

export async function syncSkills(): Promise<void> {
  console.log(`[sync-skills] Syncing skills for league: ${CURRENT_LEAGUE}`)

  const url = `https://poe.ninja/api/data/itemoverview?league=${encodeURIComponent(CURRENT_LEAGUE)}&type=SkillGem&game=poe2`

  const res = await fetch(url, {
    headers: { "User-Agent": "WraexCodex/1.0 (contact@wraexcodex.com)" },
  })

  if (!res.ok) {
    console.error(`[sync-skills] poe.ninja returned ${res.status}`)
    return
  }

  const raw: unknown = await res.json()
  const parsed = ResponseSchema.safeParse(raw)

  if (!parsed.success) {
    console.error("[sync-skills] Validation failed:", parsed.error.flatten())
    return
  }

  const gems = parsed.data.lines
  console.log(`[sync-skills] ${gems.length} gems from poe.ninja`)

  // Deduplicate by name — poe.ninja returns the same gem at different levels/qualities.
  // We keep the base entry (level 1, quality 0, uncorrupted) as the canonical record.
  // WHY deduplicate: we want one page per gem, not one per level variant.
  const seen = new Map<string, typeof gems[0]>()
  for (const gem of gems) {
    const existing = seen.get(gem.name)
    if (!existing) {
      seen.set(gem.name, gem)
      continue
    }
    // Prefer uncorrupted, lower level, lower quality — that's the "base" gem
    const existingLevel = existing.gemLevel ?? 99
    const gemLevel = gem.gemLevel ?? 99
    const existingCorrupted = existing.corrupted ?? false
    const gemCorrupted = gem.corrupted ?? false
    if (gemCorrupted && !existingCorrupted) continue
    if (!gemCorrupted && existingCorrupted) { seen.set(gem.name, gem); continue }
    if (gemLevel < existingLevel) seen.set(gem.name, gem)
  }

  const uniqueGems = Array.from(seen.values())
  console.log(`[sync-skills] ${uniqueGems.length} unique gems after dedup`)

  // Build slugs with collision resolution
  const slugCounts = new Map<string, number>()
  const slugged = uniqueGems.map((gem) => {
    const base = toSlug(gem.name)
    const count = slugCounts.get(base) ?? 0
    slugCounts.set(base, count + 1)
    const slug = count === 0 ? base : `${base}-${count}`
    return { gem, slug }
  })

  // Upsert in batches of 100
  const BATCH = 100
  let upserted = 0

  for (let i = 0; i < slugged.length; i += BATCH) {
    const batch = slugged.slice(i, i + BATCH)

    await db
      .insert(skills)
      .values(
        batch.map(({ gem, slug }) => ({
          poeId: String(gem.id),
          slug,
          name: gem.name,
          isSupport: inferIsSupport(gem.name),
          isActive: !inferIsSupport(gem.name),
          iconUrl: normalizeIconUrl(gem.icon),
          description: gem.explicitModifiers?.map((m) => m.text).join("\n") ?? null,
          tags: [],
          levelData: [],
          qualityStats: [],
          updatedAt: new Date(),
        }))
      )
      // WHY conflict on slug (not poeId):
      // poe.ninja gem IDs differ between leagues (Mercenaries vs Standard).
      // Slug is our stable canonical identity — it's derived from the gem name
      // and won't change across leagues. This makes the sync idempotent regardless
      // of which league we're pulling from.
      .onConflictDoUpdate({
        target: skills.slug,
        set: {
          poeId: sql`excluded.poe_id`,
          name: sql`excluded.name`,
          iconUrl: sql`excluded.icon_url`,
          description: sql`excluded.description`,
          isSupport: sql`excluded.is_support`,
          isActive: sql`excluded.is_active`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    upserted += batch.length
    console.log(`[sync-skills] ${upserted}/${slugged.length} upserted`)
  }

  console.log(`[sync-skills] Done. ${slugged.length} skills in DB.`)
}
