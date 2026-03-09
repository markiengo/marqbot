"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/shared/Button";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { FreshnessBadge } from "./FreshnessBadge";
import { SavedPlanViewModal } from "./SavedPlanViewModal";
import type { ProgramsData, SavedPlanFreshness, SavedPlanRecord } from "@/lib/types";

/* ── PlanCard (module scope) ──────────────────────────────────── */

interface PlanCardProps {
  plan: SavedPlanRecord;
  freshness: SavedPlanFreshness;
  programs: ProgramsData;
  onClick(): void;
  onDelete(): void;
}

function formatShortDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(parsed),
  );
}

function PlanCard({ plan, freshness, programs, onClick, onDelete }: PlanCardProps) {
  const majorLabel =
    programs.majors.find((m) => m.id === plan.inputs.declaredMajors[0])?.label ??
    plan.inputs.declaredMajors[0] ??
    "";
  const trackLabel =
    programs.tracks.find((t) => t.id === plan.inputs.declaredTracks[0])?.label ?? "";
  const programLine = [majorLabel, trackLabel].filter(Boolean).join(" \u00b7 ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full text-left rounded-2xl border border-border-subtle bg-[#0f2444]/60 hover:border-gold/40 hover:bg-[#112b4f] transition-all p-4 space-y-2"
    >
      {/* Plan name */}
      <p className="font-semibold text-sm text-ink-primary truncate" title={plan.name}>
        {plan.name}
      </p>

      {/* Program + semester */}
      {programLine && (
        <p className="text-xs text-ink-secondary truncate">{programLine}</p>
      )}
      <p className="text-xs text-ink-faint">{plan.inputs.targetSemester}</p>

      {/* Date + freshness */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-ink-faint">{formatShortDate(plan.updatedAt)}</span>
        <FreshnessBadge freshness={freshness} />
      </div>

      {/* Delete icon — visible on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2.5 right-2.5 p-1.5 rounded text-ink-faint opacity-0 group-hover:opacity-100 hover:text-bad transition-all"
        title="Delete plan"
        aria-label="Delete plan"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </button>
  );
}

/* ── SavedPlansPage ───────────────────────────────────────────── */

export function SavedPlansPage() {
  const { courses, loading: coursesLoading, error: coursesError, retry: retryCourses } = useCourses();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms();
  const { hydrated, plans, storageError, deletePlan, loadPlan, getFreshness } =
    useSavedPlans();
  const [viewPlanId, setViewPlanId] = useState<string | null>(null);

  const isLoading =
    coursesLoading ||
    programsLoading ||
    (!courses.length && !coursesError) ||
    (!programs.majors.length && !programsError);
  const bootstrapError =
    (!courses.length ? coursesError : null) ??
    (!programs.majors.length ? programsError : null);

  const freshnessById = useMemo(
    () => new Map(plans.map((plan) => [plan.id, getFreshness(plan)])),
    [getFreshness, plans],
  );

  const viewPlan = viewPlanId ? loadPlan(viewPlanId) : null;

  const handleRetry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

  /* ── Loading ──────────────────────────────────────────────── */
  if (isLoading || !hydrated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ink-muted">Loading saved plans...</p>
        </div>
      </div>
    );
  }

  /* ── Bootstrap error ──────────────────────────────────────── */
  if (bootstrapError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-border-subtle bg-surface-card/70 p-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
              Couldn&apos;t load saved-plan data
            </h1>
            <p className="text-sm text-ink-muted">
              MarqBot needs the course catalog and program list before it can open saved plans.
            </p>
            <p className="text-sm text-bad">{bootstrapError}</p>
          </div>
          <Button variant="gold" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  /* ── Empty state ──────────────────────────────────────────── */
  if (plans.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-lg text-center space-y-5 rounded-3xl border border-border-subtle bg-surface-card/70 p-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Saved Plans</p>
            <h1 className="text-3xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
              No saved plans yet
            </h1>
            <p className="text-sm text-ink-secondary">
              Go to the Planner, generate recommendations, and save a plan from there.
            </p>
          </div>
          {storageError && (
            <div className="rounded-xl border border-bad/20 bg-bad-light px-3 py-2 text-sm text-bad">
              {storageError}
            </div>
          )}
          <Link href="/planner" className="inline-flex">
            <Button variant="gold">Go to Planner</Button>
          </Link>
        </div>
      </div>
    );
  }

  /* ── Grid of plan cards ───────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Library</p>
          <h1 className="text-2xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
            Saved Plans
          </h1>
        </div>
        <span className="text-xs text-ink-faint">{plans.length} plan{plans.length !== 1 ? "s" : ""}</span>
      </div>

      {storageError && (
        <div className="rounded-xl border border-bad/20 bg-bad-light px-4 py-3 text-sm text-bad">
          {storageError}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            freshness={freshnessById.get(plan.id) || "missing"}
            programs={programs}
            onClick={() => setViewPlanId(plan.id)}
            onDelete={() => {
              deletePlan(plan.id);
              if (viewPlanId === plan.id) setViewPlanId(null);
            }}
          />
        ))}
      </div>

      <SavedPlanViewModal
        open={viewPlanId !== null && viewPlan !== null}
        plan={viewPlan}
        freshness={viewPlanId ? freshnessById.get(viewPlanId) ?? "missing" : "missing"}
        courses={courses}
        programs={programs}
        onClose={() => setViewPlanId(null)}
        onDelete={() => {
          if (viewPlanId) deletePlan(viewPlanId);
          setViewPlanId(null);
        }}
      />
    </div>
  );
}
