# Wraex Codex — Session Context

> **Paste this into every new Claude Code session** to restore full project context.

---

## Goal

Build **Wraex Codex** — the definitive Path of Exile 2 reference platform, a full SaaS product targeting real revenue (500-2000€/month by month 6) through affiliate links, display ads, and Pro subscriptions. The goal is to become THE go-to site for PoE2 players — combining item/skill/build database, AI-powered build advisor, interactive passive tree, live economy data, and a Discord bot.

## Instructions

- **Act as senior developer mentor** — don't just code, explain WHY every decision is made
- **Think beyond what's asked** — extrapolate, anticipate needs, propose features proactively
- **Name of the site/product**: Wraex Codex
- **Solo developer** (Chris), Windows machine, VS Code, Bun installed, 20h+/week
- **Stack**: Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4, Framer Motion, Drizzle ORM + Supabase (PostgreSQL), Bun runtime, Turborepo monorepo
- **Quality standard**: Production-grade from day one — speed, security, SEO, beautiful dark forge aesthetic
- **Supabase project**: `rvifkvvtqkpfmttcsany` (EU region)
- **GitHub repo**: `https://github.com/IChris2611I/wraexcodex`
- **Local path**: `C:\Users\chris\Desktop\Projects\wraexcodex`
- **Database credentials**:
  - Direct (for drizzle-kit + local dev): `postgresql://postgres:4B45BthawIUYNuep@db.rvifkvvtqkpfmttcsany.supabase.co:5432/postgres`
  - Pooler (for Vercel production only): `postgresql://postgres.rvifkvvtqkpfmttcsany:4B45BthawIUYNuep@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
- **Design**: Dark forge aesthetic — near-black backgrounds (`#050508`, `#08080f`), ember orange/gold accent (`#e67e22` → `#f39c12`), rune cyan for AI features (`#00d4ff`), parchment text (`#e8e0d0`). Fonts: Cinzel (display), Barlow Condensed (UI), Barlow (body)

## Critical Discoveries

- **MINGW64 path issue**: Claude Code's Bash tool workdir must use `/c/Users/chris/Desktop/Projects/wraexcodex`
- **DB connection**: Use **direct** (port 5432) for local dev — pooler (port 6543) returns "Tenant or user not found" with postgres.js
- **Tailwind v4**: Uses `@theme {}` block in CSS, not `tailwind.config.js`
- **Server Components**: No event handlers — use `"use client"` or Tailwind `group-hover:`
- **drizzle-orm version**: Do NOT `bun add drizzle-orm` in apps — import from `@wraexcodex/db` which re-exports `eq, and, sql, etc.` to avoid version mismatch
- **Clerk**: Wrapped in `MaybeClerkProvider` — site builds without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **poe2db hotlink protection**: `cdn.poe2db.tw` returns 403 without `Referer: https://poe2db.tw/`. Use `/api/icon?url=...` proxy route in site
- **poe.ninja rate limit**: 1 second delay between requests (their ToS)
- **DB client**: Lazy Proxy singleton in `packages/db/src/client.ts` — don't connect eagerly

## Data Sources

| Source | Endpoint | Data | Notes |
|--------|----------|------|-------|
| GGG Trade API | `pathofexile.com/api/trade2/data/items` | 2550 item names + categories | No icons, no stats |
| GGG Trade API | `pathofexile.com/api/trade2/data/leagues` | Active leagues | `Fate of the Vaal`, `Standard`, etc. |
| poe.ninja | `poe.ninja/api/data/currencyoverview?...&game=poe2` | Currency icons + prices | `currencyDetails[].icon` = poecdn URL |
| poe.ninja | `poe.ninja/api/data/itemoverview?...&type=UniqueWeapon&game=poe2` | Unique icons + mods + prices | All item types work except `UniqueMap` |
| poe2db | `poe2db.tw/data/passive-skill-tree/4.4/data_us.json` | 4976 passive nodes with x/y + icons | 1.6MB JSON, no auth needed |
| poe2db | `poe2db.tw/us/{Item_Name}` → `og:image` | Base type icons via scraping | CDN is `cdn.poe2db.tw/image/Art/...webp` |
| poecdn | `web.poecdn.com/gen/image/{base64}/...` | Item icons (public, no Referer needed) | 267 items from poe.ninja have these |

## What's Done ✅

### Monorepo & Infrastructure
- Turborepo monorepo: `apps/site`, `apps/bot`, `apps/jobs`, `packages/config`, `packages/db`, `packages/ui`
- Full DB schema pushed to Supabase: 7 tables (`items`, `skills`, `passives`, `bosses`, `builds`, `users`, `prices`), 9 enums, 30 indexes
- `packages/db`: lazy client, full Drizzle schema, re-exports drizzle helpers
- `packages/ui`: full Tailwind v4 design system, Button component, cn utility

### Data Jobs (`apps/jobs`)
- **`sync-items`**: 2550 items from GGG Trade API, three-level slug collision resolution, 0 errors
- **`sync-icons`**: 97% icon coverage (2481/2550) — poe.ninja for uniques/currency/gems, poe2db scraper for base types
- **`sync-passives`**: 4975 passive nodes from poe2db, batch insert (100/statement)
- **`sync-prices`**: structure ready, needs a first run to populate `prices` table

### Site (`apps/site`)
- Homepage v2: hero, stats strip, feature cards, "Not Another Wiki", Discord CTA
- Navbar: sticky, scroll-aware, mobile overlay
- Footer, CommandPalette (⌘K), PageTransition
- **`/items`**: browse page with category/rarity filters, 48/page grid, smart pagination, ISR 6h
- **`/items/[slug]`**: detail page with in-game tooltip aesthetic, rarity borders, trade link, ISR
- `/api/icon`: proxy route for poe2db images (adds Referer header)
- `src/lib/item-icon.ts`: `resolveIconUrl()` helper — routes poe2db URLs through proxy

### Bot (`apps/bot`)
- Discord.js structure with item/build/price/meta command placeholders

## What's Next ❌

**High priority (next session):**
1. **Run `sync-prices`** — populate the prices table, add price display to item detail page
2. **`/items/[slug]` enrichment** — show explicit mods, flavour text (already in DB from sync-icons), link to trade
3. **Clerk setup** — get publishable key from dashboard.clerk.com, enable auth
4. **Meilisearch** — index items for instant search, wire up CommandPalette

**Medium priority:**
5. **`/builds`** — browse page for build guides (DB table exists, needs seed data + page)
6. **The Nexus (`/nexus`)** — passive tree renderer using the 4975 nodes already in DB
7. **`sync-skills`** — populate skills table from poe.ninja SkillGem endpoint

**Low priority:**
8. **Passive tree API endpoint** — investigate GGG JS bundles for official tree JSON source
9. **next/font** — replace Google Fonts CDN with self-hosted for better performance
10. **Discord bot** — implement real slash commands against DB

## Repo Structure

```
wraexcodex/
├── CONTEXT.md                            ← This file
├── package.json                          ← Bun workspaces
├── turbo.json
├── packages/
│   ├── config/                           ← Shared TS/ESLint/Tailwind config
│   ├── db/
│   │   ├── src/client.ts                 ← Lazy DB singleton
│   │   ├── src/index.ts                  ← Re-exports drizzle helpers + types
│   │   └── src/schema/                   ← items, skills, passives, bosses, builds, users, prices
│   └── ui/
│       └── src/styles/globals.css        ← Full @theme design system
├── apps/
│   ├── site/
│   │   ├── .env.local                    ← DATABASE_URL=direct, Clerk=empty
│   │   ├── next.config.ts                ← remotePatterns: poecdn + poe2db
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx            ← MaybeClerkProvider + Navbar + Footer
│   │       │   ├── page.tsx              ← Homepage
│   │       │   ├── items/page.tsx        ← Browse (ISR 6h)
│   │       │   ├── items/[slug]/page.tsx ← Detail (ISR on-demand)
│   │       │   └── api/icon/route.ts     ← poe2db image proxy
│   │       ├── components/               ← Navbar, Footer, CommandPalette, SearchButton
│   │       └── lib/item-icon.ts          ← resolveIconUrl() helper
│   ├── bot/                              ← Discord.js (placeholder commands)
│   └── jobs/
│       └── src/jobs/
│           ├── sync-items.ts             ← GGG Trade API → items table
│           ├── sync-icons.ts             ← poe.ninja + poe2db → icon_url
│           ├── sync-passives.ts          ← poe2db tree JSON → passive_nodes
│           └── sync-prices.ts            ← poe.ninja → prices table (ready, not run)
```

## Running Locally

```bash
# Install
bun install

# Dev server (site only)
bun dev

# Run a job manually
cd apps/jobs && bun run src/index.ts sync-items
cd apps/jobs && bun run src/index.ts sync-icons
cd apps/jobs && bun run src/index.ts sync-passives
cd apps/jobs && bun run src/index.ts sync-prices

# DB push (schema changes)
cd packages/db && bun run db:push --force

# TypeCheck
cd apps/site && bun run tsc --noEmit
cd apps/jobs && bun run tsc --noEmit
```

## Git Log (recent)

```
707a5db feat: sync-icons + sync-passives (97% icon coverage)
0d0ead0 feat: item sync + browse/detail pages
931b6c2 feat: site shell — Navbar, Footer, CommandPalette, Homepage v2
```
