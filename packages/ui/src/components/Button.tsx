import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../utils/cn"
import type { ButtonHTMLAttributes } from "react"

/**
 * Button — the foundational interactive element.
 *
 * WHY CVA (class-variance-authority):
 * CVA lets us define all button variants in one place with TypeScript types
 * auto-generated. Adding a new variant = one object key. The component
 * consumer gets full autocomplete. No switch statements, no prop drilling.
 *
 * Variants follow LootReference's design language:
 * - `ember` — primary CTA, orange glow, used for the main action on any page
 * - `rune` — AI features, cyan, used for Oracle / AI-powered interactions
 * - `ghost` — secondary action, minimal visual weight
 * - `outline` — bordered, useful in dark card contexts
 * - `crimson` — destructive actions only
 */
const buttonVariants = cva(
  // Base classes — applied to every variant
  [
    "inline-flex items-center justify-center gap-2",
    "font-ui font-medium tracking-wide",
    "rounded-sm border",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-forge-950",
    "disabled:pointer-events-none disabled:opacity-40",
    "cursor-pointer select-none",
  ],
  {
    variants: {
      variant: {
        ember: [
          "bg-ember border-ember text-forge-950",
          "hover:bg-ember-light hover:border-ember-light",
          "focus-visible:ring-ember",
          "shadow-[0_0_0_0_rgba(230,126,34,0)] hover:shadow-ember",
        ],
        rune: [
          "bg-transparent border-rune text-rune",
          "hover:bg-rune/10",
          "focus-visible:ring-rune",
          "shadow-[0_0_0_0_rgba(0,212,255,0)] hover:shadow-rune",
        ],
        ghost: [
          "bg-transparent border-transparent text-parchment",
          "hover:bg-forge-800 hover:text-parchment",
          "focus-visible:ring-parchment",
        ],
        outline: [
          "bg-transparent border-parchment-dim text-parchment-muted",
          "hover:border-parchment hover:text-parchment",
          "focus-visible:ring-parchment",
        ],
        crimson: [
          "bg-crimson border-crimson text-parchment",
          "hover:bg-crimson-light hover:border-crimson-light",
          "focus-visible:ring-crimson",
        ],
      },
      size: {
        sm: "h-7 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "ember",
      size: "md",
    },
  }
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    isLoading?: boolean
  }

export function Button({ className, variant, size, isLoading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          <span className="sr-only">Loading...</span>
        </>
      ) : null}
      {children}
    </button>
  )
}
