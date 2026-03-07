# Wraex Codex — Session Context

> **Paste this into every new Claude Code session** to restore full project context.

---

## Goal

Build **Wraex Codex** — the definitive Path of Exile 2 reference platform targeting real revenue (500-2000€/month by month 6) through affiliate links, display ads, and Pro subscriptions. The site is live at `wraexcodex.vercel.app`.

## Instructions

- **Act as senior developer mentor** — explain WHY every decision is made
- **Think beyond what's asked** — extrapolate, anticipate needs, propose features proactively
- **Name**: Wraex Codex
- **Solo developer** (Chris), Windows machine, VS Code, Bun installed, 20h+/week
- **Stack**: Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4, Framer Motion, Drizzle ORM + Supabase (PostgreSQL), Bun runtime, Turborepo monorepo
- **Quality standard**: Production-grade from day one — speed, security, SEO, beautiful dark forge aesthetic
- **Supabase project**: `rvifkvvtqkpfmttcsany` (EU region, Frankfurt)
- **GitHub repo**: `https://github.com/IChris2611I/wraexcodex`
- **Local path**: `C:\Users\chris\Desktop\Projects\wraexcodex`
- **DB credentials**:
  - Direct (local dev): `postgresql://postgres:4B45BthawIUYNuep@db.rvifkvvtqkpfmttcsany.supabase.co:5432/postgres`
  - Session pooler (Vercel): from Supabase → Settings → Database → Connection pooling
- **Design**: Dark forge aesthetic — near-black backgrounds (`#050508`, `#08080f`), ember orange/gold accent (`#e67e22` → `#f39c12`), rune cyan for AI features (`#00d4ff`), parchment text (`#e8e0d0`). Fonts: Cinzel (display), Barlow Condensed (UI), Barlow (body)

## Critical Discoveries

- **MINGW64 path issue**: Claude Code's Bash tool workdir must use `/c/Users/chris/Desktop/Projects/wraexcodex`
- **DB connection**: Use **direct** (port 5432) for local dev — pooler returns "Tenant or user not found" with postgres.js
- **Vercel DB connection**: Must use **session pooler** URL (not direct, not transaction pooler) — direct is IPv6-only, Vercel is IPv4
- **`prepare: false` required**: Supabase pooler (PgBouncer) doesn't support prepared statements
- **`max: 1`**: Serverless functions need max 1 connection per instance
- **Tailwind v4**: Uses `@theme {}` block in CSS, not `tailwind.config.js`
- **Server Components**: No event handlers — use `"use client"` or Tailwind `group-hover:`
- **drizzle-orm version**: Do NOT `bun add drizzle-orm` in apps — import from `@wraexcodex/db`
- **poe2db hotlink protection**: `cdn.poe2db.tw` returns 403 without `Referer: https://poe2db.tw/`. Use `/api/icon?url=...` proxy
- **`db.execute()` with postgres.js**: Returns rows directly as an array, NOT `{ rows: [...] }`. Cast with `as unknown as Type[]`
- **Vercel deployments**: Never manually redeploy old commits — always push to git and let auto-deploy trigger
- **pg_trgm indexes**: Run in Supabase SQL Editor WITHOUT `CONCURRENTLY` (can't run in transaction block)
- **poe.ninja SkillGem**: Returns gems at multiple levels/qualities — must deduplicate by name, keeping base entry
- **poe.ninja league**: `Standard` with `game=poe2` returns PoE1 items! Use `Mercenaries` (current PoE2 league). Set `CURRENT_LEAGUE=Mercenaries` in `apps/jobs/.env`
- **sync-prices N+1**: Old version did individual item lookups per gem — rewritten to batch IN() + batch INSERT (100x faster)
- **sync-skills slug conflict**: poe.ninja IDs differ per league — upsert on `slug` (not `poeId`) for idempotency
- **builds table authorId**: NOT NULL FK to users — cannot seed builds without a user row. Browse page shows rich empty state

## Data Sources

| Source | Endpoint | Data | Notes |
|--------|----------|------|-------|
| GGG Trade API | `pathofexile.com/api/trade2/data/items` | 2550 item names + categories | No icons, no stats |
| poe.ninja | `poe.ninja/api/data/itemoverview?league=Mercenaries&type=X&game=poe2` | Unique icons + prices | Use Mercenaries league for PoE2 data |
| poe.ninja | `poe.ninja/api/data/itemoverview?league=Mercenaries&type=SkillGem&game=poe2` | 732 gems | Deduplicate by name before insert |
| poe2db | `poe2db.tw/data/passive-skill-tree/4.4/data_us.json` | 4975 passive nodes | 1.6MB JSON |
| poe2db | `poe2db.tw/us/{Item_Name}` → `og:image` | Base type icons | CDN is `cdn.poe2db.tw/...` |
| poecdn | `web.poecdn.com/gen/image/...` | Item icons | Public, no Referer needed |

## What's Done ✅

### Infrastructure
- Turborepo monorepo: `apps/site`, `apps/bot`, `apps/jobs`, `packages/config`, `packages/db`, `packages/ui`
- Full DB schema: 7 tables, 9 enums, 30 indexes — live on Supabase
- **Live on Vercel**: `wraexcodex.vercel.app` — auto-deploys on push to main
- `vercel.json`, `turbo.json` configured

### Data Jobs
- **`sync-items`**: 2550 items from GGG Trade API ✅
- **`sync-icons`**: 97% icon coverage ✅
- **`sync-passives`**: 4975 passive nodes ✅
- **`sync-prices`**: 270 prices in DB (Mercenaries league) ✅ — batched, fast
- **`sync-skills`**: 732 gems in DB (Mercenaries) ✅ — upserts on slug

### Site
- Homepage, Navbar (Items + Skills + Builds + Nexus + Oracle links), Footer, PageTransition
- **`/items`**: browse with category/rarity filters, chaos price badges, ISR 6h
- **`/items/[slug]`**: tooltip aesthetic, rarity borders, full price panel (sparkline), trade link
- **`/skills`**: browse with active/support filter, ISR 6h
- **`/skills/[slug]`**: gem tooltip style, description, level table (empty state), trade link
- **`/builds`**: browse page with class strip + difficulty sidebar + rich empty state CTA ✅ NEW
- **`/api/search`**: pg_trgm UNION across items + skills, ranked results
- **`/api/icon`**: poe2db image proxy
- **`CommandPalette`**: ⌘K, debounced, keyboard nav, chaos badge, category badge

### Not started ❌
- `/builds/[slug]` detail page
- `/builds/submit` form (needs Clerk auth first)
- `/nexus` passive tree renderer
- Clerk auth
- Redis cache for search

## One-time setup required (Supabase SQL Editor)

Run these once to enable fast pg_trgm search — run each statement separately:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS items_name_trgm_idx ON items USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS items_base_type_trgm_idx ON items USING GIN (base_type gin_trgm_ops);
CREATE INDEX IF NOT EXISTS skills_name_trgm_idx ON skills USING GIN (name gin_trgm_ops);
```

## Repo Structure

```
wraexcodex/
├── CONTEXT.md
├── vercel.json                           ← Vercel monorepo config
├── turbo.json
├── packages/db/src/
│   ├── client.ts                         ← max:1, prepare:false, ssl:require
│   ├── index.ts                          ← re-exports + types
│   └── schema/                           ← items, skills, passives, bosses, builds, users, prices
├── apps/jobs/
│   ├── .env                              ← DATABASE_URL + CURRENT_LEAGUE=Mercenaries
│   └── src/jobs/
│       ├── sync-items.ts                 ← GGG → items (2550)
│       ├── sync-icons.ts                 ← poe.ninja + poe2db → icon_url
│       ├── sync-passives.ts              ← poe2db → passives (4975)
│       ├── sync-prices.ts                ← poe.ninja → prices (batched, 270 rows)
│       └── sync-skills.ts                ← poe.ninja SkillGem → skills (732)
└── apps/site/src/app/
    ├── page.tsx                          ← Homepage
    ├── items/page.tsx                    ← Browse (ISR 6h)
    ├── items/[slug]/page.tsx             ← Detail (price panel, sparkline)
    ├── skills/page.tsx                   ← Browse (ISR 6h)
    ├── skills/[slug]/page.tsx            ← Detail (gem tooltip)
    ├── builds/page.tsx                   ← Browse (rich empty state)
    └── api/
        ├── icon/route.ts                 ← poe2db proxy
        └── search/route.ts               ← pg_trgm UNION items+skills
```

## What's Next (priority order)

1. **Clerk auth setup** — needed before `/builds/submit` can work
2. **`/builds/submit`** — build submission form (Clerk auth gate)
3. **`/nexus`** — passive tree renderer (4975 nodes in DB, need canvas/SVG renderer)
4. **`/builds/[slug]`** — build detail page
5. **Performance**: Vercel region → `fra1`, Redis cache for `/api/search`

## Running Locally

```bash
bun install
bun dev

# Jobs (run from apps/jobs/)
bun run src/index.ts sync-items
bun run src/index.ts sync-skills
bun run src/index.ts sync-prices
bun run src/index.ts sync-icons
bun run src/index.ts sync-passives

# Typecheck
cd apps/site && bun run tsc --noEmit
cd apps/jobs && bun run tsc --noEmit
```
