/**
 * Clerk middleware — protects routes and handles auth redirects.
 *
 * WHY clerkMiddleware (not authMiddleware):
 * clerkMiddleware is the current Clerk v5+ API. authMiddleware is deprecated.
 *
 * Public routes: everything is public by default EXCEPT /dashboard and /builds/submit.
 * WHY not protect more routes: SEO pages (items, skills, builds browse) must be
 * publicly crawlable. Only user-specific actions need auth.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/builds/submit(.*)",
  "/builds/edit(.*)",
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
    "/(api|trpc)(.*)",
  ],
}
