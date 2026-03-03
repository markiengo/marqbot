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

function formatTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

function resolveProgramLabels(ids: string[], collection: { id: string; label: string }[]): string[] {
  const labelById = new Map(collection.map((item) => [item.id, item.label]));
  return ids.map((id) => labelById.get(id) || id);
}

function SemesterCard({ sem, index }: { sem: SemesterData; index: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-[#0d1f3c]/60 p-3 space-y-2 border-l-2 border-l-gold/30">
      <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">
        Semester {index + 1}
        {sem.target_semester ? ` \u00b7 ${sem.target_semester}` : ""}
        {sem.standing_label ? ` \u00b7 ${sem.standing_label}` : ""}
      </p>
      {(sem.recommendations ?? []).length === 0 ? (
        <p className="text-xs text-ink-faint italic pl-1">All requirements satisfied.</p>
      ) : (
        (sem.recommendations ?? []).map((c) => (
          <div key={c.course_code} className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs w-[5.5rem] shrink-0 text-ink-primary">{c.course_code}</span>
              <span className="text-xs text-ink-secondary truncate flex-1">{c.course_name}</span>
            </div>
            {(c.fills_buckets ?? []).length > 0 && (
              <div className="flex gap-1 flex-wrap pl-[calc(5.5rem+0.5rem)]">
                {(c.fills_buckets ?? []).map((b) => (
                  <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80 border border-gold/20">
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
        <div className="space-y-5">
          {/* Freshness + timestamp */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <FreshnessBadge freshness={freshness} />
            <span>Updated {formatTimestamp(plan.updatedAt)}</span>
            {plan.notes && (
              <span className="text-ink-secondary italic">&mdash; {plan.notes}</span>
            )}
          </div>

          {/* Metadata strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
            {majorLabels.length > 0 && (
              <span>
                <span className="text-ink-faint">Major </span>
                {majorLabels.join(", ")}
              </span>
            )}
            {trackLabels.length > 0 && (
              <span>
                <span className="text-ink-faint">Track </span>
                {trackLabels.join(", ")}
              </span>
            )}
            <span>
              <span className="text-ink-faint">Target </span>
              {plan.inputs.targetSemester}
            </span>
            <span>
              <span className="text-ink-faint">Semesters </span>
              {plan.inputs.semesterCount}
            </span>
            <span>
              <span className="text-ink-faint">Max/sem </span>
              {plan.inputs.maxRecs}
            </span>
          </div>

          {/* Credit progress bar */}
          {metrics && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-faint">
                <span>{metrics.completedCredits} cr done</span>
                <span>{metrics.inProgressCredits} cr in progress</span>
                <span className="font-medium text-ink-secondary">{metrics.standingLabel}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold transition-all"
                  style={{ width: `${Math.min(metrics.donePercent, 100)}%` }}
                />
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
                  <p className={`text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2 ${yearIdx > 0 ? "mt-5" : "mt-3"}`}>
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
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-bad hover:bg-bad-light/25"
            >
              Delete
            </Button>
            <Button variant="gold" size="sm" onClick={handleLoadIntoPlanner}>
              Edit in Planner
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
