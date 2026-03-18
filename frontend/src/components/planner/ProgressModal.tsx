"use client";

import { useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BucketDetailState, BucketProgress, Course, CreditKpiMetrics } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { ProgressRing } from "./ProgressRing";
import { groupProgressByTierWithMajors, buildCourseCreditMap, sumCreditsForCourseCodes, computeCreditKpiMetrics } from "@/lib/rendering";
import { getProgressQuip } from "@/lib/quips";
import { BucketSectionTabs } from "./BucketSectionTabs";
import { BucketCourseModal } from "./BucketCourseModal";

interface ProgressModalProps {
  open: boolean;
  onClose: () => void;
  metrics: CreditKpiMetrics;
  currentProgress?: Record<string, BucketProgress> | null;
  assumptionNotes?: string[] | null;
  courses: Course[];
  programLabelMap?: Map<string, string>;
  programOrder?: string[];
  declaredMajors?: string[];
  onCourseClick?: (courseCode: string) => void;
  rawCompleted?: Set<string>;
  rawInProgress?: Set<string>;
}

export function ProgressModal({
  open,
  onClose,
  metrics,
  currentProgress,
  assumptionNotes,
  courses,
  programLabelMap,
  programOrder,
  declaredMajors,
  onCourseClick,
  rawCompleted,
  rawInProgress,
}: ProgressModalProps) {
  const sections = groupProgressByTierWithMajors(currentProgress, programLabelMap, programOrder);
  const allNotes = useMemo(
    () => (assumptionNotes || []).map((n) => n.trim()).filter(Boolean),
    [assumptionNotes],
  );
  const scopeNote = useMemo(
    () => allNotes.find((n) => n.startsWith("Inference scope:")) ?? null,
    [allNotes],
  );
  const detailNotes = useMemo(
    () => allNotes.filter((n) => n !== scopeNote),
    [allNotes, scopeNote],
  );
  const hasAssumptions = allNotes.length > 0 && rawCompleted !== undefined;
  const [assumptionsOn, setAssumptionsOn] = useState(true);
  const [bucketDetail, setBucketDetail] = useState<BucketDetailState | null>(null);
  const bucketTriggerRef = useRef<HTMLButtonElement | null>(null);

  const creditMap = useMemo(() => buildCourseCreditMap(courses), [courses]);
  const rawMetrics = useMemo(() => {
    if (!rawCompleted) return metrics;
    const completedCredits = sumCreditsForCourseCodes(rawCompleted, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(rawInProgress ?? new Set(), creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [rawCompleted, rawInProgress, creditMap, metrics]);

  const activeMetrics = hasAssumptions && !assumptionsOn ? rawMetrics : metrics;

  const handleClose = () => {
    setBucketDetail(null);
    onClose();
  };

  const closeBucketDetail = () => {
    setBucketDetail(null);
    window.setTimeout(() => {
      bucketTriggerRef.current?.focus();
    }, 0);
  };

  const openBucketDetail = (bucket: {
    bucketId: string;
    bucketLabel: string;
    progress: BucketProgress;
    triggerEl: HTMLButtonElement;
  }) => {
    bucketTriggerRef.current = bucket.triggerEl;
    setBucketDetail({
      bucketId: bucket.bucketId,
      bucketLabel: bucket.bucketLabel,
      mode: "current",
      completedCodes: bucket.progress.completed_applied ?? [],
      inProgressCodes: bucket.progress.in_progress_applied ?? [],
    });
  };

  const handleBucketCourseClick = (courseCode: string) => {
    setBucketDetail(null);
    onCourseClick?.(courseCode);
  };

  return (
    <>
      <Modal open={open} onClose={handleClose} size="planner-detail" title="Degree Progress">
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="shrink-0 ring-glow float-soft">
              <ProgressRing
                pct={activeMetrics.donePercent}
                inProgressPct={activeMetrics.inProgressPercent}
                displayPct={activeMetrics.overallPercent}
                size={176}
                stroke={15}
              />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3.5">
              <MetricCard
                label="Completed"
                value={activeMetrics.completedCredits}
                unit="credits"
                color="text-ok"
                delay={0.05}
              />
              <MetricCard
                label="In Progress"
                value={activeMetrics.inProgressCredits}
                unit="credits"
                color="text-gold"
                delay={0.1}
              />
              <MetricCard
                label="Remaining"
                value={activeMetrics.remainingCredits}
                unit="credits"
                color="text-bad"
                detail={`to ${activeMetrics.minGradCredits}`}
                delay={0.15}
              />
              <MetricCard
                label="Target"
                value={activeMetrics.minGradCredits}
                unit="credits"
                color="text-ink-faint"
                delay={0.2}
              />
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="pt-1 text-center text-[0.96rem] italic text-ink-muted"
          >
            {getProgressQuip({ metrics: activeMetrics, currentProgress: currentProgress ?? null, declaredMajors })}
          </motion.p>

          <div className="divider-fade" />

          {hasAssumptions && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[0.98rem] font-semibold uppercase tracking-wider text-gold hash-mark">
                  Prereq Assumptions
                </h3>
                <button
                  type="button"
                  onClick={() => setAssumptionsOn((prev) => !prev)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    assumptionsOn
                      ? "border-gold/30 bg-gold/10 text-gold"
                      : "border-border-medium bg-surface-card text-ink-faint"
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full transition-colors ${
                      assumptionsOn ? "bg-gold" : "bg-ink-faint/40"
                    }`}
                  />
                  {assumptionsOn ? "On" : "Off"}
                </button>
              </div>
              <AnimatePresence initial={false}>
                {assumptionsOn && allNotes.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-gold/20 bg-gold/8 px-4 py-3 space-y-2">
                      {detailNotes.map((note) => (
                        <p key={note} className="text-[0.96rem] leading-relaxed text-ink-secondary">
                          {note}
                        </p>
                      ))}
                      {scopeNote && (
                        <p className="text-xs text-ink-faint leading-relaxed">
                          {scopeNote}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {!hasAssumptions && (
            <div className="space-y-3">
              <h3 className="text-[0.98rem] font-semibold uppercase tracking-wider text-gold hash-mark">
                Assumptions Applied
              </h3>
              <div className="rounded-xl glass-card stat-card-decor p-4">
                <p className="relative z-[1] text-[0.96rem] text-ink-faint">
                  No assumptions applied.
                </p>
              </div>
            </div>
          )}

          <div className="text-center">
            <span className="text-[0.96rem] text-ink-faint">Current Standing: </span>
            <span className="text-[0.96rem] font-semibold text-gold drop-shadow-[0_0_8px_rgba(255,204,0,0.3)]">
              {activeMetrics.standingLabel}
            </span>
          </div>

          <div className="divider-fade" />

          {sections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[0.88rem] font-semibold uppercase tracking-wider text-gold hash-mark">
                Requirement Breakdown
              </h3>
              <BucketSectionTabs
                sections={sections}
                programLabelMap={programLabelMap}
                onBucketClick={openBucketDetail}
                layoutId="progress-modal-sections"
              />
            </div>
          )}
        </div>
      </Modal>
      {bucketDetail && (
        <BucketCourseModal
          open={bucketDetail !== null}
          onClose={closeBucketDetail}
          bucketLabel={bucketDetail.bucketLabel}
          mode={bucketDetail.mode}
          completedCodes={bucketDetail.completedCodes}
          inProgressCodes={bucketDetail.inProgressCodes}
          courses={courses}
          onCourseClick={handleBucketCourseClick}
        />
      )}
    </>
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
      className={`glass-card ${glowClass} rounded-xl p-3 text-center stat-card-decor`}
    >
      <div
        className={`text-[1.65rem] font-bold font-[family-name:var(--font-sora)] tabular-nums ${color}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <AnimatedNumber value={value} />
      </div>
      <div className="text-[0.82rem] text-ink-faint">{unit}</div>
      <div className="mt-1 text-[0.82rem] text-ink-muted">{label}</div>
      {detail && <div className="text-[0.82rem] text-ink-faint">{detail}</div>}
    </motion.div>
  );
}
