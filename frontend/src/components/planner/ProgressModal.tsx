"use client";

import { motion } from "motion/react";
import type { CreditKpiMetrics, BucketProgress } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { ProgressRing } from "./ProgressRing";
import { groupProgressByTierWithMajors } from "@/lib/rendering";
import { getProgressQuip } from "@/lib/quips";
import { BucketProgressGrid } from "./BucketProgressGrid";

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  metrics: CreditKpiMetrics;
  currentProgress?: Record<string, BucketProgress> | null;
  assumptionNotes?: string[] | null;
  programLabelMap?: Map<string, string>;
  programOrder?: string[];
  declaredMajors?: string[];
}

export function ProgressModal({
  open,
  onClose,
  metrics,
  currentProgress,
  assumptionNotes,
  programLabelMap,
  programOrder,
  declaredMajors,
}: ProgressModalProps) {
  const sections = groupProgressByTierWithMajors(currentProgress, programLabelMap, programOrder);
  const notes = (assumptionNotes || []).filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} size="planner-detail" title="Degree Progress">
      <div className="space-y-10">
        {/* Top section: ring + credit metrics */}
        <div className="flex flex-col sm:flex-row items-center gap-10">
          <div className="shrink-0 ring-glow float-soft">
            <ProgressRing
              pct={metrics.donePercent}
              inProgressPct={metrics.inProgressPercent}
              displayPct={metrics.overallPercent}
              size={208}
              stroke={18}
            />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-5">
            <MetricCard
              label="Completed"
              value={metrics.completedCredits}
              unit="credits"
              color="text-ok"
              delay={0.05}
            />
            <MetricCard
              label="In Progress"
              value={metrics.inProgressCredits}
              unit="credits"
              color="text-gold"
              delay={0.1}
            />
            <MetricCard
              label="Remaining"
              value={metrics.remainingCredits}
              unit="credits"
              color="text-bad"
              detail={`to ${metrics.minGradCredits}`}
              delay={0.15}
            />
            <MetricCard
              label="Target"
              value={metrics.minGradCredits}
              unit="credits"
              color="text-ink-faint"
              delay={0.2}
            />
          </div>
        </div>

        {/* Contextual quip */}
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[1.05rem] text-ink-muted italic py-3"
        >
          {getProgressQuip({ metrics, currentProgress: currentProgress ?? null, declaredMajors })}
        </motion.p>

        <div className="divider-fade" />

        {/* Assumption notes */}
        <div className="space-y-4">
          <h3 className="text-[1.05rem] font-semibold text-gold uppercase tracking-wider hash-mark">
            Assumptions Applied
          </h3>
          <div className="rounded-xl glass-card stat-card-decor p-5 space-y-3">
            {notes.length > 0 ? (
              notes.map((note) => (
                <p key={note} className="text-[1.05rem] text-ink-secondary leading-relaxed relative z-[1]">
                  {note}
                </p>
              ))
            ) : (
              <p className="text-[1.05rem] text-ink-faint relative z-[1]">
                No assumptions applied. Clean slate.
              </p>
            )}
          </div>
        </div>

        {/* Standing */}
        <div className="text-center">
          <span className="text-[1.05rem] text-ink-faint">Current Standing: </span>
          <span className="text-[1.05rem] font-semibold text-gold drop-shadow-[0_0_8px_rgba(255,204,0,0.3)]">
            {metrics.standingLabel}
          </span>
        </div>

        <div className="divider-fade" />

        {/* Bucket breakdown — grouped by program */}
        {sections.length > 0 && (
          <div className="space-y-5">
            <h3 className="text-[1.05rem] font-semibold text-gold uppercase tracking-wider hash-mark">
              Requirement Breakdown
            </h3>
            <div className="space-y-7">
              {sections.map((section) => (
                <div key={section.sectionKey} className="space-y-4">
                  <h4 className="text-[1.05rem] font-bold text-mu-blue uppercase tracking-wider border-b border-border-subtle/30 pb-1.5">
                    {section.label}
                  </h4>
                  {section.subGroups ? (
                    <div className="space-y-6">
                      {section.subGroups.map((group) => (
                        <div key={group.parentId} className="space-y-3">
                          <p className="text-sm font-semibold text-ink-secondary uppercase tracking-wider pl-1">
                            {group.label}
                          </p>
                          <BucketProgressGrid entries={group.entries} programLabelMap={programLabelMap} stripParentPrefix />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <BucketProgressGrid entries={section.entries} programLabelMap={programLabelMap} />
                  )}
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
  delay = 0,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  detail?: string;
  delay?: number;
}) {
  const glowClass = color.includes("ok")
    ? "kpi-glow-ok"
    : color.includes("gold")
      ? "kpi-glow-gold"
      : color.includes("bad")
        ? "kpi-glow-bad"
        : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      transition={{ duration: 0.25, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-card ${glowClass} rounded-xl p-4 text-center stat-card-decor`}
    >
      <div className={`text-[2rem] font-bold font-[family-name:var(--font-sora)] tabular-nums ${color}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        <AnimatedNumber value={value} />
      </div>
      <div className="text-sm text-ink-faint">
        {unit}
      </div>
      <div className="text-sm text-ink-muted mt-1">{label}</div>
      {detail && <div className="text-sm text-ink-faint">{detail}</div>}
    </motion.div>
  );
}
