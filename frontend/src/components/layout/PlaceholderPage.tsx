"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";

interface PlaceholderPageProps {
  eyebrow?: string;
  title: string;
  description: string;
  detail?: string;
  bullets?: string[];
  coverImage?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function PlaceholderPage({
  eyebrow = "Coming Soon",
  title,
  description,
  detail,
  bullets = [],
  coverImage,
  primaryHref = "/planner",
  primaryLabel = "Go to Planner",
  secondaryHref = "/about",
  secondaryLabel = "Why it exists",
}: PlaceholderPageProps) {
  return (
    <div className="warm-page warm-page-noise relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-12 sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-[96rem] items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(18rem,0.78fr)]">
        <div className="warm-card relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
          <div className="absolute right-6 top-6 h-20 w-20 rounded-full bg-gold/10 blur-2xl" />
          <div className="relative z-10 space-y-6">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
              className="warm-kicker inline-flex rounded-full border border-gold/20 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold"
        >
              {eyebrow}
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-[11ch] font-[family-name:var(--font-sora)] text-4xl font-bold leading-[0.94] tracking-[-0.03em] text-ink-primary sm:text-5xl md:text-6xl"
        >
          {title}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
              className="h-1 w-16 rounded-full bg-gold"
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
              className="max-w-xl text-lg leading-relaxed text-ink-secondary"
        >
          {description}
        </motion.p>

            {detail && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.46 }}
                className="max-w-xl text-base leading-relaxed text-ink-faint"
              >
                {detail}
              </motion.p>
            )}

            {bullets.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.52 }}
                className="grid gap-3 sm:grid-cols-2"
              >
                {bullets.map((bullet, index) => (
                  <li key={bullet} className="warm-card-muted rounded-[1.35rem] px-4 py-3 text-sm leading-relaxed text-ink-secondary">
                    <span className="mr-2 font-[family-name:var(--font-sora)] text-gold">{index + 1}.</span>
                    {bullet}
                  </li>
                ))}
              </motion.ul>
            )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col items-start gap-3 sm:flex-row"
        >
              <Link href={primaryHref}>
                <Button variant="ink" size="lg">
                  {primaryLabel}
            </Button>
          </Link>
              <Link href={secondaryHref}>
                <Button
                  variant="secondary"
                  size="lg"
                  className="border-border-medium bg-surface-card text-ink-primary hover:bg-surface-hover"
                >
                  {secondaryLabel}
            </Button>
          </Link>
        </motion.div>
          </div>
        </div>

        <div className="warm-card relative overflow-hidden rounded-[2rem] p-5 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.12),transparent_32%)]" />
          <div className="relative z-10">
            <p className="warm-kicker text-xs uppercase tracking-[0.18em] text-gold">Preview</p>
            <h2 className="mt-3 font-[family-name:var(--font-sora)] text-2xl font-semibold text-ink-primary">
              What this page will be.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
              This route stays in the nav so you can see where MarqBot is heading. It is not fully useful yet, so the safest move right now is still the planner.
            </p>
            <div className="mt-6 overflow-hidden rounded-[1.4rem] border border-white/10 bg-surface-card/80">
              {coverImage ? (
                <div className="relative aspect-[4/3]">
                  <Image src={coverImage} alt="" fill className="object-cover" priority />
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,rgba(12,29,56,0.92),rgba(22,43,80,0.78))] px-6 text-center text-sm text-ink-secondary">
                  Future product preview
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
