import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * `cn` — the universal className utility.
 *
 * WHY clsx + tailwind-merge together:
 * - `clsx` handles conditional classes cleanly: cn("base", isActive && "active")
 * - `tailwind-merge` resolves Tailwind conflicts: cn("px-2", "px-4") → "px-4"
 *   Without it, both classes are in the string but only the last one wins
 *   based on CSS specificity — unpredictable. tailwind-merge makes it explicit.
 *
 * Every component in LootReference uses this. It is the single most-called
 * utility in the entire codebase.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
