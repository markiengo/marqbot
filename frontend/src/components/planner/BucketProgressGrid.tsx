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
}

/**
 * Shared bucket progress grid used by both ProgressModal and SemesterModal.
 * Renders a responsive grid of bucket cards with dual-segment progress bars.
 */
export function BucketProgressGrid({
  entries,
  programLabelMap,
  animate = true,
}: BucketProgressGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {entries.map(([bid, prog], idx) => {
        const { done, inProg, needed, unit } = getBucketDisplay(prog);
        const ipCodes = prog.in_progress_applied || [];
        const label = compactKpiBucketLabel(
          prog.label || bucketLabel(bid, programLabelMap),
        );
        const creditNeeded = Number(prog.needed || 0);
        const creditDone = Number(prog.completed_done ?? prog.done_count ?? 0);
        const creditInProg = Number(prog.in_progress_increment ?? 0);
        const pct = creditNeeded > 0 ? (creditDone / creditNeeded) * 100 : 0;
        const totalPct =
          creditNeeded > 0
            ? ((creditDone + creditInProg) / creditNeeded) * 100
            : 0;
        const satisfied =
          prog.satisfied || (creditNeeded > 0 && creditDone >= creditNeeded);

        const card = (
          <div
            className={`rounded-xl glass-card card-glow-hover p-5 h-full flex flex-col gap-2 stat-card-decor ${satisfied ? "opacity-60" : ""}`}
          >
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[1.05rem] font-medium text-ink-primary leading-snug">
                {label}
              </span>
              <span className="text-sm text-ink-faint shrink-0 tabular-nums">
                {done}
                {inProg > 0 && <span className="text-gold">+{inProg}</span>}
                /{needed} {unit}
                {satisfied && <span className="text-ok ml-1">(Done)</span>}
              </span>
            </div>

            {/* Dual-segment progress bar with glow */}
            <div className="h-3.5 bg-surface-hover rounded-full overflow-hidden">
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
                      width: `${Math.min(100 - Math.min(100, pct), totalPct - pct)}%`,
                      animationDelay: animate ? `${idx * 0.04 + 0.15}s` : undefined,
                    }}
                  />
                )}
              </div>
            </div>

            {ipCodes.length > 0 && (
              <p className="text-sm text-gold/70 leading-snug">
                In progress: {ipCodes.join(", ")}
              </p>
            )}
          </div>
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
