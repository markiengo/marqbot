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
    <div
      className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-10"
      style={{
        background:
          "radial-gradient(ellipse 60% 30% at 50% 0%, rgba(24,68,160,0.18), transparent), radial-gradient(ellipse 50% 25% at 80% 50%, rgba(255,204,0,0.06), transparent), linear-gradient(140deg, #071227, #0c1d38 50%, #0d203e)",
      }}
    >
      {/* Cover image as vivid background */}
      {coverImage && (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={coverImage}
            alt=""
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-[#071227]/40" />
        </div>
      )}

      {/* Subtle atmospheric glows — kept light so the background image shows */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-[8%] top-[12%] h-[18rem] w-[18rem] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,204,0,0.05) 0%, transparent 70%)", filter: "blur(40px)" }}
        />
        <div
          className="absolute right-[6%] bottom-[20%] h-[20rem] w-[20rem] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,114,206,0.08) 0%, transparent 72%)", filter: "blur(52px)" }}
        />
      </div>

      {/* Centered content card */}
      <div className="relative z-10 w-full max-w-[38rem]">
        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/15 bg-[linear-gradient(145deg,rgba(10,24,50,0.88),rgba(8,19,39,0.82))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.40)] sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.06),transparent_40%)]" />
          <div className="relative z-10 space-y-5 text-center">
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="inline-block rounded-full border border-gold/25 bg-gold/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold"
            >
              {eyebrow}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="font-[family-name:var(--font-sora)] text-3xl font-bold leading-[0.95] tracking-tight text-white sm:text-4xl"
            >
              {title}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.4, delay: 0.28 }}
              className="mx-auto h-0.5 w-12 rounded-full bg-gold"
            />

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.32 }}
              className="mx-auto max-w-md text-sm leading-relaxed text-slate-300 sm:text-base"
            >
              {description}
            </motion.p>

            {detail && (
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.38 }}
                className="mx-auto max-w-md text-sm leading-relaxed text-slate-400"
              >
                {detail}
              </motion.p>
            )}

            {bullets.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.42 }}
                className="grid gap-2 text-left"
              >
                {bullets.map((bullet, index) => (
                  <li
                    key={bullet}
                    className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-base leading-relaxed text-slate-200"
                  >
                    <span className="mr-2 font-semibold text-gold">{index + 1}.</span>
                    {bullet}
                  </li>
                ))}
              </motion.ul>
            )}

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.48 }}
              className="flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button
                asChild
                variant="gold"
                size="lg"
                className="min-w-[170px] border border-gold/60 shadow-[0_0_28px_rgba(255,204,0,0.24)]"
              >
                <Link href={primaryHref}>
                  {primaryLabel}
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="min-w-[170px] border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,114,206,0.10))] text-white shadow-[0_0_26px_rgba(0,114,206,0.14)] hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(0,114,206,0.14))]"
              >
                <Link href={secondaryHref}>
                  {secondaryLabel}
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
