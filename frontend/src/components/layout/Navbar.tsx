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
  const isPlannerRoute = pathname.startsWith("/planner");
  const isWarmRoute =
    pathname === "/" ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/saved") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/ai-advisor") ||
    pathname.startsWith("/onboarding");
  const navItems = NAV_ITEMS;

  return (
    <nav
      className={`sticky top-0 z-40 backdrop-blur-md ${
        isWarmRoute
          ? "border-b border-white/8 bg-[linear-gradient(180deg,rgba(7,16,30,0.94),rgba(7,16,30,0.80))]"
          : "bg-surface-overlay/88 border-b border-b-gold/20"
      }`}
    >
      <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          <Link href="/" className="relative z-10 flex items-center gap-3 shrink-0">
            <Image
              src="/assets/branding/marquette_logo.webp"
              alt="Marquette"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span
              className={`font-[family-name:var(--font-sora)] text-[1.3rem] font-bold ${
                isWarmRoute ? "text-gold" : "text-gold"
              }`}
            >
              MarqBot
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 absolute inset-0 justify-center pointer-events-none">
            <div
              className={`pointer-events-auto flex items-center gap-1 rounded-full px-2 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.08)] ${
                isWarmRoute
                  ? "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]"
                  : "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]"
              }`}
            >
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[0.98rem] font-semibold transition-colors ${
                      active
                        ? isWarmRoute
                          ? "text-gold"
                          : "text-gold"
                        : isWarmRoute
                          ? "text-ink-muted hover:bg-surface-hover hover:text-ink-primary underline-reveal"
                          : "text-ink-muted hover:bg-surface-hover hover:text-ink-primary underline-reveal"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badgeLabel && (
                      <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold tooltip-bounce">
                        {item.badgeLabel}
                      </span>
                    )}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className={`absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full ${
                          isWarmRoute ? "bg-gold" : "bg-gold"
                        }`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="hidden md:flex items-center relative z-10">
            {isWarmRoute ? (
              <Link href="/onboarding">
                <Button
                  variant={pathname === "/" ? "ink" : "gold"}
                  size="sm"
                  className={
                    pathname === "/"
                      ? "min-w-[156px] shadow-[0_12px_24px_rgba(43,26,7,0.12)]"
                      : "min-w-[156px] border border-gold/50 shadow-[0_0_16px_rgba(255,204,0,0.18)] transition-shadow duration-300 hover:shadow-[0_0_22px_rgba(255,204,0,0.28)]"
                  }
                >
                  Start Planning
                </Button>
              </Link>
            ) : isPlannerRoute ? (
              <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center border border-border-subtle">
                <Image
                  src="/assets/avatar_silhouette.svg"
                  alt="Profile"
                  width={20}
                  height={20}
                  className="opacity-40"
                />
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`cursor-pointer rounded-lg p-2 md:hidden ${
              isWarmRoute ? "hover:bg-surface-hover" : "hover:bg-surface-hover"
            }`}
            aria-label="Toggle menu"
          >
            <svg
              className={`h-5 w-5 ${isWarmRoute ? "text-ink-secondary" : "text-ink-secondary"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className={`overflow-hidden border-t md:hidden ${
              isWarmRoute
                ? "border-border-subtle bg-surface-overlay"
                : "border-border-subtle bg-surface-overlay"
            }`}
          >
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[1rem] font-semibold ${
                      active
                        ? isWarmRoute
                          ? "bg-gold/10 text-gold"
                          : "bg-gold/10 text-gold"
                        : isWarmRoute
                          ? "text-ink-muted hover:bg-surface-hover"
                          : "text-ink-muted hover:bg-surface-hover"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badgeLabel && (
                      <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold tooltip-bounce">
                        {item.badgeLabel}
                      </span>
                    )}
                  </Link>
                );
              })}
              {isWarmRoute && (
                <div className="pt-2">
                  <Link href="/onboarding" onClick={() => setMobileOpen(false)}>
                    <Button variant="ink" size="md" className="w-full">
                      Start Planning
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
