"use client";

import { useMemo } from "react";
import {
  buildCourseCreditMap,
  compactKpiBucketLabel,
  computeCreditKpiMetrics,
  sumCreditsForCourseCodes,
} from "@/lib/rendering";
import type {
  Course,
  ProgramsData,
  RecommendationResponse,
  SavedPlanRecord,
} from "@/lib/types";

interface SavedPlanSnapshotProps {
  plan: SavedPlanRecord;
  courses: Course[];
  programs: ProgramsData;
}

function resolveProgramLabels(ids: string[], collection: { id: string; label: string }[]): string[] {
  const labelById = new Map(collection.map((item) => [item.id, item.label]));
  return ids.map((id) => labelById.get(id) || id);
}

function SemesterList({ data }: { data: RecommendationResponse }) {
  const semesters = data.semesters ?? [];
  if (semesters.length === 0) return <p className="text-sm text-ink-faint">No recommendation data.</p>;
  return (
    <div className="space-y-4">
      {semesters.map((sem, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">
            Semester {i + 1}
            {sem.target_semester ? ` \u00b7 ${sem.target_semester}` : ""}
            {sem.standing_label ? ` \u00b7 ${sem.standing_label}` : ""}
          </p>
          {(sem.recommendations ?? []).length === 0 ? (
            <p className="text-xs text-ink-faint pl-2 italic">All requirements satisfied.</p>
          ) : (
            (sem.recommendations ?? []).map((c) => (
              <div key={c.course_code} className="flex items-baseline gap-2 pl-2">
                <span className="text-xs font-mono text-ink-primary shrink-0">{c.course_code}</span>
                <span className="text-xs text-ink-secondary truncate flex-1">{c.course_name}</span>
                <div className="flex gap-1 shrink-0 flex-wrap">
                  {(c.fills_buckets ?? []).map((b) => (
                    <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/80 border border-gold/20">
                      {compactKpiBucketLabel(b)}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

export function SavedPlanSnapshot({ plan, courses, programs }: SavedPlanSnapshotProps) {
  const creditMap = useMemo(() => buildCourseCreditMap(courses), [courses]);
  const metrics = useMemo(() => {
    const completedCredits = sumCreditsForCourseCodes(plan.inputs.completed, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(plan.inputs.inProgress, creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [creditMap, plan.inputs.completed, plan.inputs.inProgress]);
  const majorLabels = useMemo(
    () => resolveProgramLabels(plan.inputs.declaredMajors, programs.majors),
    [plan.inputs.declaredMajors, programs.majors],
  );
  const trackLabels = useMemo(
    () => resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks),
    [plan.inputs.declaredTracks, programs.tracks],
  );

  return (
    <div className="space-y-4">
      {/* Settings strip */}
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

      {/* Semester list */}
      {plan.recommendationData ? (
        <SemesterList data={plan.recommendationData} />
      ) : (
        <p className="text-sm text-ink-faint italic">No saved recommendations.</p>
      )}
    </div>
  );
}
