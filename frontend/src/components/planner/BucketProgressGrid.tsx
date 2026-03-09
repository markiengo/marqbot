"use client";

import { motion } from "motion/react";
import type { BucketProgress } from "@/lib/types";
import { compactKpiBucketLabel, getBucketDisplay } from "@/lib/rendering";
import { bucketLabel } from "@/lib/utils";

interface BucketProgressGridProps {
  entries: [string, BucketProgress][];
  programLabelMap?: Map<string, string>;
  /** Pass true to animate entries in with stagger (default: true) */
  animate?: boolean;
  /** Strip "Parent: " prefix from labels (used inside sub-groups where header shows parent) */
  stripParentPrefix?: boolean;
  onBucketClick?: (bucket: {
    bucketId: string;
    bucketLabel: string;
    progress: BucketProgress;
    triggerEl: HTMLButtonElement;
  }) => void;
}

/**
 * Shared bucket progress grid used by both ProgressModal and SemesterModal.
 * Renders a responsive grid of bucket cards with dual-segment progress bars.
 */
export function BucketProgressGrid({
  entries,
  programLabelMap,
  animate = true,
  stripParentPrefix = false,
  onBucketClick,
}: BucketProgressGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(([bid, prog], idx) => {
        const { done, inProg, needed, unit } = getBucketDisplay(prog);
        const ipCodes = prog.in_progress_applied || [];
        let rawLabel = prog.label || bucketLabel(bid, programLabelMap);
        if (stripParentPrefix) {
          const colonIdx = rawLabel.indexOf(": ");
          if (colonIdx > 0) rawLabel = rawLabel.slice(colonIdx + 2);
        }
        const label = compactKpiBucketLabel(rawLabel);
        const doneValue = Number(done || 0);
        const inProgValue = Number(inProg || 0);
        const neededValue = Number(needed || 0);
        const pctRaw = neededValue > 0 ? (doneValue / neededValue) * 100 : 0;
        const totalPctRaw =
          neededValue > 0
            ? ((doneValue + inProgValue) / neededValue) * 100
            : 0;
        const pct = Math.max(0, Math.min(100, pctRaw));
        const totalPct = Math.max(pct, Math.max(0, Math.min(100, totalPctRaw)));
        const satisfied =
          prog.satisfied || (neededValue > 0 && doneValue + inProgValue >= neededValue);

        const card = (
          <button
            type="button"
            onClick={(event) => onBucketClick?.({
              bucketId: bid,
              bucketLabel: label,
              progress: prog,
              triggerEl: event.currentTarget,
            })}
            aria-label={`${label}: ${done}${inProg > 0 ? ` plus ${inProg} in progress` : ""} of ${needed} ${unit}`}
            className={`w-full rounded-xl border border-border-card glass-card card-glow-hover px-4 py-3.5 text-left transition-colors hover:border-gold/30 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 h-full flex flex-col gap-2 stat-card-decor ${satisfied ? "opacity-70" : ""}`}
          >
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[0.98rem] font-medium text-ink-primary leading-snug">
                {label}
              </span>
              <span className="text-[0.82rem] text-ink-faint shrink-0 tabular-nums">
                {done}
                {inProg > 0 && <span className="text-gold">+{inProg}</span>}
                /{needed} {unit}
                {satisfied && <span className="text-ok ml-1">(Done)</span>}
              </span>
            </div>

            {/* Dual-segment progress bar with glow */}
            <div className="h-3 bg-surface-hover rounded-full overflow-hidden">
              <div className="h-full flex motion-reduce:transition-none">
                {pct > 0 && (
                  <div
                    className={`h-full bg-ok rounded-full ${animate ? "bar-animate-in" : ""} ${pct > 20 ? "bar-glow-ok" : ""}`}
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      animationDelay: animate ? `${idx * 0.04}s` : undefined,
                    }}
                  />
                )}
                {inProg > 0 && (
                  <div
                    className={`h-full bg-gold rounded-full ${animate ? "bar-animate-in" : ""} ${totalPct - pct > 10 ? "bar-glow-gold" : ""}`}
                    style={{
                      width: `${Math.max(0, Math.min(100 - pct, totalPct - pct))}%`,
                      animationDelay: animate ? `${idx * 0.04 + 0.15}s` : undefined,
                    }}
                  />
                )}
              </div>
            </div>

            {ipCodes.length > 0 && (
              <p className="text-xs text-gold/70 leading-snug">
                In progress: {ipCodes.join(", ")}
              </p>
            )}
          </button>
        );

        if (!animate) return <div key={bid}>{card}</div>;

        return (
          <motion.div
            key={bid}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
          >
            {card}
          </motion.div>
        );
      })}
    </div>
  );
}
