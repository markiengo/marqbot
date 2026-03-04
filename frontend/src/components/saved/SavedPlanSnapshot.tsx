"use client";

import { useMemo } from "react";
import { CourseCard } from "@/components/planner/CourseCard";
import {
  buildCourseCreditMap,
  computeCreditKpiMetrics,
  sumCreditsForCourseCodes,
} from "@/lib/rendering";
import { resolveProgramLabels } from "@/lib/savedPlanPresentation";
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

function SemesterList({
  data,
  programLabelMap,
}: {
  data: RecommendationResponse;
  programLabelMap?: Map<string, string>;
}) {
  const semesters = data.semesters ?? [];
  if (semesters.length === 0) return <p className="text-sm text-ink-faint">No recommendation data.</p>;
  return (
    <div className="space-y-6">
      {semesters.map((sem, i) => (
        <div key={i} className="relative space-y-4">
          <div className="absolute -inset-2 bg-[radial-gradient(ellipse_at_top,rgba(255,204,0,0.03),transparent_60%)] pointer-events-none" />
          <div className="relative space-y-2">
            <p className="section-kicker">
              Semester {i + 1}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {sem.target_semester ? (
                <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                  {sem.target_semester}
                </span>
              ) : null}
              {sem.standing_label ? (
                <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-gold/15 text-gold border border-gold/30 shadow-[0_0_10px_rgba(255,204,0,0.12)] pulse-gold-soft">
                  {sem.standing_label} Standing
                </span>
              ) : null}
            </div>
          </div>
          {(sem.recommendations ?? []).length === 0 ? (
            <p className="text-[1.05rem] text-ink-faint italic">All requirements satisfied.</p>
          ) : (
            <div className="space-y-4">
              {(sem.recommendations ?? []).map((c) => (
                <CourseCard
                  key={c.course_code}
                  course={c}
                  programLabelMap={programLabelMap}
                />
              ))}
            </div>
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
  const minorLabels = useMemo(
    () => resolveProgramLabels(plan.inputs.declaredMinors, programs.minors),
    [plan.inputs.declaredMinors, programs.minors],
  );
  const programLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    programs.majors.forEach((item) => map.set(item.id, item.label));
    programs.tracks.forEach((item) => map.set(item.id, item.label));
    programs.minors.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [programs]);

  return (
    <div className="relative space-y-5">
      <div className="absolute -inset-2 bg-[radial-gradient(ellipse_70%_30%_at_90%_0%,rgba(0,114,206,0.06),transparent),radial-gradient(ellipse_50%_40%_at_5%_100%,rgba(255,204,0,0.04),transparent)] pointer-events-none" />
      {/* Settings strip */}
      <div className="relative flex flex-wrap gap-2">
        {majorLabels.length > 0 && (
          <span className="text-sm px-3 py-1.5 rounded-full glass-card text-ink-secondary">
            <span className="text-ink-faint">Major </span>
            {majorLabels.join(", ")}
          </span>
        )}
        {trackLabels.length > 0 && (
          <span className="text-sm px-3 py-1.5 rounded-full glass-card text-ink-secondary">
            <span className="text-ink-faint">Track </span>
            {trackLabels.join(", ")}
          </span>
        )}
        {minorLabels.length > 0 && (
          <span className="text-sm px-3 py-1.5 rounded-full glass-card text-ink-secondary">
            <span className="text-ink-faint">Minor </span>
            {minorLabels.join(", ")}
          </span>
        )}
        <span className="text-sm px-3 py-1.5 rounded-full glass-card text-ink-secondary">
          <span className="text-ink-faint">Target </span>
          {plan.inputs.targetSemester}
        </span>
        <span className="text-sm px-3 py-1.5 rounded-full glass-card text-ink-secondary">
          <span className="text-ink-faint">Semesters </span>
          {plan.inputs.semesterCount}
        </span>
        <span className="text-sm px-3 py-1.5 rounded-full glass-card text-ink-secondary">
          <span className="text-ink-faint">Max/sem </span>
          {plan.inputs.maxRecs}
        </span>
      </div>

      {/* Credit progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-ink-faint">
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

      {/* Semester list */}
      {plan.recommendationData ? (
        <SemesterList data={plan.recommendationData} programLabelMap={programLabelMap} />
      ) : (
        <p className="text-sm text-ink-faint italic">No saved recommendations.</p>
      )}
    </div>
  );
}
