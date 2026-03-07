"use client"

/**
 * NexusLoader — thin client wrapper that owns the dynamic() import.
 *
 * WHY this file exists:
 * Next.js 15 disallows `dynamic(..., { ssr: false })` in Server Components.
 * The rule is: ssr:false means "browser only", and only Client Components
 * can gate browser-only code. So we peel off one tiny "use client" file
 * that does nothing except hold the dynamic import — the page stays a
 * Server Component (for metadata, SEO, etc).
 */

import dynamic from "next/dynamic"

const NexusClient = dynamic(
  () => import("./NexusClient").then((m) => ({ default: m.NexusClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div
            className="mb-4 text-2xl"
            style={{ fontFamily: "Cinzel, serif", color: "#e67e22" }}
          >
            The Nexus
          </div>
          <div
            className="text-sm"
            style={{ fontFamily: "Barlow, sans-serif", color: "#6b7280" }}
          >
            Initializing…
          </div>
        </div>
      </div>
    ),
  }
)

export function NexusLoader() {
  return <NexusClient />
}
