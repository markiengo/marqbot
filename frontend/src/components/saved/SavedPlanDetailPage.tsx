"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid gap-1 border-t border-white/8 pt-3 first:border-t-0 first:pt-0">
      <dt className="text-[10px] uppercase tracking-[0.22em] text-ink-faint">{label}</dt>
      <dd className={`text-sm text-ink-secondary ${multiline ? "leading-6" : ""}`}>{value}</dd>
    </div>
  );
}

function SnapshotMetric({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className={`rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 ${accentClass}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink-faint">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-sora)] text-[1.75rem] font-semibold leading-none text-ink-primary">
        {value}
      </p>
    </div>
  );
}

function SavedPlanDetailPageInner({ planId }: { planId: string }) {
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
  const [draftMeta, setDraftMeta] = useState<{ name: string; notes: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedSemesterIdx, setSelectedSemesterIdx] = useState(0);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const [courseDetailCode, setCourseDetailCode] = useState<string | null>(null);

  const plan = loadPlan(planId);
  const freshness = plan ? getFreshness(plan) : "missing";
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);

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
    for (const course of courses) {
      if (course.description) map.set(course.course_code, course.description);
    }
    return map;
  }, [courses]);

  const recommendationData = plan?.recommendationData ?? null;
  const savedSnapshot = recommendationData?.mode === "recommendations" ? recommendationData : null;
  const semesters = savedSnapshot?.mode === "recommendations" ? savedSnapshot.semesters ?? [] : [];
  const activeSemesterIdx = semesters.length > 0 ? Math.min(selectedSemesterIdx, semesters.length - 1) : 0;
  const activeSemester = semesters[activeSemesterIdx] ?? null;
  const modalSemester =
    semesterModalIdx !== null
      ? semesters[semesterModalIdx] ?? null
      : null;
  const exportHref = plan ? `/saved?plan=${encodeURIComponent(plan.id)}&export=pdf` : "/saved";
  const totalCourses = semesters.reduce(
    (sum, semester) => sum + (semester.recommendations?.length ?? 0),
    0,
  );
  const requestedCount = Number(plan?.inputs.maxRecs) || 3;
  const activeCourseCount = activeSemester?.recommendations?.length ?? 0;
  const activeFillPercent = Math.min(100, Math.round((activeCourseCount / Math.max(requestedCount, 1)) * 100));
  const primaryProgramLine = [...majorLabels, ...trackLabels].filter(Boolean).join(" / ");
  const noteOrReason = plan?.notes?.trim() || freshnessCopy.reason;
  const currentDraft = draftMeta ?? { name: plan?.name ?? "", notes: plan?.notes ?? "" };

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

  const handleStartEditing = () => {
    if (!plan) return;
    setFormError(null);
    setConfirmDeleteOpen(false);
    setDraftMeta({
      name: plan.name,
      notes: plan.notes,
    });
  };

  const handleSaveMeta = () => {
    if (!plan || !draftMeta) return;
    const result = updatePlan(plan.id, {
      name: draftMeta.name,
      notes: draftMeta.notes,
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
    setDraftMeta(null);
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
      <div className="bg-orbs flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="space-y-4 rounded-2xl glass-card px-8 py-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold/60 border-t-transparent" />
          <p className="text-sm text-ink-muted">Loading saved plan...</p>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="max-w-md space-y-4 rounded-3xl glass-card p-6 text-center">
          <h1 className="text-2xl font-semibold text-ink-primary">Could not load this saved plan</h1>
          <p className="text-sm text-ink-muted">{bootstrapError}</p>
          <Button variant="gold" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="max-w-xl space-y-4 rounded-[28px] glass-card p-8 text-center">
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
      <div className="bg-orbs min-h-[calc(100vh-4rem)]">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(155deg,rgba(7,18,35,0.98),rgba(12,29,54,0.96)_48%,rgba(16,35,65,0.92))] px-6 py-6 shadow-[0_26px_70px_rgba(0,0,0,0.18)] md:px-8 md:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.10),transparent_34%),repeating-linear-gradient(135deg,rgba(255,255,255,0.016),rgba(255,255,255,0.016)_1px,transparent_1px,transparent_20px)] opacity-90" />

            <div className="relative space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/saved"
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink-secondary transition-colors hover:text-gold"
                >
                  <span aria-hidden="true">←</span>
                  Back to saved plans
                </Link>
                <FreshnessBadge freshness={freshness} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] xl:items-end">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <p className="section-kicker !text-[10px]">Saved dossier</p>
                    <h1 className="max-w-[16ch] font-[family-name:var(--font-sora)] text-[clamp(2.3rem,4.6vw,4.7rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-ink-primary">
                      {plan.name}
                    </h1>
                    <p className="max-w-[46rem] text-sm leading-7 text-ink-secondary md:text-[1rem]">
                      {noteOrReason}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {primaryProgramLine && (
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-ink-secondary">
                        {primaryProgramLine}
                      </span>
                    )}
                    {minorLabels.length > 0 && (
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-ink-secondary">
                        Minors: {minorLabels.join(", ")}
                      </span>
                    )}
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-ink-secondary">
                      Target {plan.inputs.targetSemester}
                    </span>
                  </div>

                  <p className="text-sm text-ink-faint">
                    Saved {formatSavedPlanDate(plan.createdAt)} · Updated {formatSavedPlanDate(plan.updatedAt)}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="gold" onClick={handleResume} className="min-w-[11.5rem]">
                      Resume in Planner
                    </Button>
                    {recommendationData ? (
                      <Button asChild variant="secondary">
                        <Link href={exportHref} target="_blank" rel="noopener noreferrer">
                          Export PDF
                        </Link>
                      </Button>
                    ) : (
                      <p className="text-sm text-ink-faint">PDF export requires a saved snapshot.</p>
                    )}
                    <Button variant="secondary" onClick={handleStartEditing}>
                      Edit details
                    </Button>
                    {!confirmDeleteOpen && (
                      <Button
                        variant="ghost"
                        className="text-ink-faint hover:bg-white/[0.04] hover:text-bad"
                        onClick={() => {
                          setFormError(null);
                          setConfirmDeleteOpen(true);
                        }}
                      >
                        Delete plan
                      </Button>
                    )}
                  </div>

                  {confirmDeleteOpen && (
                    <div className="max-w-xl space-y-3 rounded-[24px] border border-bad/25 bg-[linear-gradient(165deg,rgba(72,11,15,0.42),rgba(16,19,35,0.94))] px-4 py-4">
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-ink-primary">Delete this saved version?</h2>
                        <p className="text-sm leading-6 text-ink-secondary">
                          <span className="font-semibold text-ink-primary">{plan.name}</span> will be permanently removed from your saved library.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteOpen(false)}>
                          Keep Plan
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleDelete}
                          className="border-bad/40 bg-bad/12 text-bad hover:border-bad/60 hover:bg-bad-light/25"
                        >
                          Yes, Delete Plan
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(165deg,rgba(10,21,39,0.82),rgba(14,31,56,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">Why save this</p>
                  <p className="mt-3 font-[family-name:var(--font-sora)] text-[1.15rem] font-semibold leading-tight text-ink-primary">
                    A preserved snapshot of one academic direction.
                  </p>
                  <p className="mt-3 text-sm leading-7 text-ink-secondary">
                    This view keeps the saved recommendation state intact so you can compare pacing, revisit earlier instincts, and reopen the version that still feels right.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
            <section className="space-y-4">
              <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(165deg,rgba(9,20,38,0.96),rgba(13,29,54,0.94))] p-5 shadow-[0_18px_56px_rgba(0,0,0,0.18)] md:p-6">
                <div className="flex flex-col gap-4 border-b border-white/8 pb-5 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2">
                    <p className="section-kicker !text-[10px]">Saved snapshot</p>
                    <h2 className="font-[family-name:var(--font-sora)] text-[clamp(1.7rem,2.9vw,2.5rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-ink-primary">
                      Frozen semester preview.
                    </h2>
                    <p className="max-w-[42rem] text-sm leading-7 text-ink-secondary">
                      Move across semesters to compare pacing and course mix without changing your current planner settings.
                    </p>
                  </div>

                  {activeSemester && (
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">Viewing</p>
                      <p className="mt-2 font-[family-name:var(--font-sora)] text-lg font-semibold text-ink-primary">
                        {activeSemester.target_semester ?? `Semester ${activeSemesterIdx + 1}`}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-sm text-ink-faint">
                        <span>{activeCourseCount} courses</span>
                        <span>{activeFillPercent}% of requested load</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={() => setSemesterModalIdx(activeSemesterIdx)}
                      >
                        Expand semester
                      </Button>
                    </div>
                  )}
                </div>

                {semesters.length > 0 && (
                  <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
                    {semesters.map((semester, index) => {
                      const count = semester.recommendations?.length ?? 0;
                      const fillPercent = Math.min(100, Math.round((count / Math.max(requestedCount, 1)) * 100));
                      const active = index === activeSemesterIdx;
                      return (
                        <button
                          key={`${semester.target_semester ?? "semester"}-${index}`}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedSemesterIdx(index)}
                          className={`min-w-[12rem] rounded-[24px] border px-4 py-4 text-left transition-colors ${
                            active
                              ? "border-mu-blue/28 bg-[linear-gradient(165deg,rgba(255,255,255,0.05),rgba(0,114,206,0.08))] text-ink-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                              : "border-white/10 bg-white/[0.03] text-ink-secondary hover:border-mu-blue/32 hover:text-ink-primary"
                          }`}
                          aria-label={`View ${semester.target_semester ?? `semester ${index + 1}`} saved semester`}
                        >
                          <p className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">Semester {index + 1}</p>
                          <p className="mt-2 font-[family-name:var(--font-sora)] text-[1.02rem] font-semibold leading-snug text-current">
                            {semester.target_semester ?? `Semester ${index + 1}`}
                          </p>
                          {semester.standing_label && (
                            <p className="mt-1 text-xs text-ink-faint">{semester.standing_label}</p>
                          )}
                          <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                            <span>{count} courses</span>
                            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-ink-faint">
                              {fillPercent}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 h-[min(72vh,56rem)] min-h-[26rem]">
                  {recommendationData ? (
                    <RecommendationsPanel
                      data={recommendationData}
                      embedded
                      selectedSemesterIdx={activeSemesterIdx}
                      onSemesterChange={setSelectedSemesterIdx}
                      onExpandSemester={setSemesterModalIdx}
                      onCourseClick={setCourseDetailCode}
                      hideHeader
                      hideNavigation
                    />
                  ) : (
                    <div className="relative flex h-full flex-col items-center justify-center space-y-4 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,46,0.86),rgba(10,21,39,0.96))] px-4 py-8 text-center">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,204,0,0.05),transparent_60%)] pointer-events-none" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl glass-card">
                        <svg className="h-8 w-8 text-gold/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      </div>
                      <div className="relative space-y-2">
                        <p className="section-kicker justify-center">No Snapshot</p>
                        <h3 className="font-[family-name:var(--font-sora)] text-xl font-semibold text-ink-primary">
                          No saved recommendation snapshot.
                        </h3>
                        <p className="max-w-sm text-sm leading-7 text-ink-faint">
                          Save a plan after generating recommendations in Planner to see the semester layout here.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-4 xl:sticky xl:top-[5.25rem] xl:self-start">
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(165deg,rgba(10,21,39,0.82),rgba(14,31,56,0.94))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
                <div className="space-y-3">
                  <p className="section-kicker !text-[10px]">
                    {draftMeta ? "Edit version" : "Version profile"}
                  </p>
                  <h2 className="font-[family-name:var(--font-sora)] text-[1.15rem] font-semibold leading-tight text-ink-primary">
                    {draftMeta ? "Refine how this saved path is labeled." : "The metadata behind this saved path."}
                  </h2>
                </div>

                {!draftMeta ? (
                  <dl className="mt-5 grid gap-3">
                    <DetailRow label="Program" value={primaryProgramLine || "Program summary unavailable"} multiline />
                    {minorLabels.length > 0 && (
                      <DetailRow label="Minors" value={minorLabels.join(", ")} multiline />
                    )}
                    <DetailRow label="Target semester" value={plan.inputs.targetSemester} />
                    <DetailRow label="Pacing" value={`${plan.inputs.semesterCount} terms · ${plan.inputs.maxRecs} max / term`} />
                    <DetailRow label="Summer" value={plan.inputs.includeSummer ? "Included" : "Skipped"} />
                    <DetailRow label="Saved note" value={plan.notes || "No note saved for this version."} multiline />
                  </dl>
                ) : (
                  <div className="mt-5 space-y-4">
                    <label className="block space-y-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                        Plan name
                      </span>
                      <input
                        type="text"
                        value={currentDraft.name}
                        onChange={(event) =>
                          setDraftMeta((draft) => ({ name: event.target.value, notes: draft?.notes ?? "" }))
                        }
                        className="w-full rounded-2xl border border-border-medium bg-surface-input px-4 py-3 text-sm text-ink-primary transition-colors focus:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/35"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                        Saved note
                      </span>
                      <textarea
                        rows={4}
                        value={currentDraft.notes}
                        onChange={(event) =>
                          setDraftMeta((draft) => ({ name: draft?.name ?? "", notes: event.target.value }))
                        }
                        className="w-full resize-none rounded-2xl border border-border-medium bg-surface-input px-4 py-3 text-sm leading-6 text-ink-primary transition-colors focus:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/35"
                        placeholder="Context like recruiter-heavy semester, transfer-credit version, or summer-heavy draft."
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDraftMeta(null);
                          setFormError(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button variant="gold" size="sm" onClick={handleSaveMeta} disabled={!currentDraft.name.trim()}>
                        Save changes
                      </Button>
                    </div>
                  </div>
                )}

                {formError && (
                  <p className="mt-4 text-sm text-bad">{formError}</p>
                )}
              </div>

              {savedSnapshot && (
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(165deg,rgba(10,21,39,0.82),rgba(14,31,56,0.94))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
                  <div className="space-y-3">
                    <p className="section-kicker !text-[10px]">Snapshot metrics</p>
                    <h2 className="font-[family-name:var(--font-sora)] text-[1.15rem] font-semibold leading-tight text-ink-primary">
                      What this version is carrying.
                    </h2>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <SnapshotMetric label="Semesters" value={String(semesters.length)} accentClass="border-gold/12" />
                    <SnapshotMetric label="Courses" value={String(totalCourses)} accentClass="border-mu-blue/12" />
                  </div>

                  <div className="mt-4 grid gap-3">
                    <DetailRow label="Completed" value={String(plan.inputs.completed.length)} />
                    <DetailRow label="In progress" value={String(plan.inputs.inProgress.length)} />
                    <DetailRow label="Freshness" value={freshnessCopy.reason} multiline />
                  </div>
                </div>
              )}

              {storageError && (
                <div className="rounded-xl border border-bad/20 bg-bad-light px-3 py-2 text-xs text-bad">
                  {storageError}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={() => setSemesterModalIdx(null)}
        semester={modalSemester as SemesterData | null}
        index={semesterModalIdx ?? 0}
        totalCount={semesters.length}
        requestedCount={requestedCount}
        courses={courses}
        declaredMajors={plan.inputs.declaredMajors}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
        programOrder={programOrder}
        onCourseClick={setCourseDetailCode}
      />

      {(() => {
        const allRecs = semesters.flatMap((semester) => semester.recommendations ?? []);
        const hit = allRecs.find((course) => course.course_code === courseDetailCode);
        return (
          <CourseDetailModal
            open={courseDetailCode !== null}
            onClose={() => setCourseDetailCode(null)}
            courseCode={courseDetailCode ?? ""}
            courseName={hit?.course_name}
            credits={hit?.credits}
            description={courseDetailCode ? descriptionMap.get(courseDetailCode) ?? null : null}
            prereqRaw={courseDetailCode ? courses.find((course) => course.course_code === courseDetailCode)?.catalog_prereq_raw : null}
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

export function SavedPlanDetailPage({ planId }: { planId: string }) {
  return <SavedPlanDetailPageInner key={planId} planId={planId} />;
}
