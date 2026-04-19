"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
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

type LibrarySortMode = "newest" | "freshest" | "targetSemester";

const SORT_OPTIONS: Array<{
  value: LibrarySortMode;
  label: string;
  description: string;
}> = [
  {
    value: "newest",
    label: "Newest",
    description: "See the latest saved versions first.",
  },
  {
    value: "freshest",
    label: "Freshest",
    description: "Bring plans that still match current inputs to the top.",
  },
  {
    value: "targetSemester",
    label: "Target semester",
    description: "Group the library by where each version is aiming to land.",
  },
];

const FRESHNESS_RANK: Record<SavedPlanFreshness, number> = {
  fresh: 0,
  stale: 1,
  missing: 2,
};

const TERM_RANK: Record<string, number> = {
  spring: 0,
  summer: 1,
  fall: 2,
  winter: 3,
};

function getTargetSemesterOrder(value: string): number {
  const match = String(value).trim().match(/^(spring|summer|fall|winter)\s+(\d{4})$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const season = match[1]?.toLowerCase() ?? "";
  const year = Number(match[2]);
  const seasonRank = TERM_RANK[season];
  if (!Number.isFinite(year) || seasonRank === undefined) return Number.MAX_SAFE_INTEGER;
  return year * 10 + seasonRank;
}

function compareSavedPlans(
  a: SavedPlanRecord,
  b: SavedPlanRecord,
  freshnessById: Map<string, SavedPlanFreshness>,
  sortMode: LibrarySortMode,
) {
  if (sortMode === "freshest") {
    const freshnessDelta =
      FRESHNESS_RANK[freshnessById.get(a.id) ?? "missing"] -
      FRESHNESS_RANK[freshnessById.get(b.id) ?? "missing"];
    if (freshnessDelta !== 0) return freshnessDelta;
  }

  if (sortMode === "targetSemester") {
    const semesterDelta =
      getTargetSemesterOrder(a.inputs.targetSemester) - getTargetSemesterOrder(b.inputs.targetSemester);
    if (semesterDelta !== 0) return semesterDelta;
    const labelDelta = a.inputs.targetSemester.localeCompare(b.inputs.targetSemester);
    if (labelDelta !== 0) return labelDelta;
  }

  const updatedDelta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (updatedDelta !== 0) return updatedDelta;

  return a.name.localeCompare(b.name);
}

interface PlanCardProps {
  plan: SavedPlanRecord;
  freshness: SavedPlanFreshness;
  programs: ProgramsData;
  onDelete(): void;
}

function MetricCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: number;
  accentClass: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(165deg,rgba(10,21,39,0.82),rgba(16,31,56,0.94))] px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.16)] ${accentClass}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_55%)] opacity-80" />
      <div className="relative space-y-2">
        <p className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">{label}</p>
        <p className="font-[family-name:var(--font-sora)] text-[clamp(1.6rem,2.8vw,2.3rem)] font-semibold leading-none text-ink-primary">
          {value}
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan, freshness, programs, onDelete, index }: PlanCardProps & { index: number }) {
  const reduce = useReducedMotion();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const programLine = buildSavedPlanProgramLine(plan, programs);
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);

  return (
    <motion.article
      initial={reduce ? undefined : { opacity: 0, y: 20 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={reduce ? undefined : { duration: 0.42, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -4 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(155deg,rgba(9,20,39,0.95),rgba(14,31,58,0.92)_52%,rgba(17,34,62,0.88))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] transition-[border-color,box-shadow] duration-300 hover:border-gold/30 hover:shadow-[0_22px_56px_rgba(0,0,0,0.22),0_0_24px_rgba(255,204,0,0.08)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.10),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.10),transparent_36%),repeating-linear-gradient(135deg,rgba(255,255,255,0.018),rgba(255,255,255,0.018)_1px,transparent_1px,transparent_18px)] opacity-80" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-gold/80">Target semester</p>
            <p className="mt-2 font-[family-name:var(--font-sora)] text-[1.2rem] font-semibold leading-tight text-ink-primary">
              {plan.inputs.targetSemester}
            </p>
          </div>
          <FreshnessBadge freshness={freshness} />
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">Plan context</p>
            <h2 className="text-[1.45rem] font-semibold leading-[1.02] tracking-[-0.03em] text-ink-primary" title={plan.name}>
              {plan.name}
            </h2>
            <p className="text-sm leading-6 text-ink-secondary">
              {programLine || "Program summary unavailable"}
            </p>
            <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-ink-faint">
              {plan.notes || freshnessCopy.reason}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/9 bg-white/[0.035] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">Updated</p>
            <p className="mt-2 text-lg font-semibold text-ink-primary">
              {formatSavedPlanDate(plan.updatedAt)}
            </p>
            <p className="mt-1 text-sm text-ink-faint">
              {plan.inputs.includeSummer ? "Summer included in this pacing." : "Standard term cadence."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-secondary">
            {plan.inputs.semesterCount} terms
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-secondary">
            {plan.inputs.maxRecs} max / term
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-secondary">
            {plan.inputs.completed.length} completed
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-ink-secondary">
            {plan.inputs.inProgress.length} in progress
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
          <Button asChild variant="gold" size="sm" className="min-w-[10.5rem]">
            <Link href={`/saved?plan=${encodeURIComponent(plan.id)}`}>Open saved plan</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmOpen(true);
            }}
            className="text-ink-faint hover:bg-white/[0.04] hover:text-bad"
          >
            Delete
          </Button>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bad/15">
              <svg className="h-5 w-5 text-bad" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-sora)] text-lg font-semibold text-ink-primary">
                Delete this plan?
              </h3>
              <p className="mt-0.5 text-sm text-ink-faint">This can&apos;t be undone.</p>
            </div>
          </div>

          <div className="rounded-xl border border-bad/20 bg-bad/[0.06] px-4 py-3">
            <p className="text-sm text-ink-secondary">
              <span className="font-semibold text-bad">{plan.name}</span> will be permanently deleted.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
              Keep Plan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
              className="border-bad/50 bg-bad/15 text-bad hover:border-bad/70 hover:bg-bad/25"
            >
              Yes, Delete Plan
            </Button>
          </div>
        </div>
      </Modal>
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
  const [sortMode, setSortMode] = useState<LibrarySortMode>("newest");

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

  const visiblePlans = useMemo(
    () => [...plans].sort((a, b) => compareSavedPlans(a, b, freshnessById, sortMode)),
    [freshnessById, plans, sortMode],
  );

  const staleCount = plans.filter((plan) => freshnessById.get(plan.id) === "stale").length;
  const missingCount = plans.filter((plan) => freshnessById.get(plan.id) === "missing").length;
  const freshCount = plans.filter((plan) => freshnessById.get(plan.id) === "fresh").length;

  const handleRetry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

  if (isLoading || !hydrated) {
    return (
      <div className="bg-orbs flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="space-y-4 rounded-2xl glass-card px-8 py-6 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold/60 border-t-transparent" />
          <p className="text-sm text-ink-muted">Loading saved plans...</p>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="bg-orbs flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="max-w-md space-y-4 rounded-3xl glass-card p-8 text-center shadow-[0_8px_40px_rgba(0,0,0,0.28),0_0_60px_rgba(255,204,0,0.04)]">
          <div className="space-y-2">
            <p className="section-kicker justify-center">Connection Error</p>
            <h1 className="font-[family-name:var(--font-sora)] text-xl font-semibold text-ink-primary">
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
      <div className="bg-orbs flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="relative max-w-lg space-y-5 rounded-3xl glass-card p-8 text-center shadow-[0_8px_40px_rgba(0,0,0,0.28),0_0_60px_rgba(255,204,0,0.04)]">
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.08),transparent_50%)]" />
          <div className="relative space-y-2">
            <div className="float-soft mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl glass-card">
              <svg className="h-7 w-7 text-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <p className="section-kicker justify-center">Saved Plans</p>
            <h1 className="font-[family-name:var(--font-sora)] text-3xl font-semibold text-ink-primary">
              No saved plans yet
            </h1>
            <p className="text-sm text-ink-secondary">
              Generate recommendations in Planner, then save versions here to compare different academic paths.
            </p>
          </div>
          {storageError && (
            <div className="rounded-xl border border-bad/20 bg-bad-light px-3 py-2 text-sm text-bad">
              {storageError}
            </div>
          )}
          <Button asChild variant="gold">
            <Link href="/planner">Go to Planner</Link>
          </Button>
        </div>
      </div>
    );
  }

  const ease = [0.22, 1, 0.36, 1] as const;
  const selectedSort = SORT_OPTIONS.find((option) => option.value === sortMode) ?? SORT_OPTIONS[0];

  const anim = (y: number, delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease },
        };

  return (
    <div className="bg-orbs mx-auto w-full max-w-[1600px] space-y-5 px-4 py-4 md:px-6 md:py-6">
      <motion.section
        {...anim(14)}
        className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(155deg,rgba(7,18,35,0.98),rgba(12,29,54,0.96)_48%,rgba(16,35,65,0.92))] px-6 py-6 shadow-[0_24px_64px_rgba(0,0,0,0.18)] md:px-8 md:py-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.12),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.10),transparent_34%),repeating-linear-gradient(135deg,rgba(255,255,255,0.016),rgba(255,255,255,0.016)_1px,transparent_1px,transparent_20px)] opacity-90" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] xl:items-end">
          <div className="space-y-5">
            <div className="space-y-3">
              <motion.p {...anim(6, 0.04)} className="section-kicker !text-[10px]">
                Saved plans
              </motion.p>
              <motion.h1
                {...anim(10, 0.08)}
                className="max-w-[16ch] font-[family-name:var(--font-sora)] text-[clamp(2.3rem,4.5vw,4.5rem)] font-semibold leading-[0.92] tracking-[-0.05em] text-ink-primary"
              >
                Compare the futures you&apos;ve already sketched.
              </motion.h1>
              <motion.p
                {...anim(8, 0.12)}
                className="max-w-[42rem] text-sm leading-7 text-ink-secondary md:text-[1rem]"
              >
                Keep versions side by side in your head, spot which plans still match your current inputs,
                and reopen the one that best fits the student you&apos;re trying to become.
              </motion.p>
            </div>

            <motion.div
              {...anim(10, 0.16)}
              className="rounded-[26px] border border-white/10 bg-[linear-gradient(165deg,rgba(10,21,39,0.82),rgba(14,31,56,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-[34rem] space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-ink-faint">Compare builds</p>
                  <p className="text-sm leading-6 text-ink-secondary">
                    Use one lens at a time. This pass keeps comparison simple: newest first, freshest first,
                    or arranged by target semester.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Saved plan sort options">
                  {SORT_OPTIONS.map((option) => {
                    const active = option.value === sortMode;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSortMode(option.value)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "border-gold/45 bg-gold/14 text-gold shadow-[0_0_18px_rgba(255,204,0,0.10)]"
                            : "border-white/10 bg-white/[0.03] text-ink-secondary hover:border-mu-blue/35 hover:text-ink-primary"
                        }`}
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div {...anim(12, 0.18)} className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Plans" value={plans.length} accentClass="border-gold/12" />
            <MetricCard label="Current" value={freshCount} accentClass="border-ok/12" />
            <MetricCard label="Gaps" value={staleCount + missingCount} accentClass="border-mu-blue/14" />
          </motion.div>
        </div>
      </motion.section>

      {storageError && (
        <div className="rounded-xl border border-bad/20 bg-bad-light px-4 py-3 text-sm text-bad">
          {storageError}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <motion.p {...anim(6, 0.2)} className="section-kicker !text-[10px]">
            {visiblePlans.length} {visiblePlans.length === 1 ? "plan" : "plans"}
          </motion.p>
          <motion.p {...anim(6, 0.24)} className="text-sm text-ink-faint">
            Sorted by <span className="font-medium text-ink-secondary">{selectedSort.label}</span>
          </motion.p>
        </div>

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
      </section>
    </div>
  );
}
