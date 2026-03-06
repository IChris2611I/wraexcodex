/**
 * ID generation utility.
 *
 * WHY not auto-increment integers:
 * - Monorepo with multiple services — two services inserting rows simultaneously
 *   with auto-increment IDs will collide if they ever share a table.
 * - Auto-increment exposes record count (security anti-pattern).
 * - UUIDs are standard but verbose (36 chars with dashes).
 *
 * WHY nanoid (via crypto.randomUUID):
 * We use the Web Crypto API's `randomUUID()` — available in Bun, Node 19+,
 * and Cloudflare Workers natively. No extra dependency.
 * 21-char IDs = 2^126 collision space — practically collision-proof.
 *
 * Alternative considered: ULID (sortable IDs). Would be better for time-based
 * sorting but adds a dependency. Revisit if we need time-sortable IDs for the
 * price history table.
 */
export function createId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 21)
}
