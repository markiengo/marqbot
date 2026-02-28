"use client";

import type { CreditKpiMetrics, BucketProgress } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { ProgressRing } from "./ProgressRing";
import { groupProgressByParent, compactKpiBucketLabel, getBucketDisplay } from "@/lib/rendering";
import { bucketLabel } from "@/lib/utils";

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  metrics: CreditKpiMetrics;
  currentProgress?: Record<string, BucketProgress> | null;
  assumptionNotes?: string[] | null;
  programLabelMap?: Map<string, string>;
}

export function ProgressModal({
  open,
  onClose,
  metrics,
  currentProgress,
  assumptionNotes,
  programLabelMap,
}: ProgressModalProps) {
  const groups = groupProgressByParent(currentProgress, programLabelMap);
  const notes = (assumptionNotes || []).filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} size="planner-detail" title="Degree Progress">
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
              detail={`to ${metrics.minGradCredits}`}
            />
            <MetricCard
              label="Target"
              value={`${metrics.minGradCredits}`}
              unit="credits"
              color="text-ink-faint"
            />
          </div>
        </div>

        {/* Assumption notes */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gold uppercase tracking-wider">
            Assumptions Applied
          </h3>
          <div className="rounded-xl border border-border-subtle/50 bg-surface-card/40 p-4 space-y-2">
            {notes.length > 0 ? (
              notes.map((note) => (
                <p key={note} className="text-sm text-ink-secondary leading-relaxed">
                  {note}
                </p>
              ))
            ) : (
              <p className="text-sm text-ink-faint">
                No prerequisite assumptions were applied for this plan.
              </p>
            )}
          </div>
        </div>

        {/* Standing */}
        <div className="text-center">
          <span className="text-sm text-ink-faint">Current Standing: </span>
          <span className="text-sm font-semibold text-gold">
            {metrics.standingLabel}
          </span>
        </div>

        {/* Bucket breakdown — grouped by program */}
        {groups.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gold uppercase tracking-wider">
              Requirement Breakdown
            </h3>
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.parentId} className="space-y-3">
                  <h4 className="text-xs font-semibold text-gold/70 uppercase tracking-wider border-b border-border-subtle/30 pb-1">
                    {group.label}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.entries.map(([bid, prog]) => {
                      const { done, inProg, needed, unit } = getBucketDisplay(prog);
                      const ipCodes = prog.in_progress_applied || [];
                      const label = compactKpiBucketLabel(
                        prog.label || bucketLabel(bid, programLabelMap),
                      );
                      const creditNeeded = Number(prog.needed || 0);
                      const creditDone = Number(prog.completed_done ?? prog.done_count ?? 0);
                      const creditInProg = Number(prog.in_progress_increment ?? 0);
                      const pct = creditNeeded > 0 ? (creditDone / creditNeeded) * 100 : 0;
                      const totalPct = creditNeeded > 0 ? ((creditDone + creditInProg) / creditNeeded) * 100 : 0;
                      const satisfied = prog.satisfied || (creditNeeded > 0 && creditDone >= creditNeeded);

                      return (
                        <div
                          key={bid}
                          className={`rounded-xl border border-border-subtle/50 p-4 h-full ${satisfied ? "opacity-60" : ""}`}
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
                              /{needed} {unit}
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
                              In progress courses: {ipCodes.join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
  detail,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  detail?: string;
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
      {detail && <div className="text-xs text-ink-faint">{detail}</div>}
    </div>
  );
}
