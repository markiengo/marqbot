"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";
import { Button } from "@/components/shared/Button";
import styles from "./about.module.css";
import { ABOUT_TIMELINE } from "./aboutContent";
import type { TimelineEntry } from "./aboutContent";

const STATUS_CONFIG = {
  building: { label: "Building", border: "border-[#8ec8ff]/20", pill: "bg-[#8ec8ff]/10 text-[#8ec8ff]" },
  planned: { label: "Planned", border: "border-gold/20", pill: "bg-gold/12 text-gold" },
} as const;

function FlipCard({
  entry,
  index,
  isFlipped,
  isDimmed,
  onFlip,
  reduce,
}: {
  entry: TimelineEntry;
  index: number;
  isFlipped: boolean;
  isDimmed: boolean;
  onFlip: () => void;
  reduce: boolean | null;
}) {
  const status = entry.status as "building" | "planned";
  const cfg = STATUS_CONFIG[status];

  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: 0.08 * index }}
      whileHover={isFlipped ? undefined : { y: -4 }}
      animate={{ opacity: isDimmed ? 0.35 : 1 }}
      className="min-w-[220px] flex-1 cursor-pointer"
      onClick={onFlip}
    >
      <div
        className={`relative overflow-hidden rounded-xl border ${cfg.border} ${
          isFlipped
            ? "bg-[linear-gradient(145deg,rgba(14,30,58,0.98),rgba(10,24,50,0.95))] shadow-[0_8px_32px_rgba(0,0,0,0.24)]"
            : "bg-[linear-gradient(145deg,rgba(10,24,50,0.96),rgba(8,19,39,0.90))] shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        } p-5 transition-shadow duration-300`}
      >
        <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_60%)]" />

        <AnimatePresence mode="wait" initial={false}>
          {!isFlipped ? (
            <motion.div
              key="front"
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 90 }}
              transition={{ duration: 0.3 }}
              className="relative z-10"
            >
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${cfg.pill}`}>
                {cfg.label}
              </span>
              <h3 className="mt-3 font-[family-name:var(--font-sora)] text-lg font-semibold text-white">
                {entry.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-slate-400">
                {entry.body}
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-widest text-slate-500">
                Tap to read more
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: -90 }}
              transition={{ duration: 0.3 }}
              className="relative z-10"
            >
              <h3 className="font-[family-name:var(--font-sora)] text-lg font-semibold text-white">
                {entry.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                {entry.detail}
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-widest text-slate-500">
                Tap to close
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function NowNextSection() {
  const reduce = useReducedMotion();
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());

  const ease = [0.22, 1, 0.36, 1] as const;

  const viewAnim = (y: number, delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" as const },
          transition: { duration: 0.48, delay, ease },
        };

  const buildingEntries = ABOUT_TIMELINE.filter((e) => e.status === "building");
  const plannedEntries = ABOUT_TIMELINE.filter((e) => e.status === "planned");

  // Global index so only one card is flipped across both lanes
  const allEntries = [...buildingEntries, ...plannedEntries];

  const handleFlip = useCallback(
    (globalIdx: number) => {
      setFlippedSet((prev) => {
        const next = new Set(prev);
        if (next.has(globalIdx)) {
          next.delete(globalIdx);
        } else {
          next.add(globalIdx);
        }
        return next;
      });
    },
    [],
  );

  return (
    <section className="relative overflow-hidden py-16 band-blue band-fade-top">
      <div className={styles.sectionMesh} />
      <div
        className={`${styles.sectionGlow} left-[12%] top-[24%] h-[16rem] w-[16rem]`}
        style={{ background: "rgba(255,204,0,0.05)" }}
      />
      <div
        className={`${styles.sectionGlow} right-[8%] bottom-[14%] h-[18rem] w-[18rem]`}
        style={{ background: "rgba(24,68,160,0.12)" }}
      />

      <div className="relative z-10 mx-auto max-w-[64rem] px-5 sm:px-7 lg:px-10">
        <div className="mb-10 text-center">
          <motion.p
            {...viewAnim(8)}
            className="section-kicker justify-center"
          >
            What&apos;s next
          </motion.p>
          <motion.h2
            {...viewAnim(14, 0.08)}
            className="mt-3 font-[family-name:var(--font-sora)] text-[1.8rem] font-bold leading-tight text-white sm:text-[2.4rem]"
          >
            The <span className="text-emphasis-blue">roadmap.</span>
          </motion.h2>
        </div>

        <AnchorLine variant="gold" className="mb-10" />

        {/* ── Building lane ────────────────────────── */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px w-6 bg-[#8ec8ff]/40" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#8ec8ff]">
              Building
            </span>
            <div className="h-px flex-1 bg-[#8ec8ff]/10" />
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {buildingEntries.map((entry, laneIdx) => {
              const globalIdx = laneIdx;
              return (
                <FlipCard
                  key={entry.title}
                  entry={entry}
                  index={laneIdx}
                  isFlipped={flippedSet.has(globalIdx)}
                  isDimmed={false}
                  onFlip={() => handleFlip(globalIdx)}
                  reduce={reduce}
                />
              );
            })}
          </div>
        </div>

        {/* ── Planned lane ─────────────────────────── */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px w-6 bg-gold/40" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gold">
              Planned
            </span>
            <div className="h-px flex-1 bg-gold/10" />
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {plannedEntries.map((entry, laneIdx) => {
              const globalIdx = buildingEntries.length + laneIdx;
              return (
                <FlipCard
                  key={entry.title}
                  entry={entry}
                  index={laneIdx}
                  isFlipped={flippedSet.has(globalIdx)}
                  isDimmed={false}
                  onFlip={() => handleFlip(globalIdx)}
                  reduce={reduce}
                />
              );
            })}
          </div>
        </div>

        {/* ── Want to add on? CTA ──────────────────── */}
        <motion.div
          {...viewAnim(18, 0.2)}
          className="rounded-xl border border-white/8 bg-white/[0.03] px-5 py-5"
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold/70">
                Want to add on?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                Bug reports, feature ideas, prereq corrections — I read everything.
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              <a href="https://www.instagram.com/_markie.tan/" target="_blank" rel="noopener noreferrer">
                <Button
                  variant="gold"
                  size="sm"
                  className="border border-gold/60 shadow-[0_0_20px_rgba(255,204,0,0.18)]"
                >
                  Text Me
                </Button>
              </a>
              <Link href="/planner">
                <Button
                  variant="secondary"
                  size="sm"
                  className="border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,114,206,0.10))] text-white hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(0,114,206,0.14))]"
                >
                  Use the Planner
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
