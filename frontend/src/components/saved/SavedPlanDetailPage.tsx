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
import { buildRecommendationWarnings, sanitizeRecommendationWhy } from "@/lib/rendering";
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
  const totalCourses = recommendationData?.semesters?.reduce(
    (sum, s) => sum + (s.recommendations?.length ?? 0),
    0,
  ) ?? 0;
  const modalSemester =
    semesterModalIdx !== null
      ? recommendationData?.semesters?.[semesterModalIdx] ?? null
      : null;
  const exportHref = plan ? `/saved?plan=${encodeURIComponent(plan.id)}&export=pdf` : "/saved";

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
          <Button asChild variant="gold">
            <Link href="/saved">Back to Library</Link>
          </Button>
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
            <div className="relative h-full min-h-0 flex flex-col gap-2">
              {/* ── Single compact card ── */}
              <div className="shrink-0 rounded-xl glass-card shine-sweep shadow-[inset_0_1px_0_rgba(122,179,255,0.08)] p-3 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <Link href="/saved" className="section-kicker hover:text-gold transition-colors">
                    ← Saved Library
                  </Link>
                  <FreshnessBadge freshness={freshness} />
                </div>

                {!isEditingMeta ? (
                  /* ── Read mode ── */
                  <div className="mt-2 space-y-2.5">
                    {/* Plan name + dates */}
                    <div>
                      <h3 className="text-sm font-semibold text-ink-primary leading-snug">{plan.name}</h3>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        Updated {formatSavedPlanDate(plan.updatedAt, { month: "short", day: "numeric" })} · Created {formatSavedPlanDate(plan.createdAt, { month: "short", day: "numeric" })}
                      </p>
                    </div>

                    <div className="border-t border-border-subtle/40" />

                    {/* Compact key-value rows */}
                    <dl className="grid gap-y-1.5">
                      {(majorLabels.length > 0 || trackLabels.length > 0) && (
                        <div className="grid grid-cols-[5rem_1fr] gap-x-2 text-xs">
                          <dt className="text-ink-faint">Program</dt>
                          <dd className="text-ink-secondary truncate">{[...majorLabels, ...trackLabels].join(", ")}</dd>
                        </div>
                      )}
                      {minorLabels.length > 0 && (
                        <div className="grid grid-cols-[5rem_1fr] gap-x-2 text-xs">
                          <dt className="text-ink-faint">Minors</dt>
                          <dd className="text-ink-secondary truncate">{minorLabels.join(", ")}</dd>
                        </div>
                      )}
                      <div className="grid grid-cols-[5rem_1fr] gap-x-2 text-xs">
                        <dt className="text-ink-faint">Target</dt>
                        <dd className="text-ink-secondary">{plan.inputs.targetSemester} · {plan.inputs.semesterCount} terms</dd>
                      </div>
                      <div className="grid grid-cols-[5rem_1fr] gap-x-2 text-xs">
                        <dt className="text-ink-faint">Max/term</dt>
                        <dd className="text-ink-secondary">{plan.inputs.maxRecs} · Summer {plan.inputs.includeSummer ? "included" : "skipped"}</dd>
                      </div>
                    </dl>

                    {plan.notes && (
                      <>
                        <div className="border-t border-border-subtle/40" />
                        <p className="text-[11px] text-ink-faint line-clamp-2">{plan.notes}</p>
                      </>
                    )}

                    <div className="border-t border-border-subtle/40" />

                    {formError && (
                      <p className="text-xs text-bad">{formError}</p>
                    )}

                    {confirmDeleteOpen && (
                      <div className="space-y-2.5 rounded-xl border border-bad/30 bg-[linear-gradient(165deg,rgba(72,11,15,0.56),rgba(16,19,35,0.94))] px-3 py-3">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-ink-primary">Are you sure?</h4>
                          <p className="text-xs text-ink-secondary">
                            Permanently remove <span className="font-semibold text-ink-primary">{plan.name}</span>?
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteOpen(false)}>
                            Keep Plan
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleDelete}
                            className="border-bad/40 text-bad hover:border-bad/60 hover:bg-bad-light/25"
                          >
                            Yes, Delete Plan
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="gold" size="sm" onClick={handleResume} className="pulse-gold-soft">Resume in Planner</Button>
                      {recommendationData ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link href={exportHref} target="_blank" rel="noopener noreferrer">
                            Export PDF
                          </Link>
                        </Button>
                      ) : (
                        <p className="text-[11px] text-ink-faint">PDF export requires a saved snapshot.</p>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setConfirmDeleteOpen(false);
                          setFormError(null);
                          setIsEditingMeta(true);
                        }}
                      >
                        Edit
                      </Button>
                      {!confirmDeleteOpen && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-bad hover:bg-bad-light/25"
                          onClick={() => {
                            setFormError(null);
                            setConfirmDeleteOpen(true);
                          }}
                        >
                          Delete Plan
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/saved">Back</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Edit mode ── */
                  <div className="mt-2 space-y-2.5">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-ink-primary">Plan name</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full rounded-xl border border-border-medium bg-surface-input px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 transition-colors"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-ink-primary">Notes</span>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="w-full rounded-xl border border-border-medium bg-surface-input px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 transition-colors resize-none"
                        placeholder="Context like recruiter-heavy semester, transfer-credit version, or summer-heavy draft."
                      />
                    </label>

                    {formError && (
                      <p className="text-xs text-bad">{formError}</p>
                    )}

                    <div className="flex items-center justify-between gap-2">
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
                      <Button variant="gold" size="sm" onClick={handleSaveMeta} disabled={!name.trim()}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Snapshot summary — fills remaining height ── */}
              <div className="flex-1 min-h-0 rounded-xl glass-card p-3 overflow-hidden">
                {recommendationData ? (
                  <div className="flex h-full flex-col gap-2.5">
                    <p className="section-kicker">Snapshot</p>

                    {/* KPI pair */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg glass-card p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">Semesters</p>
                        <p className="mt-0.5 text-xl font-semibold text-ink-primary leading-none">{recommendationData.semesters?.length ?? 0}</p>
                      </div>
                      <div className="rounded-lg glass-card kpi-glow-gold p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">Courses</p>
                        <p className="mt-0.5 text-xl font-semibold text-ink-primary leading-none">{totalCourses}</p>
                      </div>
                    </div>

                    {/* Saved context strip */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg glass-card px-3 py-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-ink-faint">Completed</span>
                        <span className="text-[11px] font-medium text-ink-secondary">{plan.inputs.completed.length}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-ink-faint">In progress</span>
                        <span className="text-[11px] font-medium text-ink-secondary">{plan.inputs.inProgress.length}</span>
                      </div>
                      <div className="col-span-2 border-t border-border-subtle/30 pt-1 mt-0.5">
                        <p className="text-[10px] text-ink-faint leading-snug">{freshnessCopy.reason}</p>
                      </div>
                    </div>

                    {/* Per-semester breakdown */}
                    <div className="grid flex-1 min-h-0 auto-rows-fr grid-cols-2 gap-2">
                      {recommendationData.semesters?.map((s, i) => {
                        const count = s.recommendations?.length ?? 0;
                        const maxRecs = Number(plan.inputs.maxRecs) || 1;
                        const pct = Math.min(100, Math.round((count / maxRecs) * 100));
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSemesterModalIdx(i)}
                            aria-label={`Open ${s.target_semester ?? `Term ${i + 1}`} snapshot`}
                            className="group flex min-h-0 flex-col justify-between rounded-xl border border-border-subtle/35 bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06] hover:border-gold/25"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-ink-secondary truncate">
                                  {s.target_semester ?? `Term ${i + 1}`}
                                </p>
                                {s.standing_label && (
                                  <p className="mt-0.5 text-[10px] text-ink-faint truncate">{s.standing_label}</p>
                                )}
                              </div>
                              <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                                {count}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-subtle/40">
                                <div
                                  className="h-full rounded-full bg-gold/45 group-hover:bg-gold/65 transition-colors"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-ink-faint">{pct}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                    <p className="section-kicker justify-center">No Snapshot</p>
                    <p className="text-[11px] text-ink-faint max-w-[20ch]">Save a plan after generating recommendations to see the breakdown here.</p>
                  </div>
                )}
              </div>

              {storageError && (
                <div className="rounded-xl border border-bad/20 bg-bad-light px-3 py-2 text-xs text-bad">
                  {storageError}
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
        courses={courses}
        declaredMajors={plan?.inputs.declaredMajors}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
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
            plannerReason={sanitizeRecommendationWhy(hit?.why)}
            plannerNotes={hit?.notes}
            plannerWarnings={buildRecommendationWarnings(hit)}
            programLabelMap={programLabelMap}
            bucketLabelMap={bucketLabelMap}
          />
        );
      })()}
    </>
  );
}
