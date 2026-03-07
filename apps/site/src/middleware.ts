/**
 * Middleware — intentionally minimal until Clerk is configured.
 *
 * WHY no Clerk here yet:
 * Clerk middleware requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to be set.
 * We don't have auth features built yet, so there's nothing to protect.
 * Clerk will be wired in when we build /dashboard and user accounts.
 *
 * The matcher below still runs on every request but just passes through.
 */

export default function middleware() {
  // No-op — auth middleware added when Clerk is configured
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
