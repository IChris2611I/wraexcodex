import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * WHY the NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY guard:
 * Clerk middleware crashes with MIDDLEWARE_INVOCATION_FAILED if the key is
 * missing. This lets the site run without Clerk configured (early deployment,
 * local dev without auth). Once the Clerk key is added to Vercel env vars,
 * the real middleware kicks in automatically.
 */

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/oracle(.*)",
  "/profile(.*)",
  "/builds/new(.*)",
  "/builds/edit/(.*)",
  "/settings(.*)",
])

// Export the real Clerk middleware when key is present, otherwise a no-op
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect()
      }
    })
  : function middleware(_req: NextRequest) {
      return NextResponse.next()
    }

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
