"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";

const navLinks = [
  { label: "Items", href: "/items" },
  { label: "Skills", href: "/skills" },
  { label: "Builds", href: "/builds" },
  { label: "Bosses", href: "/bosses" },
  { label: "The Oracle", href: "/oracle", isAI: true },
];

export default function Navbar() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-subtle)]"
      style={{
        background:
          "linear-gradient(180deg, rgba(8,8,15,0.95) 0%, rgba(5,5,8,0.85) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #e67e22, #f39c12)",
              boxShadow: "0 0 20px rgba(230, 126, 34, 0.3)",
            }}
          >
            <span className="font-display text-xs font-bold text-white">W</span>
          </div>
          <span className="font-display text-lg font-bold tracking-wide">
            <span className="text-[var(--text-primary)]">Wraex</span>
            <span className="text-ember">Codex</span>
          </span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHovered(link.href)}
              onMouseLeave={() => setHovered(null)}
              className="relative px-4 py-2 rounded-md font-ui text-sm font-medium tracking-wider uppercase transition-colors duration-200"
              style={{
                color:
                  link.isAI
                    ? "var(--rune)"
                    : hovered === link.href
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
              }}
            >
              {hovered === link.href && (
                <motion.span
                  layoutId="navbar-hover"
                  className="absolute inset-0 rounded-md"
                  style={{
                    background: link.isAI
                      ? "var(--rune-glow)"
                      : "var(--ember-glow)",
                  }}
                  transition={{ duration: 0.15 }}
                />
              )}
              {link.isAI && (
                <span
                  className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{
                    background: "var(--rune)",
                    boxShadow: "0 0 6px var(--rune)",
                  }}
                />
              )}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="p-2 rounded-md transition-colors duration-200"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </Link>
          <Link
            href="/auth"
            className="px-4 py-1.5 rounded-md font-ui text-sm font-semibold tracking-wider uppercase transition-all duration-200"
            style={{
              border: "1px solid var(--border-ember)",
              color: "var(--ember)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--ember-glow)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Sign In
          </Link>
        </div>
      </div>
    </motion.header>
  );
}