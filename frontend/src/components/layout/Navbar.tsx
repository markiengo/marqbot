"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { NAV_ITEMS } from "@/lib/constants";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopBadgeClass = "rounded-full border border-gold/25 bg-gold/10 px-[6px] py-[1px] text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light";
  const mobileBadgeClass = "rounded-full border border-gold/25 bg-gold/10 px-[6px] py-[1px] text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-light";

  const desktopNav = (
    <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
      <div className="pointer-events-auto flex items-center gap-[4px]">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`relative flex items-center gap-[6px] rounded-full px-[12px] py-[6px] text-[15px] font-semibold transition-colors ${
                active
                  ? "text-gold-light"
                  : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              {active ? (
                <>
                  <span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(255,204,0,0.12),rgba(255,255,255,0.04))]" />
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-[12px] bottom-[4px] h-[2px] rounded-full bg-[linear-gradient(90deg,#ffcc00,#ffe48a)]"
                  />
                </>
              ) : null}
              <span className="relative z-[1] flex items-center gap-[6px]">
                <span>{item.label}</span>
                {item.badgeLabel ? (
                  <span className={desktopBadgeClass}>
                    {item.badgeLabel}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 border-b border-white/8 bg-[linear-gradient(180deg,rgba(7,16,30,0.96),rgba(6,15,28,0.88))] backdrop-blur-xl"
    >
      <div className="w-full px-[12px] py-[9px] sm:px-[18px] lg:px-[24px]">
        <div className="relative flex w-full items-center justify-between rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(2,19,42,0.92),rgba(5,22,43,0.82))] px-[12px] py-[9px] shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute inset-[1px] rounded-full bg-[radial-gradient(circle_at_14%_0%,rgba(255,204,0,0.12),transparent_24%),radial-gradient(circle_at_88%_100%,rgba(0,114,206,0.10),transparent_28%)]" />

          <Link href="/" className="relative z-10 flex shrink-0 items-center gap-[9px]">
            <Image
              src="/assets/branding/marquette_logo.webp"
              alt="Marquette"
              width={24}
              height={24}
              className="rounded-lg"
            />
            <span className="font-[family-name:var(--font-sora)] text-[21px] font-bold text-white">
              MarqBot
            </span>
          </Link>

          {desktopNav}

          <div className="relative z-10 hidden items-center md:flex">
            <Button
              asChild
              variant="gold"
              size="xs"
              className="min-w-[126px] rounded-[8px] border-gold/45 px-[9px] py-[5px] text-[14px] shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
            >
              <Link href="/onboarding">
                Start Planning
              </Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative z-10 cursor-pointer rounded-lg p-[6px] md:hidden"
            aria-label="Toggle menu"
          >
            <svg className="h-[16px] w-[16px] text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        {mobileOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="overflow-hidden border-t border-border-subtle bg-surface-overlay md:hidden"
          >
            <div className="space-y-1 px-[12px] py-[9px]">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-[34px] items-center justify-between rounded-xl px-[9px] py-[7px] text-[16px] font-semibold ${
                    pathname === item.href ? "bg-gold/10 text-gold-light" : "text-ink-muted hover:bg-surface-hover"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badgeLabel ? (
                    <span className={mobileBadgeClass}>
                      {item.badgeLabel}
                    </span>
                  ) : null}
                </Link>
              ))}

              <div className="pt-1.5">
                <Button asChild variant="gold" size="sm" className="w-full rounded-[10px] px-[12px] py-[8px] text-[14px]" onClick={() => setMobileOpen(false)}>
                  <Link href="/onboarding">
                    Start Planning
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
