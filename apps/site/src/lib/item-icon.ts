/**
 * Item icon URL resolution
 *
 * poecdn URLs (web.poecdn.com) → serve directly, they're public
 * poe2db URLs (cdn.poe2db.tw)  → proxy through /api/icon to add Referer header
 */
export function resolveIconUrl(iconUrl: string | null): string | null {
  if (!iconUrl) return null
  if (iconUrl.includes("cdn.poe2db.tw")) {
    return `/api/icon?url=${encodeURIComponent(iconUrl)}`
  }
  return iconUrl
}
