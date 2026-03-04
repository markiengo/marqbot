"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { useAppContext } from "@/context/AppContext";
import { buildSessionSnapshotFromSavedPlan } from "@/lib/savedPlans";
import {
  buildCourseCreditMap,
  compactKpiBucketLabel,
  computeCreditKpiMetrics,
  sumCreditsForCourseCodes,
} from "@/lib/rendering";
import { formatSavedPlanDate, resolveProgramLabels } from "@/lib/savedPlanPresentation";
import { FreshnessBadge } from "./FreshnessBadge";
import type {
  Course,
  ProgramsData,
  SavedPlanFreshness,
  SavedPlanRecord,
  SemesterData,
} from "@/lib/types";

interface SavedPlanViewModalProps {
  open: boolean;
  plan: SavedPlanRecord | null;
  freshness: SavedPlanFreshness;
  courses: Course[];
  programs: ProgramsData;
  onClose(): void;
  onDelete(): void;
}

function SemesterCard({ sem, index }: { sem: SemesterData; index: number }) {
  return (
    <div className="relative overflow-hidden rounded-xl glass-card stat-card-decor card-glow-hover p-3 space-y-2 border-l-2 border-l-gold/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,204,0,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(0,114,206,0.05),transparent_55%)] pointer-events-none" />
      <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide relative z-[1]">
        Semester {index + 1}
        {sem.target_semester ? ` \u00b7 ${sem.target_semester}` : ""}
        {sem.standing_label ? ` \u00b7 ${sem.standing_label}` : ""}
      </p>
      {(sem.recommendations ?? []).length === 0 ? (
        <p className="text-xs text-ink-faint italic pl-1 relative z-[1]">All requirements satisfied.</p>
      ) : (
        (sem.recommendations ?? []).map((c) => (
          <div key={c.course_code} className="space-y-0.5 relative z-[1]">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs w-[5.5rem] shrink-0 text-mu-blue">{c.course_code}</span>
              <span className="text-xs text-ink-secondary truncate flex-1">{c.course_name}</span>
            </div>
            {(c.fills_buckets ?? []).length > 0 && (
              <div className="flex gap-1 flex-wrap pl-[calc(5.5rem+0.5rem)]">
                {(c.fills_buckets ?? []).map((b) => (
                  <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-gold/12 text-gold border border-gold/25">
                    {compactKpiBucketLabel(b)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export function SavedPlanViewModal({
  open,
  plan,
  freshness,
  courses,
  programs,
  onClose,
  onDelete,
}: SavedPlanViewModalProps) {
  const router = useRouter();
  const { dispatch } = useAppContext();

  // useMemo must be declared before any early returns
  const creditMap = useMemo(() => buildCourseCreditMap(courses), [courses]);
  const metrics = useMemo(() => {
    if (!plan) return null;
    const completedCredits = sumCreditsForCourseCodes(plan.inputs.completed, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(plan.inputs.inProgress, creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [creditMap, plan]);

  const majorLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredMajors, programs.majors) : []),
    [plan, programs.majors],
  );
  const trackLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks) : []),
    [plan, programs.tracks],
  );

  const handleLoadIntoPlanner = () => {
    if (!plan) return;
    dispatch({
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: buildSessionSnapshotFromSavedPlan(plan),
    });
    onClose();
    router.push("/planner");
  };

  const semesters = plan?.recommendationData?.semesters ?? [];
  const cols = plan?.inputs.includeSummer ? 3 : 2;
  const rows: SemesterData[][] = [];
  for (let i = 0; i < semesters.length; i += cols) {
    rows.push(semesters.slice(i, i + cols));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={plan?.name ?? ""}
      titleClassName="text-lg font-semibold font-[family-name:var(--font-sora)] text-ink-primary"
    >
      {!plan ? null : (
        <div className="relative space-y-5">
          <div className="absolute -inset-4 bg-[radial-gradient(ellipse_at_top_right,rgba(255,204,0,0.04),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(0,114,206,0.05),transparent_50%)] pointer-events-none" />
          {/* Freshness + timestamp */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <FreshnessBadge freshness={freshness} />
            <span>Updated {formatSavedPlanDate(plan.updatedAt)}</span>
            {plan.notes && (
              <span className="text-ink-secondary italic">&mdash; {plan.notes}</span>
            )}
          </div>

          {/* Metadata strip */}
          <div className="flex flex-wrap gap-1.5">
            {majorLabels.length > 0 && (
              <span className="rounded-full glass-card px-2.5 py-1 text-xs text-ink-secondary">
                <span className="text-ink-faint">Major </span>
                {majorLabels.join(", ")}
              </span>
            )}
            {trackLabels.length > 0 && (
              <span className="rounded-full glass-card px-2.5 py-1 text-xs text-ink-secondary">
                <span className="text-ink-faint">Track </span>
                {trackLabels.join(", ")}
              </span>
            )}
            <span className="rounded-full glass-card px-2.5 py-1 text-xs text-ink-secondary">
              <span className="text-ink-faint">Target </span>
              {plan.inputs.targetSemester}
            </span>
            <span className="rounded-full glass-card px-2.5 py-1 text-xs text-ink-secondary">
              <span className="text-ink-faint">Semesters </span>
              {plan.inputs.semesterCount}
            </span>
            <span className="rounded-full glass-card px-2.5 py-1 text-xs text-ink-secondary">
              <span className="text-ink-faint">Max/sem </span>
              {plan.inputs.maxRecs}
            </span>
          </div>

          <div className="divider-fade" />

          {/* Credit progress bar */}
          {metrics && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-faint">
                <span>{metrics.completedCredits} cr done</span>
                <span className="text-gold/70">{metrics.inProgressCredits} cr in progress</span>
                <span className="font-medium text-gold drop-shadow-[0_0_6px_rgba(255,204,0,0.25)]">{metrics.standingLabel}</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-hover overflow-hidden flex">
                <div
                  className="h-full rounded-l-full bg-gradient-to-r from-ok/80 to-ok bar-animate-in bar-glow-ok shrink-0"
                  style={{ width: `${Math.min(metrics.donePercent, 100)}%` }}
                />
                {metrics.inProgressCredits > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-gold/50 to-gold/30 bar-animate-in shrink-0"
                    style={{ width: `${Math.min((metrics.inProgressCredits / 120) * 100, 100 - metrics.donePercent)}%` }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Year grid */}
          {!plan.recommendationData ? (
            <p className="text-sm text-ink-faint italic">No saved recommendations.</p>
          ) : (
            <div>
              {rows.map((row, yearIdx) => (
                <div key={yearIdx}>
                  <p className={`section-kicker !text-[10px] mb-2 ${yearIdx > 0 ? "mt-5" : "mt-3"}`}>
                    Year {yearIdx + 1}
                  </p>
                  <div className={`grid gap-3 ${row.length === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
                    {row.map((sem, i) => (
                      <SemesterCard key={yearIdx * cols + i} sem={sem} index={yearIdx * cols + i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="divider-fade" />
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-bad hover:bg-bad-light/25"
            >
              Delete
            </Button>
            <Button variant="gold" size="sm" onClick={handleLoadIntoPlanner} className="shadow-[0_0_24px_rgba(255,204,0,0.22)] pulse-gold-soft">
              Edit in Planner
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
