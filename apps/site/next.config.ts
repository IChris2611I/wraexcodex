import type { NextConfig } from "next"

/**
 * Next.js 15 configuration.
 *
 * WHY Turbopack in dev (--turbopack flag in package.json):
 * Turbopack is Next's Rust-based bundler. In dev it's 700x faster than Webpack
 * on cold starts and incremental builds. We're using it for dev only — Next 15
 * still uses Webpack for production builds (more battle-tested for production).
 *
 * WHY transpilePackages:
 * Our workspace packages (ui, db) are TypeScript source — not pre-compiled.
 * Next needs to know to run them through the build pipeline.
 * Without this, Next throws "unexpected token" on TypeScript syntax in node_modules.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@wraexcodex/ui", "@wraexcodex/db"],

  // NOTE: PPR and reactCompiler require Next.js canary — re-enable when we upgrade.
  // ppr: "incremental"       → static shell + streaming dynamic content (<1s LCP)
  // reactCompiler: true      → automatic memoization, eliminates useMemo/useCallback

  images: {
    // Supabase Storage for item icons and images
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // PoE2 CDN for item icons (before we mirror them)
      {
        protocol: "https",
        hostname: "web.poecdn.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // Security headers — applied to every response
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy — don't leak full URL to third parties
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions policy — disable features we don't use
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig
