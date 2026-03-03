"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/shared/Button";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import {
  buildSavedPlanProgramLine,
  formatSavedPlanDate,
  getSavedPlanFreshnessCopy,
  matchesSavedPlanQuery,
  SAVED_PLAN_SORT_OPTIONS,
  sortSavedPlans,
} from "@/lib/savedPlanPresentation";
import { FreshnessBadge } from "./FreshnessBadge";
import type { ProgramsData, SavedPlanFreshness, SavedPlanRecord } from "@/lib/types";

interface PlanCardProps {
  plan: SavedPlanRecord;
  freshness: SavedPlanFreshness;
  programs: ProgramsData;
  onDelete(): void;
}

function PlanCard({ plan, freshness, programs, onDelete }: PlanCardProps) {
  const programLine = buildSavedPlanProgramLine(plan, programs);
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);

  return (
    <article className="group relative overflow-hidden rounded-[26px] border border-border-subtle bg-[linear-gradient(160deg,rgba(11,28,52,.96),rgba(18,33,63,.92)_60%,rgba(24,18,8,.88))] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.14),transparent_28%),repeating-linear-gradient(135deg,rgba(255,255,255,0.025),rgba(255,255,255,0.025)_1px,transparent_1px,transparent_16px)] opacity-70" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-gold/80">
              {plan.inputs.targetSemester}
            </p>
            <h2 className="truncate text-lg font-semibold text-ink-primary" title={plan.name}>
              {plan.name}
            </h2>
          </div>
          <FreshnessBadge freshness={freshness} />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.3fr_.7fr]">
          <div className="space-y-2">
            <p className="text-sm text-ink-secondary">{programLine || "No program summary"}</p>
            <p className="line-clamp-2 min-h-10 text-sm text-ink-faint">
              {plan.notes || freshnessCopy.reason}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle/70 bg-black/10 p-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.22em] text-ink-faint">Updated</p>
            <p className="mt-1 text-base font-semibold text-ink-primary">
              {formatSavedPlanDate(plan.updatedAt, { month: "short", day: "numeric" })}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {plan.inputs.includeSummer ? "Summer included" : "Standard cadence"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle/60 pt-3">
          <div className="flex flex-wrap gap-2 text-xs text-ink-faint">
            <span>{plan.inputs.semesterCount} terms</span>
            <span>{plan.inputs.maxRecs} max/term</span>
            <span>{plan.inputs.completed.length} done</span>
            <span>{plan.inputs.inProgress.length} in progress</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/saved/${plan.id}`} className="inline-flex">
              <Button variant="gold" size="sm">Open</Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-bad hover:bg-bad-light/25"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SavedPlansLibraryPage() {
  const { courses, loading: coursesLoading, error: coursesError, retry: retryCourses } = useCourses();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms();
  const { hydrated, plans, storageError, deletePlan, getFreshness } = useSavedPlans();
  const [query, setQuery] = useState("");
  const [freshnessFilter, setFreshnessFilter] = useState<"all" | SavedPlanFreshness>("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "name">("recent");
  const deferredQuery = useDeferredValue(query);

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

  const visiblePlans = useMemo(() => {
    const filtered = plans.filter((plan) => {
      const freshness = freshnessById.get(plan.id) || "missing";
      if (freshnessFilter !== "all" && freshness !== freshnessFilter) return false;
      return matchesSavedPlanQuery(plan, programs, deferredQuery);
    });
    return sortSavedPlans(filtered, sort);
  }, [deferredQuery, freshnessById, freshnessFilter, plans, programs, sort]);

  const staleCount = plans.filter((plan) => freshnessById.get(plan.id) === "stale").length;
  const freshCount = plans.filter((plan) => freshnessById.get(plan.id) === "fresh").length;

  const handleRetry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

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

  if (bootstrapError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-border-subtle bg-surface-card/70 p-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
              Couldn&apos;t load saved-plan data
            </h1>
            <p className="text-sm text-ink-muted">
              Marqbot needs the course catalog and program list before it can render the library.
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
              Generate recommendations in Planner, then save one to start building a comparison library.
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

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 md:py-8 space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-border-subtle bg-[linear-gradient(155deg,rgba(7,18,39,.98),rgba(11,33,63,.94)_58%,rgba(24,18,8,.92))] px-5 py-6 shadow-[0_32px_100px_rgba(0,0,0,0.3)] md:px-7 md:py-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.12),transparent_32%),repeating-linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03)_1px,transparent_1px,transparent_18px)] opacity-80" />
        <div className="relative grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Saved Library</p>
            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-semibold leading-[0.95] text-ink-primary md:text-5xl">
                Named snapshots for comparing planning paths, not just your latest run.
              </h1>
              <p className="max-w-2xl text-sm text-ink-secondary md:text-base">
                Browse the plans you saved in this browser, scan freshness at a glance, and jump into a dedicated detail page before resuming work in Planner.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-border-subtle bg-black/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-ink-faint">Library Size</p>
              <p className="mt-2 text-3xl font-semibold text-ink-primary">{plans.length}</p>
              <p className="mt-1 text-sm text-ink-secondary">Local saved plans available right now.</p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-black/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-ink-faint">Current</p>
              <p className="mt-2 text-3xl font-semibold text-ink-primary">{freshCount}</p>
              <p className="mt-1 text-sm text-ink-secondary">Snapshots still aligned with saved inputs.</p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-black/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-ink-faint">Needs Refresh</p>
              <p className="mt-2 text-3xl font-semibold text-ink-primary">{staleCount}</p>
              <p className="mt-1 text-sm text-ink-secondary">Plans where the stored snapshot is older than the inputs.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-border-subtle bg-surface-card/75 p-4 md:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink-faint">Search</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by plan name, notes, semester, major, track, or course code"
              className="w-full rounded-2xl border border-border-medium bg-surface-input px-4 py-3 text-sm text-ink-primary"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink-faint">Freshness</span>
            <select
              value={freshnessFilter}
              onChange={(event) => setFreshnessFilter(event.target.value as "all" | SavedPlanFreshness)}
              className="w-full rounded-2xl border border-border-medium bg-surface-input px-4 py-3 text-sm text-ink-primary"
            >
              <option value="all">All states</option>
              <option value="fresh">Current</option>
              <option value="stale">Inputs changed</option>
              <option value="missing">Snapshot missing</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink-faint">Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as "recent" | "oldest" | "name")}
              className="w-full rounded-2xl border border-border-medium bg-surface-input px-4 py-3 text-sm text-ink-primary"
            >
              {SAVED_PLAN_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {storageError && (
        <div className="rounded-xl border border-bad/20 bg-bad-light px-4 py-3 text-sm text-bad">
          {storageError}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gold">Results</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink-primary">
              {visiblePlans.length} visible plan{visiblePlans.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <Link href="/planner" className="inline-flex">
            <Button variant="secondary">Save Another from Planner</Button>
          </Link>
        </div>

        {visiblePlans.length === 0 ? (
          <div className="rounded-[28px] border border-border-subtle bg-surface-card/70 px-6 py-10 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-gold">No Matches</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink-primary">Nothing fits this filter set.</h3>
            <p className="mt-3 text-sm text-ink-secondary">
              Clear or broaden your search to bring plans back into the library view.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                freshness={freshnessById.get(plan.id) || "missing"}
                programs={programs}
                onDelete={() => {
                  deletePlan(plan.id);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
