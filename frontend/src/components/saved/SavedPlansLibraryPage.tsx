"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import {
  buildSavedPlanProgramLine,
  formatSavedPlanDate,
  getSavedPlanFreshnessCopy,
} from "@/lib/savedPlanPresentation";
import { FreshnessBadge } from "./FreshnessBadge";
import type { ProgramsData, SavedPlanFreshness, SavedPlanRecord } from "@/lib/types";

interface PlanCardProps {
  plan: SavedPlanRecord;
  freshness: SavedPlanFreshness;
  programs: ProgramsData;
  onDelete(): void;
}

function PlanCard({ plan, freshness, programs, onDelete, index }: PlanCardProps & { index: number }) {
  const reduce = useReducedMotion();
  const programLine = buildSavedPlanProgramLine(plan, programs);
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);

  return (
    <motion.article
      initial={reduce ? undefined : { opacity: 0, y: 20 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={reduce ? undefined : { duration: 0.4, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -4, scale: 1.008 }}
      className="group relative overflow-hidden rounded-[26px] glass-card card-glow-hover p-4"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.12),transparent_28%),radial-gradient(ellipse_at_bottom_left,rgba(0,114,206,0.10),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(255,204,0,0.06),transparent_30%),repeating-linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02)_1px,transparent_1px,transparent_16px)] opacity-80" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <p className="section-kicker !text-[10px]">
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
            <p className="text-sm text-ink-secondary">{programLine || "Program summary unavailable"}</p>
            <p className="line-clamp-2 min-h-10 text-sm text-ink-faint">
              {plan.notes || freshnessCopy.reason}
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl glass-card stat-card-decor p-3 text-right">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,204,0,0.08),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(0,114,206,0.06),transparent_50%)] pointer-events-none" />
            <p className="relative z-[1] text-[11px] uppercase tracking-[0.22em] text-ink-faint">Updated</p>
            <p className="relative z-[1] mt-1 text-base font-semibold text-ink-primary">
              {formatSavedPlanDate(plan.updatedAt, { month: "short", day: "numeric" })}
            </p>
            <p className="relative z-[1] mt-1 text-xs text-ink-faint">
              {plan.inputs.includeSummer ? "Summer included" : "Standard cadence"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle/60 pt-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full glass-card px-2.5 py-1 text-[11px] font-medium text-ink-secondary">{plan.inputs.semesterCount} terms</span>
            <span className="rounded-full glass-card px-2.5 py-1 text-[11px] font-medium text-ink-secondary">{plan.inputs.maxRecs} max/term</span>
            <span className="rounded-full glass-card px-2.5 py-1 text-[11px] font-medium text-ink-secondary">{plan.inputs.completed.length} done</span>
            <span className="rounded-full glass-card px-2.5 py-1 text-[11px] font-medium text-ink-secondary">{plan.inputs.inProgress.length} in prog</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/saved?plan=${encodeURIComponent(plan.id)}`} className="inline-flex">
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
    </motion.article>
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
  const reduce = useReducedMotion();

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

  const visiblePlans = useMemo(() => plans, [plans]);

  const staleCount = plans.filter((plan) => freshnessById.get(plan.id) === "stale").length;
  const freshCount = plans.filter((plan) => freshnessById.get(plan.id) === "fresh").length;

  const handleRetry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

  if (isLoading || !hydrated) {
    return (
      <div className="bg-orbs min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-4 glass-card rounded-2xl px-8 py-6">
          <div className="w-10 h-10 border-2 border-gold/60 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ink-muted">Loading saved plans...</p>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="bg-orbs min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 rounded-3xl glass-card p-8 shadow-[0_8px_40px_rgba(0,0,0,0.28),0_0_60px_rgba(255,204,0,0.04)]">
          <div className="space-y-2">
            <p className="section-kicker justify-center">Connection Error</p>
            <h1 className="text-xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
              Couldn&apos;t load saved-plan data
            </h1>
            <p className="text-sm text-ink-muted">
              MarqBot needs the course catalog and program list before it can render the library.
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
      <div className="bg-orbs min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="relative max-w-lg text-center space-y-5 rounded-3xl glass-card p-8 shadow-[0_8px_40px_rgba(0,0,0,0.28),0_0_60px_rgba(255,204,0,0.04)]">
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.08),transparent_50%)] pointer-events-none" />
          <div className="relative space-y-2">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl glass-card flex items-center justify-center float-soft">
              <svg className="w-7 h-7 text-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="section-kicker justify-center">Saved Plans</p>
            <h1 className="text-3xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
              No saved plans yet
            </h1>
            <p className="text-sm text-ink-secondary">
              Generate recommendations in Planner, then save one to start building a local comparison library.
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

  const ease = [0.22, 1, 0.36, 1] as const;

  const anim = (y: number, delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease },
        };

  return (
    <div className="bg-orbs mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 md:py-5 space-y-4">
      {/* ── Compact dashboard header ──────────────────────── */}
      <motion.section
        {...anim(14)}
        className="relative overflow-hidden rounded-2xl glass-card px-5 py-4 shadow-[0_12px_48px_rgba(0,0,0,0.22),0_0_40px_rgba(255,204,0,0.03)] md:px-6"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.08),transparent_36%),repeating-linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0.02)_1px,transparent_1px,transparent_18px)] opacity-80" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Left: title cluster */}
          <div className="space-y-1 min-w-0">
            <motion.p {...anim(6, 0.04)} className="section-kicker !text-[10px]">Saved Library</motion.p>
            <motion.h3
              {...anim(10, 0.08)}
              className="text-[clamp(1.35rem,1.9vw,1.7rem)] font-semibold leading-[1.06] text-ink-primary font-[family-name:var(--font-sora)]"
            >
              Saved plans. No tab sprawl.
            </motion.h3>
            <motion.p
              {...anim(8, 0.12)}
              className="max-w-md text-[12px] text-ink-faint md:text-[13px]"
            >
              Browse versions, compare freshness, and reopen the one you actually want.
            </motion.p>
          </div>

          {/* Right: compact KPI row */}
          <motion.div {...anim(12, 0.14)} className="flex items-stretch gap-2 shrink-0">
            {[
              { label: "Plans", value: plans.length },
              { label: "Current", value: freshCount },
              { label: "Needs update", value: staleCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-xl glass-card kpi-glow-gold px-4 py-2.5 text-center min-w-[5.5rem]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,204,0,0.06),transparent_60%)] pointer-events-none" />
                <p className="relative z-[1] text-[10px] uppercase tracking-[0.22em] text-ink-faint">{stat.label}</p>
                <p className="relative z-[1] mt-0.5 text-2xl font-bold leading-none text-ink-primary">{stat.value}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {storageError && (
        <div className="rounded-xl border border-bad/20 bg-bad-light px-4 py-3 text-sm text-bad">
          {storageError}
        </div>
      )}

      {/* ── Plan cards grid (the main event) ──────────────── */}
      <section className="space-y-3">
        <motion.p {...anim(6, 0.18)} className="section-kicker !text-[10px]">
          {visiblePlans.length} {visiblePlans.length === 1 ? "plan" : "plans"}
        </motion.p>

        {visiblePlans.length === 0 ? (
          <div className="relative rounded-[28px] glass-card px-6 py-10 text-center">
            <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_center,rgba(255,204,0,0.06),transparent_60%)] pointer-events-none" />
            <div className="relative">
              <p className="section-kicker justify-center">No Plans</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink-primary">No saved plans are available.</h3>
              <p className="mt-3 text-sm text-ink-secondary">
                Save a plan from Planner to populate this library.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visiblePlans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                freshness={freshnessById.get(plan.id) || "missing"}
                programs={programs}
                index={index}
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
