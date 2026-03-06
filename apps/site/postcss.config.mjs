/**
 * PostCSS config for Tailwind v4.
 *
 * WHY @tailwindcss/postcss (not the old tailwindcss PostCSS plugin):
 * Tailwind v4 ships a new PostCSS plugin — `@tailwindcss/postcss`.
 * The old `tailwindcss` plugin doesn't work with v4. This is a breaking change
 * from v3 to v4. The new plugin is faster and doesn't need autoprefixer.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
