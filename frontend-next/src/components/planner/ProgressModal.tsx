"use client";

import type { CreditKpiMetrics, BucketProgress } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { ProgressRing } from "./ProgressRing";
import { sortProgressEntries, compactKpiBucketLabel } from "@/lib/rendering";
import { bucketLabel } from "@/lib/utils";

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  metrics: CreditKpiMetrics;
  currentProgress?: Record<string, BucketProgress> | null;
  programLabelMap?: Map<string, string>;
}

export function ProgressModal({
  open,
  onClose,
  metrics,
  currentProgress,
  programLabelMap,
}: ProgressModalProps) {
  const entries = currentProgress ? sortProgressEntries(currentProgress) : [];

  return (
    <Modal open={open} onClose={onClose} size="large" title="Degree Progress">
      <div className="space-y-8">
        {/* Top section: ring + credit metrics */}
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="shrink-0">
            <ProgressRing
              pct={metrics.donePercent}
              inProgressPct={metrics.inProgressPercent}
              displayPct={metrics.overallPercent}
              size={160}
              stroke={14}
            />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <MetricCard
              label="Completed"
              value={`${metrics.completedCredits}`}
              unit="credits"
              color="text-ok"
            />
            <MetricCard
              label="In Progress"
              value={`${metrics.inProgressCredits}`}
              unit="credits"
              color="text-gold"
            />
            <MetricCard
              label="Remaining"
              value={`${metrics.remainingCredits}`}
              unit="credits"
              color="text-bad"
            />
            <MetricCard
              label="Target"
              value={`${metrics.minGradCredits}`}
              unit="credits"
              color="text-ink-faint"
            />
          </div>
        </div>

        {/* Standing */}
        <div className="text-center">
          <span className="text-sm text-ink-faint">Current Standing: </span>
          <span className="text-sm font-semibold text-gold">
            {metrics.standingLabel}
          </span>
        </div>

        {/* Bucket breakdown */}
        {entries.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gold uppercase tracking-wider">
              Requirement Breakdown
            </h3>
            <div className="space-y-3">
              {entries.map(([bid, prog]) => {
                const needed = Number(prog.needed || 0);
                const done = Number(prog.completed_done || prog.done_count || 0);
                const ipCodes = prog.in_progress_applied || [];
                const inProg = Number(prog.in_progress_increment || ipCodes.length || 0);
                const label = compactKpiBucketLabel(
                  prog.label || bucketLabel(bid, programLabelMap),
                );
                const pct = needed > 0 ? (done / needed) * 100 : 0;
                const totalPct = needed > 0 ? ((done + inProg) / needed) * 100 : 0;
                const satisfied = prog.satisfied || (needed > 0 && done >= needed);

                return (
                  <div
                    key={bid}
                    className={`rounded-xl border border-border-subtle/50 p-4 ${satisfied ? "opacity-60" : ""}`}
                  >
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-sm font-medium text-ink-primary">
                        {label}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {done}
                        {inProg > 0 && (
                          <span className="text-gold">+{inProg}</span>
                        )}
                        /{needed}
                        {satisfied && (
                          <span className="text-ok ml-1">(Done)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="h-full bg-ok rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                        {inProg > 0 && (
                          <div
                            className="h-full bg-gold rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100 - Math.min(100, pct), totalPct - pct)}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    {ipCodes.length > 0 && (
                      <p className="text-xs text-gold/70 mt-1.5">
                        In progress: {ipCodes.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MetricCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="bg-surface-card/60 rounded-xl border border-border-subtle/50 p-3 text-center">
      <div className={`text-2xl font-bold font-[family-name:var(--font-sora)] ${color}`}>
        {value}
      </div>
      <div className="text-xs text-ink-faint">
        {unit}
      </div>
      <div className="text-xs text-ink-muted mt-0.5">{label}</div>
    </div>
  );
}
