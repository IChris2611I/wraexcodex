"use client"

/**
 * PageTransition — subtle fade between route changes
 *
 * WHY Framer Motion here and not CSS:
 * Next.js App Router doesn't expose route change events cleanly to CSS.
 * Framer Motion's AnimatePresence tracks component mount/unmount and
 * applies enter/exit animations automatically.
 *
 * WHY keep it subtle (opacity only, no slide):
 * Aggressive page transitions feel slow — the user has to wait for the
 * animation to finish before they can interact. A 150ms fade is imperceptible
 * as "slow" but adds perceived polish. Anything with movement (translate, scale)
 * at >100ms starts feeling sluggish on a fast site.
 */

import { motion } from "framer-motion"
import { usePathname } from "next/navigation"

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
