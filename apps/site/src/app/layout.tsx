import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { CommandPalette } from "@/components/CommandPalette"
import { PageTransition } from "@/components/PageTransition"
import "@wraexcodex/ui/styles"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL("https://wraexcodex.com"),
  title: {
    default: "Wraex Codex — The Wraeclast Codex",
    template: "%s | Wraex Codex",
  },
  description:
    "The definitive Path of Exile 2 reference platform. Items, builds, skills, passives, and AI-powered build advice — all in one place.",
  keywords: [
    "Path of Exile 2", "PoE2", "builds", "items", "skills",
    "passive tree", "wraex codex", "poe2 builds", "poe2 items",
  ],
  authors: [{ name: "Wraex Codex" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://wraexcodex.com",
    siteName: "Wraex Codex",
    title: "Wraex Codex — The Wraeclast Codex",
    description: "The definitive Path of Exile 2 reference platform.",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "Wraex Codex" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wraex Codex — The Wraeclast Codex",
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
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          {/*
           * Google Fonts — preconnect establishes TCP before stylesheet link is parsed.
           * Cinzel: display/titles. Barlow Condensed: UI labels. Barlow: body.
           * Migrating to next/font (self-hosted) in Week 2 — eliminates external request.
           */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-forge-950 text-parchment antialiased">
          {/* Global search palette — listens for wraex:search:open event */}
          <CommandPalette />

          {/* Sticky navigation */}
          <Navbar />

          {/* Page content with fade transition */}
          <PageTransition>
            {/* pt-16 = navbar height offset so content isn't hidden behind fixed nav */}
            <div className="flex min-h-screen flex-col pt-16">
              {children}
              <Footer />
            </div>
          </PageTransition>
        </body>
      </html>
    </ClerkProvider>
  )
}
