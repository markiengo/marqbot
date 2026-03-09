"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/shared/Button";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { useAppContext } from "@/context/AppContext";
import { buildSessionSnapshotFromSavedPlan } from "@/lib/savedPlans";
import {
  formatSavedPlanDate,
  getSavedPlanFreshnessCopy,
  resolveProgramLabels,
} from "@/lib/savedPlanPresentation";
import { RecommendationsPanel } from "@/components/planner/RecommendationsPanel";
import { SemesterModal } from "@/components/planner/SemesterModal";
import { CourseDetailModal } from "@/components/shared/CourseDetailModal";
import { FreshnessBadge } from "./FreshnessBadge";
import type { SemesterData } from "@/lib/types";

export function SavedPlanDetailPage({ planId }: { planId: string }) {
  const router = useRouter();
  const { dispatch } = useAppContext();
  const { courses, loading: coursesLoading, error: coursesError, retry: retryCourses } = useCourses();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms();
  const { hydrated, storageError, loadPlan, getFreshness, updatePlan, deletePlan } = useSavedPlans();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const [courseDetailCode, setCourseDetailCode] = useState<string | null>(null);

  const plan = loadPlan(planId);
  const freshness = plan ? getFreshness(plan) : "missing";
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);

  useEffect(() => {
    if (!plan) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(plan.name);
    setNotes(plan.notes);
  }, [plan]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset confirmation when plan changes
    setConfirmDeleteOpen(false);
  }, [plan?.id]);

  const isLoading =
    coursesLoading ||
    programsLoading ||
    (!courses.length && !coursesError) ||
    (!programs.majors.length && !programsError);

  const bootstrapError =
    (!courses.length ? coursesError : null) ??
    (!programs.majors.length ? programsError : null);

  const majorLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredMajors, programs.majors) : []),
    [plan, programs.majors],
  );
  const trackLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks) : []),
    [plan, programs.tracks],
  );
  const minorLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredMinors, programs.minors) : []),
    [plan, programs.minors],
  );
  const programLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    programs.majors.forEach((item) => map.set(item.id, item.label));
    programs.tracks.forEach((item) => map.set(item.id, item.label));
    programs.minors.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [programs]);
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
  const programOrder = useMemo(
    () => (plan ? [...plan.inputs.declaredMajors, ...plan.inputs.declaredTracks, ...plan.inputs.declaredMinors] : []),
    [plan],
  );
  const descriptionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) {
      if (c.description) map.set(c.course_code, c.description);
    }
    return map;
  }, [courses]);
  const recommendationData = plan?.recommendationData ?? null;
  const modalSemester =
    semesterModalIdx !== null
      ? recommendationData?.semesters?.[semesterModalIdx] ?? null
      : null;

  const handleRetry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

  const handleResume = () => {
    if (!plan) return;
    dispatch({
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: buildSessionSnapshotFromSavedPlan(plan),
    });
    router.push("/planner");
  };

  const handleSaveMeta = () => {
    if (!plan) return;
    const result = updatePlan(plan.id, {
      name,
      notes,
      inputs: plan.inputs,
      recommendationData: plan.recommendationData,
      lastRequestedCount: plan.lastRequestedCount,
      resultsInputHash: plan.resultsInputHash,
      lastGeneratedAt: plan.lastGeneratedAt,
    });
    if (!result.ok) {
      setFormError(result.error || "Could not update this plan.");
      return;
    }
    setFormError(null);
    setIsEditingMeta(false);
  };

  const handleDelete = () => {
    if (!plan) return;
    const result = deletePlan(plan.id);
    if (!result.ok) {
      setFormError(result.error || "Could not delete this plan.");
      return;
    }
    router.push("/saved");
  };

  if (!hydrated || isLoading) {
    return (
      <div className="bg-orbs min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-4 glass-card rounded-2xl px-8 py-6">
          <div className="w-10 h-10 border-2 border-gold/60 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ink-muted">Loading saved plan...</p>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 rounded-3xl glass-card p-6">
          <h1 className="text-2xl font-semibold text-ink-primary">Could not load this saved plan</h1>
          <p className="text-sm text-ink-muted">{bootstrapError}</p>
          <Button variant="gold" onClick={handleRetry}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-xl rounded-[28px] glass-card p-8 text-center space-y-4">
          <p className="section-kicker justify-center">Saved / Detail</p>
          <h1 className="text-3xl font-semibold text-ink-primary">Plan not found</h1>
          <p className="text-sm text-ink-secondary">
            This local saved-plan record is missing. It may have been deleted in another tab or browser session.
          </p>
          <Link href="/saved" className="inline-flex">
            <Button variant="gold">Back to Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="planner-shell bg-orbs h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
        <div className="planner-columns">
          <section className="planner-panel planner-left relative">
            <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(6,18,38,0.99),rgba(9,34,66,0.96)_52%,rgba(34,24,8,0.9))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.22),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.18),transparent_30%),repeating-linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.045)_1px,transparent_1px,transparent_16px)] opacity-90" />
            <div className="relative min-h-0 flex flex-col gap-2">
              <div className="shrink-0 rounded-xl glass-card shine-sweep shadow-[inset_0_1px_0_rgba(122,179,255,0.08)] p-4 overflow-hidden">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      <Link href="/saved" className="section-kicker hover:text-gold transition-colors">
                        Saved Library
                      </Link>
                      <h3 className="max-w-[22ch] text-[10px] font-semibold leading-[1.2] text-ink-primary">
                        {plan.name}
                      </h3>
                    </div>
                    <FreshnessBadge freshness={freshness} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="relative overflow-hidden rounded-2xl glass-card stat-card-decor kpi-glow-gold p-4">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,204,0,0.09),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(0,114,206,0.07),transparent_50%)] pointer-events-none" />
                      <p className="relative z-[1] text-[11px] uppercase tracking-[0.25em] text-ink-faint">Snapshot</p>
                      <p className="relative z-[1] mt-2 text-xl font-semibold text-ink-primary">{freshnessCopy.label}</p>
                      <p className="relative z-[1] mt-2 text-sm text-ink-secondary">{freshnessCopy.reason}</p>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl glass-card stat-card-decor kpi-glow-gold p-4">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,114,206,0.08),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(255,204,0,0.07),transparent_50%)] pointer-events-none" />
                      <p className="relative z-[1] text-[11px] uppercase tracking-[0.25em] text-ink-faint">Updated</p>
                      <p className="relative z-[1] mt-2 text-xl font-semibold text-ink-primary">{formatSavedPlanDate(plan.updatedAt)}</p>
                      <p className="relative z-[1] mt-2 text-sm text-ink-secondary">
                        Created {formatSavedPlanDate(plan.createdAt, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="relative overflow-hidden rounded-2xl glass-card p-4">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,114,206,0.07),transparent_60%),linear-gradient(160deg,rgba(255,255,255,0.03),transparent_40%)] pointer-events-none" />
                      <p className="relative z-[1] text-[11px] uppercase tracking-[0.25em] text-ink-faint">Program</p>
                      <div className="relative z-[1] mt-3 space-y-2 text-sm text-ink-secondary">
                        <p>{majorLabels.length > 0 ? majorLabels.join(", ") : "No major saved"}</p>
                        <p>{trackLabels.length > 0 ? trackLabels.join(", ") : "No track saved"}</p>
                        <p>{minorLabels.length > 0 ? minorLabels.join(", ") : "No minors saved"}</p>
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl glass-card p-4">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,204,0,0.06),transparent_55%),linear-gradient(160deg,rgba(255,255,255,0.03),transparent_40%)] pointer-events-none" />
                      <p className="relative z-[1] text-[11px] uppercase tracking-[0.25em] text-ink-faint">Planner Settings</p>
                      <div className="relative z-[1] mt-3 grid grid-cols-2 gap-3 text-sm text-ink-secondary">
                        <div>
                          <p className="text-ink-faint">Target</p>
                          <p>{plan.inputs.targetSemester}</p>
                        </div>
                        <div>
                          <p className="text-ink-faint">Semesters</p>
                          <p>{plan.inputs.semesterCount}</p>
                        </div>
                        <div>
                          <p className="text-ink-faint">Max per term</p>
                          <p>{plan.inputs.maxRecs}</p>
                        </div>
                        <div>
                          <p className="text-ink-faint">Summer</p>
                          <p>{plan.inputs.includeSummer ? "Included" : "Skipped"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button variant="gold" onClick={handleResume} className="shadow-[0_0_24px_rgba(255,204,0,0.22)] pulse-gold-soft">Resume in Planner</Button>
                    <Link href="/saved" className="inline-flex">
                      <Button variant="secondary">Back to Library</Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="relative rounded-[28px] glass-card p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] overflow-hidden">
                <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_60%_40%_at_80%_10%,rgba(255,204,0,0.05),transparent),radial-gradient(ellipse_50%_50%_at_10%_90%,rgba(0,114,206,0.06),transparent),linear-gradient(175deg,rgba(255,255,255,0.02),transparent_30%)] pointer-events-none" />
                <div className="relative z-[1] flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="section-kicker">Plan Details</p>
                    <h3 className="max-w-[22ch] text-[10px] font-semibold leading-[1.2] text-ink-primary">Plan name and notes</h3>
                    <p className="text-sm text-ink-faint">
                      Update the title and notes without changing the saved recommendation snapshot.
                    </p>
                  </div>
                  {!isEditingMeta ? (
                    <Button variant="secondary" size="sm" onClick={() => setIsEditingMeta(true)}>
                      Edit
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setName(plan.name);
                        setNotes(plan.notes);
                        setFormError(null);
                        setIsEditingMeta(false);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                <div className="relative z-[1] mt-5 space-y-4">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink-primary">Plan name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={!isEditingMeta}
                      className="w-full rounded-2xl border border-border-medium bg-surface-input/80 backdrop-blur-sm px-4 py-3 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 transition-colors disabled:opacity-70"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-ink-primary">Notes</span>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      disabled={!isEditingMeta}
                      className="w-full rounded-2xl border border-border-medium bg-surface-input/80 backdrop-blur-sm px-4 py-3 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 transition-colors disabled:opacity-70"
                      placeholder="Context like recruiter-heavy semester, transfer-credit version, or summer-heavy draft."
                    />
                  </label>
                  {confirmDeleteOpen ? (
                    <div className="space-y-4 rounded-[24px] border border-bad/30 bg-[linear-gradient(165deg,rgba(72,11,15,0.56),rgba(16,19,35,0.94))] px-5 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <div className="space-y-2">
                        <p className="section-kicker !text-bad">Delete Saved Plan</p>
                        <h4 className="text-xl font-semibold text-ink-primary">Are you sure?</h4>
                        <p className="text-sm leading-relaxed text-ink-secondary">
                          This will permanently remove <span className="font-semibold text-ink-primary">{plan.name}</span> from this browser, including the saved notes and recommendation snapshot.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmDeleteOpen(false)}
                        >
                          Keep Plan
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleDelete}
                          className="border-bad/40 text-bad hover:border-bad/60 hover:bg-bad-light/25"
                        >
                          Yes, Delete Plan
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          className="text-bad hover:bg-bad-light/25"
                          onClick={() => setConfirmDeleteOpen(true)}
                        >
                          Delete Plan
                        </Button>
                        <p className="text-sm text-ink-faint">
                          Snapshot data stays attached unless you regenerate this plan in Planner.
                        </p>
                      </div>
                      {isEditingMeta && (
                        <Button variant="gold" onClick={handleSaveMeta} disabled={!name.trim()}>
                          Save Changes
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {(storageError || formError) && (
                <div className="rounded-2xl border border-bad/20 bg-bad-light px-4 py-3 text-sm text-bad">
                  {formError || storageError}
                </div>
              )}
            </div>
          </section>

          <section className="planner-panel planner-right relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_90%_10%,rgba(0,114,206,0.08),transparent),radial-gradient(ellipse_60%_40%_at_10%_80%,rgba(255,204,0,0.05),transparent)] pointer-events-none" />
            <div className="relative h-full min-h-0 flex flex-col">
              <div className="mb-2">
                <p className="section-kicker">
                  Saved snapshot. Same planner view, frozen at save time.
                </p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <h3 className="text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
                    Saved semester preview.
                  </h3>
                </div>
              </div>

              {recommendationData ? (
                <div className="flex-1 min-h-0">
                  <RecommendationsPanel
                    data={recommendationData}
                    onExpandSemester={setSemesterModalIdx}
                    onCourseClick={setCourseDetailCode}
                  />
                </div>
              ) : (
                <div className="relative flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,204,0,0.04),transparent_60%)] pointer-events-none" />
                  <div className="relative w-16 h-16 glass-card rounded-2xl flex items-center justify-center float-soft">
                    <svg className="w-8 h-8 text-gold/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div className="relative">
                    <p className="section-kicker justify-center mb-2">No Snapshot</p>
                    <h2 className="text-lg font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
                      No saved recommendation snapshot.
                    </h2>
                    <p className="text-sm text-ink-faint mt-1 max-w-sm">
                      Save a plan after generating recommendations in Planner to see the semester layout here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={() => setSemesterModalIdx(null)}
        semester={modalSemester as SemesterData | null}
        index={semesterModalIdx ?? 0}
        totalCount={recommendationData?.semesters?.length ?? 0}
        requestedCount={Number(plan.inputs.maxRecs) || 3}
        declaredMajors={plan?.inputs.declaredMajors}
        programLabelMap={programLabelMap}
        programOrder={programOrder}
        onCourseClick={setCourseDetailCode}
      />

      {(() => {
        const allRecs = recommendationData?.semesters?.flatMap((s) => s.recommendations ?? []) ?? [];
        const hit = allRecs.find((c) => c.course_code === courseDetailCode);
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
            programLabelMap={programLabelMap}
            bucketLabelMap={bucketLabelMap}
          />
        );
      })()}
    </>
  );
}
