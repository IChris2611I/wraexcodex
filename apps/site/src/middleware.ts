import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Next.js middleware — runs on every request at the edge before rendering.
 *
 * WHY we guard with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY check:
 * Clerk middleware crashes with MIDDLEWARE_INVOCATION_FAILED if the publishable
 * key is not set. During early deployment (before Clerk is configured) we want
 * the site to work without auth. This guard makes the middleware a no-op when
 * Clerk isn't configured, so the site is always reachable.
 *
 * WHY edge middleware (not Node.js middleware):
 * Middleware runs at the CDN edge, not in a Node.js process. Latency is
 * microseconds, not milliseconds. Auth checks are free.
 */

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/oracle(.*)",
  "/profile(.*)",
  "/builds/new(.*)",
  "/builds/edit/(.*)",
  "/settings(.*)",
])

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export default function middleware(req: NextRequest) {
  // If Clerk is not configured, skip auth middleware entirely
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next()
  }
  return clerkHandler(req)
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
