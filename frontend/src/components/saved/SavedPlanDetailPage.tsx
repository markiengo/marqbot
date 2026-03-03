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
import { FreshnessBadge } from "./FreshnessBadge";
import { SavedPlanSnapshot } from "./SavedPlanSnapshot";

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

  const plan = loadPlan(planId);
  const freshness = plan ? getFreshness(plan) : "missing";
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);

  // Sync form fields when the plan record becomes available
  useEffect(() => {
    if (!plan) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(plan.name);
    setNotes(plan.notes);
  }, [plan]);

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
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ink-muted">Loading saved plan...</p>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 rounded-3xl border border-border-subtle bg-surface-card/80 p-6">
          <h1 className="text-2xl font-semibold text-ink-primary">Could not load plan detail</h1>
          <p className="text-sm text-ink-muted">{bootstrapError}</p>
          <Button variant="gold" onClick={handleRetry}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-xl rounded-[28px] border border-border-subtle bg-surface-card/80 p-8 text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Saved / Detail</p>
          <h1 className="text-3xl font-semibold text-ink-primary">Plan not found</h1>
          <p className="text-sm text-ink-secondary">
            This local saved-plan record is missing. It may have been deleted in another tab.
          </p>
          <Link href="/saved" className="inline-flex">
            <Button variant="gold">Back to Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 md:py-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <section className="relative overflow-hidden rounded-[30px] border border-border-subtle bg-[linear-gradient(155deg,rgba(8,24,47,.98),rgba(10,34,64,.92)_55%,rgba(26,21,8,.82))] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.28)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.16),transparent_28%),repeating-linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03)_1px,transparent_1px,transparent_18px)] opacity-70" />
          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <Link href="/saved" className="inline-flex text-xs uppercase tracking-[0.28em] text-gold/80 hover:text-gold">
                  Saved Library
                </Link>
                <h1 className="max-w-[14ch] text-4xl font-semibold leading-[0.95] text-ink-primary">
                  {plan.name}
                </h1>
              </div>
              <FreshnessBadge freshness={freshness} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border-subtle bg-black/15 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-ink-faint">Snapshot</p>
                <p className="mt-2 text-xl font-semibold text-ink-primary">{freshnessCopy.label}</p>
                <p className="mt-2 text-sm text-ink-secondary">{freshnessCopy.reason}</p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-black/15 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-ink-faint">Updated</p>
                <p className="mt-2 text-xl font-semibold text-ink-primary">{formatSavedPlanDate(plan.updatedAt)}</p>
                <p className="mt-2 text-sm text-ink-secondary">
                  Created {formatSavedPlanDate(plan.createdAt, { month: "short", day: "numeric" })}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border-subtle bg-[#07162d]/75 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-ink-faint">Program</p>
                <div className="mt-3 space-y-2 text-sm text-ink-secondary">
                  <p>{majorLabels.length > 0 ? majorLabels.join(", ") : "No major saved"}</p>
                  <p>{trackLabels.length > 0 ? trackLabels.join(", ") : "No track saved"}</p>
                  <p>{minorLabels.length > 0 ? minorLabels.join(", ") : "No minors saved"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-[#07162d]/75 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-ink-faint">Planner Settings</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-ink-secondary">
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

            <div className="flex flex-wrap gap-3">
              <Button variant="gold" onClick={handleResume}>Resume in Planner</Button>
              <Link href="/saved" className="inline-flex">
                <Button variant="secondary">Back to Library</Button>
              </Link>
            </div>

            {(storageError || formError) && (
              <div className="rounded-2xl border border-bad/20 bg-bad-light px-4 py-3 text-sm text-bad">
                {formError || storageError}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-border-subtle bg-surface-card/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gold">Metadata</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink-primary">Edit labels, keep the snapshot</h2>
              </div>
              <Button variant="ghost" className="text-bad hover:bg-bad-light/25" onClick={handleDelete}>
                Delete
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink-primary">Plan name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-border-medium bg-surface-input px-4 py-3 text-sm text-ink-primary"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink-primary">Notes</span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-2xl border border-border-medium bg-surface-input px-4 py-3 text-sm text-ink-primary"
                  placeholder="Context like recruiter-heavy semester, transfer-credit version, or summer-heavy draft."
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-faint">
                  Snapshot data stays attached unless you regenerate this plan in Planner.
                </p>
                <Button variant="gold" onClick={handleSaveMeta} disabled={!name.trim()}>
                  Save Metadata
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-border-subtle bg-surface-card/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-gold">Snapshot Preview</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink-primary">Semester preview</h2>
              </div>
              <p className="max-w-md text-sm text-ink-faint">
                This remains viewable even when stale so you can compare old planning assumptions before resuming.
              </p>
            </div>
            <div className="mt-5">
              <SavedPlanSnapshot plan={plan} courses={courses} programs={programs} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
