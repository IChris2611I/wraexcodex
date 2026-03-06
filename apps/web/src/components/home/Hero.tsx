"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      
      {/* Background glow effects */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(230,126,34,0.08) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "var(--border-subtle)" }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-8 border"
          style={{
            borderColor: "var(--border-ember)",
            background: "var(--ember-glow)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "var(--ember)" }}
          />
          <span
            className="font-ui text-xs tracking-widest uppercase"
            style={{ color: "var(--ember)" }}
          >
            Path of Exile 2 — Early Access
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-6xl md:text-8xl font-bold mb-6 leading-none"
        >
          <span style={{ color: "var(--text-primary)" }}>The Knowledge</span>
          <br />
          <span style={{ color: "var(--ember)" }}>of Wraeclast</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl mb-12 max-w-2xl mx-auto"
          style={{ color: "var(--text-muted)" }}
        >
          Items, builds, skills, bosses — every piece of knowledge forged into
          one definitive reference. Powered by AI.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/items"
            className="px-8 py-3 rounded-md font-ui font-semibold text-sm tracking-wider uppercase transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #e67e22, #f39c12)",
              color: "white",
              boxShadow: "0 0 30px rgba(230,126,34,0.3)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.boxShadow =
                "0 0 50px rgba(230,126,34,0.5)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.boxShadow =
                "0 0 30px rgba(230,126,34,0.3)")
            }
          >
            Browse the Codex
          </Link>
          <Link
            href="/oracle"
            className="px-8 py-3 rounded-md font-ui font-semibold text-sm tracking-wider uppercase border transition-all duration-200"
            style={{
              borderColor: "var(--border-rune)",
              color: "var(--rune)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--rune-glow)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Ask the Oracle
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-12 mt-20"
        >
          {[
            { value: "10,000+", label: "Items" },
            { value: "200+", label: "Skills" },
            { value: "500+", label: "Builds" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="font-display text-2xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {stat.value}
              </div>
              <div
                className="font-ui text-xs tracking-widest uppercase mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}