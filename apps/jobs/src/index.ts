/**
 * Background Jobs Runner
 *
 * Runtime: Bun
 * Deployment: Railway (cron jobs or always-on process)
 *
 * Architecture: Bun's built-in cron-like scheduling via setInterval.
 * For production, Railway can run these as separate cron services.
 *
 * Job schedule:
 * - sync-items:    nightly at 02:00 UTC (GGG API doesn't change mid-day)
 * - sync-prices:   every 15 minutes (poe.ninja update frequency)
 * - sync-passives: weekly (passive tree rarely changes outside patches)
 *
 * WHY not Vercel Cron:
 * Vercel Cron has a 60-second execution limit on the free plan.
 * Item sync can take 5-10 minutes (5000+ items). Railway has no limit.
 */

import { syncItems } from "./jobs/sync-items"
import { syncPrices } from "./jobs/sync-prices"
import { syncPassives } from "./jobs/sync-passives"

console.log("[Jobs] Background job runner starting...")

// Run immediately on start (useful for manual triggers and testing)
const job = process.argv[2]

if (job === "sync-items") {
  await syncItems()
  process.exit(0)
} else if (job === "sync-prices") {
  await syncPrices()
  process.exit(0)
} else if (job === "sync-passives") {
  await syncPassives()
  process.exit(0)
} else {
  // Production mode — run all jobs on schedule
  console.log("[Jobs] Running in scheduled mode")

  // Prices — every 15 minutes
  setInterval(async () => {
    console.log("[Jobs] Running price sync...")
    await syncPrices().catch(console.error)
  }, 15 * 60 * 1000)

  // Items — every 6 hours (more frequent than nightly for early data builds)
  setInterval(async () => {
    console.log("[Jobs] Running item sync...")
    await syncItems().catch(console.error)
  }, 6 * 60 * 60 * 1000)

  console.log("[Jobs] Scheduler active. Press Ctrl+C to stop.")
}
