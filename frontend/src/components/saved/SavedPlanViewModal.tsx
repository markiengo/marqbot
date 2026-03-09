"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { useAppContext } from "@/context/AppContext";
import { buildSessionSnapshotFromSavedPlan } from "@/lib/savedPlans";
import {
  buildRecommendationWarnings,
  buildCourseCreditMap,
  compactKpiBucketLabel,
  computeCreditKpiMetrics,
  sanitizeRecommendationWhy,
  sumCreditsForCourseCodes,
} from "@/lib/rendering";
import { formatSavedPlanDate, resolveProgramLabels } from "@/lib/savedPlanPresentation";
import { FreshnessBadge } from "./FreshnessBadge";
import { CourseDetailModal } from "@/components/shared/CourseDetailModal";
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

function SemesterCard({ sem, index, onCourseClick }: { sem: SemesterData; index: number; onCourseClick?: (code: string) => void }) {
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
          <div
            key={c.course_code}
            className={"space-y-0.5 relative z-[1]" + (onCourseClick ? " cursor-pointer hover:bg-white/[0.03] rounded-lg -mx-1 px-1 transition-colors" : "")}
            onClick={onCourseClick ? () => onCourseClick(c.course_code) : undefined}
          >
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
  const [courseDetailCode, setCourseDetailCode] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset transient UI state when modal closes
      setConfirmDeleteOpen(false);
      setCourseDetailCode(null);
    }
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset confirmation when plan changes
    setConfirmDeleteOpen(false);
  }, [plan?.id]);

  // useMemo must be declared before any early returns
  const creditMap = useMemo(() => buildCourseCreditMap(courses), [courses]);
  const metrics = useMemo(() => {
    if (!plan) return null;
    const completedCredits = sumCreditsForCourseCodes(plan.inputs.completed, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(plan.inputs.inProgress, creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [creditMap, plan]);

  const descriptionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) {
      if (c.description) map.set(c.course_code, c.description);
    }
    return map;
  }, [courses]);

  const majorLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredMajors, programs.majors) : []),
    [plan, programs.majors],
  );
  const trackLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks) : []),
    [plan, programs.tracks],
  );
  const bucketLabelMap = useMemo(() => {
    const raw = programs.bucket_labels || {};
    const map = new Map<string, string>();
    Object.entries(raw).forEach(([bucketId, label]) => {
      const id = String(bucketId || "").trim();
      const txt = String(label || "").trim();
      if (id && txt) map.set(id, txt);
    });
    return map;
  }, [programs.bucket_labels]);

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
          {confirmDeleteOpen ? (
            <div className="relative space-y-5">
              <div className="rounded-[24px] border border-bad/30 bg-[linear-gradient(165deg,rgba(72,11,15,0.68),rgba(16,19,35,0.92))] px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="section-kicker !text-bad">Delete Saved Plan</p>
                <h4 className="mt-2 text-2xl font-semibold text-ink-primary">
                  Are you sure?
                </h4>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  This will permanently remove <span className="font-semibold text-ink-primary">{plan.name}</span> from this browser.
                  The saved notes, snapshot, and plan inputs will all be deleted.
                </p>
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-xs text-ink-faint">
                  If you still need it, back out now and keep the plan in your library.
                </div>
              </div>

              <div className="divider-fade" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(false)}
                >
                  Keep Plan
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onDelete}
                  className="border-bad/40 text-bad hover:border-bad/60 hover:bg-bad-light/25"
                >
                  Yes, Delete Plan
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                <p className="text-sm text-ink-faint italic">No saved planner snapshot attached.</p>
              ) : (
                <div>
                  {rows.map((row, yearIdx) => (
                    <div key={yearIdx}>
                      <p className={`section-kicker !text-[10px] mb-2 ${yearIdx > 0 ? "mt-5" : "mt-3"}`}>
                        Year {yearIdx + 1}
                      </p>
                      <div className={`grid gap-3 ${row.length === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
                        {row.map((sem, i) => (
                          <SemesterCard key={yearIdx * cols + i} sem={sem} index={yearIdx * cols + i} onCourseClick={setCourseDetailCode} />
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
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="text-bad hover:bg-bad-light/25"
                >
                  Delete
                </Button>
                <Button variant="gold" size="sm" onClick={handleLoadIntoPlanner} className="shadow-[0_0_24px_rgba(255,204,0,0.22)] pulse-gold-soft">
                  Open in Planner
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {(() => {
        const allRecs = plan?.recommendationData?.semesters?.flatMap((s) => s.recommendations ?? []) ?? [];
        const hit = allRecs.find((c) => c.course_code === courseDetailCode);
        const programLabelMap = new Map<string, string>();
        programs.majors.forEach((item) => programLabelMap.set(item.id, item.label));
        programs.tracks.forEach((item) => programLabelMap.set(item.id, item.label));
        programs.minors.forEach((item) => programLabelMap.set(item.id, item.label));
        return (
          <CourseDetailModal
            open={courseDetailCode !== null}
            onClose={() => setCourseDetailCode(null)}
            courseCode={courseDetailCode ?? ""}
            courseName={hit?.course_name}
            credits={hit?.credits}
            description={courseDetailCode ? descriptionMap.get(courseDetailCode) ?? null : null}
            prereqRaw={courseDetailCode ? courses.find(c => c.course_code === courseDetailCode)?.catalog_prereq_raw : null}
            buckets={hit?.fills_buckets}
            plannerReason={sanitizeRecommendationWhy(hit?.why)}
            plannerNotes={hit?.notes}
            plannerWarnings={buildRecommendationWarnings(hit)}
            programLabelMap={programLabelMap}
            bucketLabelMap={bucketLabelMap}
          />
        );
      })()}
    </Modal>
  );
}
