import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

/**
 * Next.js middleware — runs on every request at the edge before rendering.
 *
 * WHY Clerk middleware here:
 * Clerk's middleware reads the auth token from the request and makes
 * auth state available to Server Components via `auth()`. Without this,
 * every server component would need to manually verify tokens.
 *
 * WHY edge middleware (not Node.js middleware):
 * Middleware runs at the CDN edge, not in a Node.js process. Latency is
 * microseconds, not milliseconds. Auth checks are free — they don't add
 * perceptible delay to any request.
 *
 * Route matching strategy:
 * - Public routes: homepage, items, builds, skills, bosses (SEO pages)
 * - Protected routes: /dashboard, /oracle, /profile, /builds/new
 * - Clerk handles the redirect to sign-in automatically for protected routes
 */

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/oracle(.*)",
  "/profile(.*)",
  "/builds/new(.*)",
  "/builds/edit/(.*)",
  "/settings(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
