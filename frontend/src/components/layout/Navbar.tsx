"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { NAV_ITEMS } from "@/lib/constants";
import { Button } from "@/components/shared/Button";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = pathname === "/";
  const navItems = NAV_ITEMS;

  return (
    <nav
      className={`sticky top-0 z-40 backdrop-blur-md ${
        isLanding
          ? "border-b border-white/8 bg-[linear-gradient(180deg,rgba(7,16,30,0.94),rgba(7,16,30,0.78))]"
          : "bg-surface-overlay/80 border-b-[3px] border-b-gold/20"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="relative z-10 flex items-center gap-3 shrink-0">
            <Image
              src="/assets/branding/marquette_logo.webp"
              alt="Marquette"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-[family-name:var(--font-sora)] font-bold text-gold text-[1.3rem]">
              MarqBot
            </span>
          </Link>

          {/* Desktop nav — absolutely centered in viewport */}
          <div className="hidden md:flex items-center gap-1 absolute inset-0 justify-center pointer-events-none">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-2 py-1 pointer-events-auto shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`relative px-3.5 py-2 rounded-xl text-[1rem] font-semibold transition-colors ${
                      active
                        ? "text-gold"
                        : "text-ink-muted hover:text-ink-primary hover:bg-surface-hover underline-reveal"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-gold rounded-full"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden md:flex items-center relative z-10">
            {isLanding ? (
              <Link href="/onboarding">
                <Button
                  variant="gold"
                  size="sm"
                  className="min-w-[148px] border border-gold/50 shadow-[0_0_16px_rgba(255,204,0,0.18)] hover:shadow-[0_0_22px_rgba(255,204,0,0.28)] transition-shadow duration-300"
                >
                  Get My Plan
                </Button>
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center border border-border-subtle">
                <Image
                  src="/assets/avatar_silhouette.svg"
                  alt="Profile"
                  width={20}
                  height={20}
                  className="opacity-40"
                />
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-surface-hover cursor-pointer"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-border-subtle bg-surface-overlay"
          >
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2.5 rounded-xl text-[1rem] font-semibold ${
                      active
                        ? "bg-gold/10 text-gold"
                        : "text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isLanding && (
                <div className="pt-2">
                  <Link href="/onboarding" onClick={() => setMobileOpen(false)}>
                    <Button variant="gold" size="md" className="w-full">
                      Get My Plan
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
