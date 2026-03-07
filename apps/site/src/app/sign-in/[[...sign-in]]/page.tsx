/**
 * /sign-in — Clerk hosted sign-in page
 *
 * WHY [[...sign-in]] catch-all route:
 * Clerk's <SignIn /> component uses sub-routes internally for things like
 * /sign-in/factor-one, /sign-in/sso-callback, etc.
 * The catch-all route ensures all those sub-paths render this same component.
 *
 * Appearance is controlled via Clerk Dashboard → Customization,
 * but we wrap it in our forge aesthetic for the surrounding page.
 */

import { SignIn } from "@clerk/nextjs"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Sign In — Wraex Codex",
  description: "Sign in to Wraex Codex to save builds, track prices, and access the Oracle AI advisor.",
  robots: { index: false, follow: false },
}

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      {/* Forge glow backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-sm bg-ember/10">
              <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M2 3L5.5 13L9 6L12.5 13L16 3" stroke="#e67e22" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 13L9 15.5L12.5 13" stroke="#f39c12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
              </svg>
            </div>
            <span className="font-display text-lg font-bold text-parchment">
              Wraex <span className="text-gradient-ember">Codex</span>
            </span>
          </Link>
          <p className="mt-3 font-body text-sm text-parchment-muted">
            Sign in to save builds, track prices, and access Oracle AI
          </p>
        </div>

        {/* Clerk SignIn component — handles all auth UI */}
        <SignIn
          fallbackRedirectUrl="/"
          appearance={{
            variables: {
              colorPrimary: "#e67e22",
              colorBackground: "#0d0d14",
              colorInputBackground: "#08080f",
              colorInputText: "#e8e0d0",
              colorText: "#e8e0d0",
              colorTextSecondary: "#9a8f7e",
              colorDanger: "#ef4444",
              borderRadius: "2px",
              fontFamily: "Barlow, sans-serif",
            },
            elements: {
              card: "shadow-none border border-border-subtle bg-transparent",
              headerTitle: "font-display text-parchment",
              headerSubtitle: "font-body text-parchment-muted",
              socialButtonsBlockButton: "border-border-strong hover:border-ember/40 transition-colors",
              formButtonPrimary: "bg-ember hover:bg-ember-light font-ui uppercase tracking-wider",
              footerActionLink: "text-ember hover:text-ember-light",
              identityPreviewEditButton: "text-ember",
              formFieldInput: "bg-forge-900 border-border-strong focus:border-ember",
              dividerLine: "bg-border-subtle",
              dividerText: "text-parchment-muted font-ui text-xs",
            },
          }}
        />
      </div>
    </div>
  )
}
