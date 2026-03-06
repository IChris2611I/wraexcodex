/**
 * /api/icon — Image Proxy for cdn.poe2db.tw
 *
 * WHY this exists:
 * cdn.poe2db.tw has hotlink protection — it returns 403 unless the request
 * includes Referer: https://poe2db.tw/. Browsers don't send a Referer when
 * loading images via <img src> or next/image from a different origin.
 *
 * This route handler acts as a proxy: Next.js fetches the image server-side
 * (with the correct Referer header) and streams it back to the browser.
 *
 * Usage: /api/icon?url=https://cdn.poe2db.tw/image/Art/...
 *
 * Security:
 * - Only allows requests to cdn.poe2db.tw and web.poecdn.com
 * - URL is validated before fetching (no SSRF)
 * - Response is cached for 24h at the CDN edge (Cache-Control)
 *
 * Performance:
 * - next/image can still optimise the proxied image (resize, WebP conversion)
 *   because the proxy URL is on our own domain
 * - Long Cache-Control means each image is only fetched once per day
 */

import { type NextRequest, NextResponse } from "next/server"

const ALLOWED_HOSTS = ["cdn.poe2db.tw", "web.poecdn.com"]

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url")

  if (!urlParam) {
    return new NextResponse("Missing url param", { status: 400 })
  }

  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(urlParam)
  } catch {
    return new NextResponse("Invalid url", { status: 400 })
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 })
  }

  // Fetch with appropriate headers
  const upstream = await fetch(urlParam, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; WraexCodex/1.0)",
      // poe2db requires this Referer to bypass hotlink protection
      Referer: "https://poe2db.tw/",
      Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
    },
    // 8 second timeout — images should be fast
    signal: AbortSignal.timeout(8000),
  })

  if (!upstream.ok) {
    return new NextResponse(`Upstream returned ${upstream.status}`, {
      status: upstream.status,
    })
  }

  const contentType = upstream.headers.get("content-type") ?? "image/webp"
  const body = await upstream.arrayBuffer()

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Cache 24h at browser + CDN edge — icons don't change often
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
    },
  })
}
