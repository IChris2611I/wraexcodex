/**
 * POST /api/webhooks/clerk — Clerk webhook handler
 *
 * WHY a webhook instead of syncing on every request:
 * Reading the current user from Clerk on every page load is fine for display.
 * But we need the user in OUR database to:
 * - Associate builds with an author (builds.authorId FK)
 * - Store user preferences, Pro status, etc.
 * - Run DB queries that JOIN on users without hitting Clerk API every time
 *
 * Clerk fires webhooks on:
 * - user.created  → insert into our users table
 * - user.updated  → sync name/avatar changes
 * - user.deleted  → soft-delete (keep their builds, anonymise profile)
 *
 * Security: Svix verifies the webhook signature using CLERK_WEBHOOK_SECRET.
 * Without this check, anyone could POST to this endpoint and fake user events.
 *
 * Setup (one-time in Clerk Dashboard):
 * 1. Dashboard → Webhooks → Add Endpoint
 * 2. URL: https://wraexcodex.vercel.app/api/webhooks/clerk
 * 3. Events: user.created, user.updated, user.deleted
 * 4. Copy the Signing Secret → add to CLERK_WEBHOOK_SECRET in Vercel env vars
 */

import { type NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { db } from "@wraexcodex/db"
import { users } from "@wraexcodex/db/schema"
import { eq, sql } from "@wraexcodex/db"

// Clerk webhook event types (subset we care about)
type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted"
  data: {
    id: string
    email_addresses: Array<{ email_address: string; id: string }>
    primary_email_address_id: string
    first_name: string | null
    last_name: string | null
    username: string | null
    image_url: string | null
    created_at: number
    updated_at: number
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    // During development without webhook secret, log and return OK
    // (webhook verification is only required in production)
    console.warn("[webhook/clerk] CLERK_WEBHOOK_SECRET not set — skipping verification")
    return NextResponse.json({ message: "Webhook secret not configured" }, { status: 200 })
  }

  // ── Verify signature ──────────────────────────────────────────────────
  const svix_id = req.headers.get("svix-id")
  const svix_timestamp = req.headers.get("svix-timestamp")
  const svix_signature = req.headers.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(webhookSecret)

  let event: ClerkUserEvent
  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkUserEvent
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // ── Handle events ─────────────────────────────────────────────────────
  const { type, data } = event

  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )?.email_address ?? data.email_addresses[0]?.email_address ?? ""

  const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || "Exile"

  try {
    if (type === "user.created") {
      await db.insert(users).values({
        clerkId: data.id,
        email: primaryEmail,
        username: data.username ?? `exile_${data.id.slice(-6)}`,
        displayName,
        avatarUrl: data.image_url,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      }).onConflictDoNothing()

      console.log(`[webhook/clerk] user.created: ${primaryEmail}`)
    }

    if (type === "user.updated") {
      await db.update(users)
        .set({
          email: primaryEmail,
          displayName,
          avatarUrl: data.image_url,
          updatedAt: new Date(data.updated_at),
        })
        .where(eq(users.clerkId, data.id))

      console.log(`[webhook/clerk] user.updated: ${primaryEmail}`)
    }

    if (type === "user.deleted") {
      // Soft delete — keep their builds, just mark account as deleted
      await db.update(users)
        .set({
          email: `deleted_${data.id}@deleted.invalid`,
          displayName: "Deleted User",
          avatarUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, data.id))

      console.log(`[webhook/clerk] user.deleted: ${data.id}`)
    }
  } catch (err) {
    console.error("[webhook/clerk] DB error:", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
