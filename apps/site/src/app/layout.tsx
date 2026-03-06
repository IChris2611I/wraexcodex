import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import "@wraexcodex/ui/styles"
import "./globals.css"

/**
 * Root Layout — the persistent shell around every page.
 *
 * WHY this is a Server Component by default (no "use client"):
 * In Next.js App Router, layouts are Server Components unless you add "use client".
 * Server Components render on the server — no JS sent to the browser for this file.
 * ClerkProvider needs to be here (at the root) to make auth available everywhere,
 * but Clerk's Next.js adapter handles the client-side hydration internally.
 *
 * WHY fonts via CSS @import (not next/font):
 * Cinzel and Barlow are on Google Fonts. next/font would self-host them.
 * Self-hosting is strictly better for performance (no external DNS lookup,
 * no cross-origin resource request). We'll migrate to next/font in Week 2
 * when we're tuning Core Web Vitals.
 */

export const metadata: Metadata = {
  metadataBase: new URL("https://lootreference.com"),
  title: {
    default: "LootReference — The Wraeclast Codex",
    template: "%s | LootReference",
  },
  description:
    "The definitive Path of Exile 2 reference platform. Items, builds, skills, passives, and AI-powered build advice — all in one place.",
  keywords: ["Path of Exile 2", "PoE2", "builds", "items", "skills", "passive tree"],
  authors: [{ name: "LootReference" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://lootreference.com",
    siteName: "LootReference",
    title: "LootReference — The Wraeclast Codex",
    description: "The definitive Path of Exile 2 reference platform.",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "LootReference",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LootReference — The Wraeclast Codex",
    description: "The definitive Path of Exile 2 reference platform.",
    images: ["/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: "#050508",
  colorScheme: "dark",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          {/* Google Fonts — Cinzel (display) + Barlow family (UI + body) */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-forge-950 text-parchment antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
