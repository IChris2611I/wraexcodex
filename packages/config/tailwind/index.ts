import type { Config } from "tailwindcss"

/**
 * LootReference Design Tokens
 *
 * WHY: Centralise every colour, font, and spacing token here so all apps
 * share the same brand identity. Change one value → updates everywhere.
 *
 * PHILOSOPHY: Dark forge meets arcane library.
 * Heavy, textured, intentional — not sterile minimalism.
 */
export const lootReferencePreset = {
  theme: {
    extend: {
      colors: {
        // Backgrounds — deep dark purple-blacks
        forge: {
          950: "#050508",
          900: "#08080f",
          800: "#0d0d1a",
          700: "#12122a",
        },
        // Primary — ember orange → gold (hover transitions)
        ember: {
          DEFAULT: "#e67e22",
          light: "#f39c12",
          dark: "#d35400",
        },
        // Secondary — rune cyan (AI features)
        rune: {
          DEFAULT: "#00d4ff",
          dark: "#0099cc",
          glow: "rgba(0, 212, 255, 0.15)",
        },
        // Danger / unique items
        crimson: {
          DEFAULT: "#c0392b",
          light: "#e74c3c",
        },
        // Text
        parchment: {
          DEFAULT: "#e8e0d0",
          muted: "#7a7060",
          dim: "#4a4535",
        },
      },
      fontFamily: {
        // Display / titles — Roman-inspired serif
        display: ["Cinzel", "serif"],
        // UI labels, badges, navigation
        ui: ["Barlow Condensed", "sans-serif"],
        // Body text
        body: ["Barlow", "sans-serif"],
      },
      backgroundImage: {
        "forge-gradient": "radial-gradient(ellipse at top, #12122a 0%, #050508 70%)",
        "ember-gradient": "linear-gradient(135deg, #e67e22, #f39c12)",
      },
      boxShadow: {
        ember: "0 0 20px rgba(230, 126, 34, 0.3)",
        rune: "0 0 20px rgba(0, 212, 255, 0.2)",
        "item-tooltip": "0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(230, 126, 34, 0.2)",
      },
      animation: {
        "fade-in": "fadeIn 150ms ease-out",
        "slide-up": "slideUp 200ms ease-out",
        "ember-pulse": "emberPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        emberPulse: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(230, 126, 34, 0.3)" },
          "50%": { boxShadow: "0 0 25px rgba(230, 126, 34, 0.6)" },
        },
      },
    },
  },
} satisfies Partial<Config>
