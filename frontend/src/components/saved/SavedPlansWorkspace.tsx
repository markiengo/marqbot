"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RecommendationsPanel } from "@/components/planner/RecommendationsPanel";
import { SemesterModal } from "@/components/planner/SemesterModal";
import { Button } from "@/components/shared/Button";
import { CourseDetailModal } from "@/components/shared/CourseDetailModal";
import { Modal } from "@/components/shared/Modal";
import { useAppContext } from "@/context/AppContext";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { buildRecommendationWarnings, sanitizeRecommendationWhy } from "@/lib/rendering";
import { buildSessionSnapshotFromSavedPlan } from "@/lib/savedPlans";
import {
  buildSavedPlanProgramLine,
  formatSavedPlanDate,
  getSavedPlanFreshnessCopy,
  resolveProgramLabels,
} from "@/lib/savedPlanPresentation";
import type {
  Course,
  ProgramsData,
  SavedPlanFreshness,
  SavedPlanRecord,
  SemesterData,
} from "@/lib/types";
import { FreshnessBadge } from "./FreshnessBadge";

type SavedPlansApi = ReturnType<typeof useSavedPlans>;
type UpdatePlanFn = SavedPlansApi["updatePlan"];
type DeletePlanFn = SavedPlansApi["deletePlan"];
type FreshnessFilter = "all" | SavedPlanFreshness;
type LibrarySortMode = "updated" | "targetSemester" | "name";

const SORT_OPTIONS: Array<{ value: LibrarySortMode; label: string }> = [
  { value: "updated", label: "Recently updated" },
  { value: "targetSemester", label: "Target semester" },
  { value: "name", label: "Name" },
];

const FRESHNESS_FILTERS: Array<{ value: FreshnessFilter; label: string }> = [
  { value: "all", label: "All plans" },
  { value: "fresh", label: "Current" },
  { value: "stale", label: "Needs refresh" },
  { value: "missing", label: "No snapshot" },
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

const CARD_PALETTE = [
  { gradient: "linear-gradient(145deg, rgba(0,114,206,0.22) 0%, rgba(0,114,206,0.06) 100%)", accent: "#0072CE" },
  { gradient: "linear-gradient(145deg, rgba(255,204,0,0.20) 0%, rgba(255,204,0,0.05) 100%)", accent: "#FFCC00" },
  { gradient: "linear-gradient(145deg, rgba(148,100,220,0.20) 0%, rgba(148,100,220,0.05) 100%)", accent: "#9464DC" },
  { gradient: "linear-gradient(145deg, rgba(20,178,160,0.20) 0%, rgba(20,178,160,0.05) 100%)", accent: "#14B2A0" },
  { gradient: "linear-gradient(145deg, rgba(220,60,100,0.18) 0%, rgba(220,60,100,0.04) 100%)", accent: "#DC3C64" },
  { gradient: "linear-gradient(145deg, rgba(30,160,97,0.20) 0%, rgba(30,160,97,0.05) 100%)", accent: "#1EA061" },
] as const;

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

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
  if (sortMode === "targetSemester") {
    const semesterDelta =
      getTargetSemesterOrder(a.inputs.targetSemester) - getTargetSemesterOrder(b.inputs.targetSemester);
    if (semesterDelta !== 0) return semesterDelta;
    const labelDelta = a.inputs.targetSemester.localeCompare(b.inputs.targetSemester);
    if (labelDelta !== 0) return labelDelta;
  }

  if (sortMode === "name") {
    const nameDelta = a.name.localeCompare(b.name);
    if (nameDelta !== 0) return nameDelta;
  }

  const freshnessDelta =
    FRESHNESS_RANK[freshnessById.get(a.id) ?? "missing"] -
    FRESHNESS_RANK[freshnessById.get(b.id) ?? "missing"];
  if (freshnessDelta !== 0 && sortMode !== "updated") return freshnessDelta;

  const updatedDelta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (updatedDelta !== 0) return updatedDelta;

  return a.name.localeCompare(b.name);
}

function makeProgramLabelMap(programs: ProgramsData): Map<string, string> {
  const map = new Map<string, string>();
  programs.majors.forEach((item) => map.set(item.id, item.label));
  programs.tracks.forEach((item) => map.set(item.id, item.label));
  programs.minors.forEach((item) => map.set(item.id, item.label));
  return map;
}

function makeBucketLabelMap(programs: ProgramsData): Map<string, string> {
  const map = new Map<string, string>();
  Object.entries(programs.bucket_labels || {}).forEach(([bucketId, label]) => {
    const id = String(bucketId || "").trim();
    const txt = String(label || "").trim();
    if (id && txt) map.set(id, txt);
  });
  return map;
}

function makeDescriptionMap(courses: Course[]): Map<string, string> {
  const map = new Map<string, string>();
  courses.forEach((course) => {
    if (course.description) map.set(course.course_code, course.description);
  });
  return map;
}

function buildSearchText(plan: SavedPlanRecord, programs: ProgramsData) {
  return [
    plan.name,
    plan.notes,
    plan.inputs.targetSemester,
    buildSavedPlanProgramLine(plan, programs),
    ...resolveProgramLabels(plan.inputs.declaredMajors, programs.majors),
    ...resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks),
    ...resolveProgramLabels(plan.inputs.declaredMinors, programs.minors),
  ]
    .join(" ")
    .toLowerCase();
}

function trimNote(value: string, fallback: string) {
  const text = String(value || fallback).trim();
  if (!text) return "";
  if (text.length <= 120) return text;
  return `${text.slice(0, 117).trimEnd()}...`;
}

function buildProgramSummary(plan: SavedPlanRecord, programs: ProgramsData) {
  return buildSavedPlanProgramLine(plan, programs) || "Program summary unavailable";
}

function filterAndSortPlans(
  plans: SavedPlanRecord[],
  freshnessById: Map<string, SavedPlanFreshness>,
  programs: ProgramsData,
  searchText: string,
  freshnessFilter: FreshnessFilter,
  sortMode: LibrarySortMode,
) {
  const query = searchText.trim().toLowerCase();
  return plans
    .filter((plan) => {
      const freshness = freshnessById.get(plan.id) ?? "missing";
      if (freshnessFilter !== "all" && freshness !== freshnessFilter) return false;
      if (!query) return true;
      return buildSearchText(plan, programs).includes(query);
    })
    .sort((a, b) => compareSavedPlans(a, b, freshnessById, sortMode));
}

function SavedPlansLoadingState({ message }: { message: string }) {
  return (
    <div className="bg-orbs flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[22px] border border-white/10 bg-surface-overlay/94 px-7 py-6 text-center shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold/60 border-t-transparent" />
        <p className="mt-4 text-sm text-ink-muted">{message}</p>
      </div>
    </div>
  );
}

function SavedPlansErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry(): void;
}) {
  return (
    <div className="bg-orbs flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="max-w-lg rounded-[24px] border border-white/10 bg-surface-overlay/95 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Saved plans</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-primary">Could not load saved plans</h1>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">{message}</p>
        <div className="mt-5">
          <Button variant="gold" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

function SavedPlansEmptyState({ storageError }: { storageError: string | null }) {
  return (
    <div className="bg-orbs flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="max-w-xl rounded-[24px] border border-white/10 bg-surface-overlay/95 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Saved plans</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-primary">No saved plans yet</h1>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          Save a planner result to review it here later.
        </p>
        {storageError ? (
          <p className="mt-4 rounded-xl border border-bad/25 bg-bad-light px-3 py-2 text-sm text-bad">
            {storageError}
          </p>
        ) : null}
        <div className="mt-5">
          <Button asChild variant="gold">
            <Link href="/planner">Go to Planner</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-surface-overlay/92 p-6 text-center">
      <h2 className="text-xl font-semibold text-ink-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">{body}</p>
    </div>
  );
}

interface SavedPlanCardProps {
  plan: SavedPlanRecord;
  programs: ProgramsData;
  freshness: SavedPlanFreshness;
  isSelected: boolean;
  paletteIndex: number;
  onSelect?: (planId: string) => void;
  href?: string;
}

function SavedPlanCard({
  plan,
  programs,
  freshness,
  isSelected,
  paletteIndex,
  onSelect,
  href,
}: SavedPlanCardProps) {
  const palette = CARD_PALETTE[paletteIndex % CARD_PALETTE.length]!;
  const programLine = buildProgramSummary(plan, programs);
  const initials = getInitials(plan.name);

  const inner = (
    <div
      style={{ background: palette.gradient }}
      className={[
        "relative flex h-full flex-col rounded-[20px] border p-4 text-left transition-all duration-150",
        isSelected
          ? "border-gold/45 shadow-[0_0_0_1px_rgba(255,204,0,0.18),0_8px_28px_rgba(0,0,0,0.28)]"
          : "border-white/10 hover:border-white/25 hover:shadow-[0_6px_22px_rgba(0,0,0,0.24)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-sm font-bold"
          style={{ background: `${palette.accent}28`, color: palette.accent }}
        >
          {initials}
        </div>
        <FreshnessBadge freshness={freshness} />
      </div>

      <div className="mt-3 flex-1">
        <h2 className="line-clamp-2 text-[0.95rem] font-semibold leading-snug text-ink-primary">
          {plan.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{programLine}</p>
      </div>

      <div className="mt-3.5 flex items-end justify-between gap-2">
        <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-ink-faint">
          {plan.inputs.targetSemester}
        </span>
        <span className="text-[10px] text-ink-faint">{formatSavedPlanDate(plan.updatedAt)}</span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-current={isSelected ? "page" : undefined}
        aria-label={`${plan.name} saved plan`}
        className="block h-full"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`${plan.name} saved plan`}
      onClick={() => onSelect?.(plan.id)}
      className="block h-full w-full text-left"
    >
      {inner}
    </button>
  );
}

interface SavedPlansGridPaneProps {
  plans: SavedPlanRecord[];
  visiblePlans: SavedPlanRecord[];
  programs: ProgramsData;
  freshnessById: Map<string, SavedPlanFreshness>;
  searchText: string;
  onSearchTextChange(value: string): void;
  freshnessFilter: FreshnessFilter;
  onFreshnessFilterChange(value: FreshnessFilter): void;
  sortMode: LibrarySortMode;
  onSortModeChange(value: LibrarySortMode): void;
  selectedPlanId: string | null;
  onSelectPlan?: (planId: string) => void;
  linkBuilder?: (planId: string) => string;
}

function SavedPlansGridPane({
  plans,
  visiblePlans,
  programs,
  freshnessById,
  searchText,
  onSearchTextChange,
  freshnessFilter,
  onFreshnessFilterChange,
  sortMode,
  onSortModeChange,
  selectedPlanId,
  onSelectPlan,
  linkBuilder,
}: SavedPlansGridPaneProps) {
  const currentCount = plans.filter((plan) => freshnessById.get(plan.id) === "fresh").length;
  const staleCount = plans.filter((plan) => freshnessById.get(plan.id) === "stale").length;
  const hasFilters = Boolean(searchText.trim()) || freshnessFilter !== "all";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-semibold tracking-[-0.03em] text-ink-primary">Saved Plans</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            {plans.length} saved · {currentCount} current · {staleCount} need refresh
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/planner">Go to Planner</Link>
        </Button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1.45fr)_minmax(10rem,0.6fr)_minmax(10rem,0.6fr)]">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Search</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            aria-label="Search saved plans"
            placeholder="Name, note, semester, or program"
            className="w-full rounded-[14px] border border-border-medium bg-surface-input px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-faint focus:border-gold/35 focus:outline-none focus:ring-2 focus:ring-gold/25"
          />
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Freshness</span>
          <select
            aria-label="Freshness filter"
            value={freshnessFilter}
            onChange={(event) => onFreshnessFilterChange(event.target.value as FreshnessFilter)}
            className="rounded-[14px] border border-border-medium bg-surface-input px-4 py-2.5 text-sm text-ink-primary focus:border-gold/35 focus:outline-none focus:ring-2 focus:ring-gold/25"
          >
            {FRESHNESS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Sort by</span>
          <select
            aria-label="Sort saved plans"
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as LibrarySortMode)}
            className="rounded-[14px] border border-border-medium bg-surface-input px-4 py-2.5 text-sm text-ink-primary focus:border-gold/35 focus:outline-none focus:ring-2 focus:ring-gold/25"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visiblePlans.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePlans.map((plan, index) => (
            <SavedPlanCard
              key={plan.id}
              plan={plan}
              programs={programs}
              freshness={freshnessById.get(plan.id) ?? "missing"}
              isSelected={plan.id === selectedPlanId}
              paletteIndex={index}
              onSelect={onSelectPlan}
              href={linkBuilder?.(plan.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <h2 className="text-lg font-semibold text-ink-primary">No plans match these filters</h2>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            Try a different search or reset the freshness filter.
          </p>
          {hasFilters ? (
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onSearchTextChange("");
                  onFreshnessFilterChange("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

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
    <div className="flex items-start gap-3">
      <dt className="w-28 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </dt>
      <dd className={`flex-1 text-sm text-ink-secondary ${multiline ? "leading-6" : ""}`}>{value}</dd>
    </div>
  );
}

function SnapshotMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-white/8 bg-white/[0.04] px-4 py-3 text-center">
      <p className="text-2xl font-bold text-ink-primary">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
    </div>
  );
}

interface SavedPlanDetailSurfaceProps {
  plan: SavedPlanRecord | null;
  freshness: SavedPlanFreshness | null;
  courses: Course[];
  programs: ProgramsData;
  programLabelMap: Map<string, string>;
  bucketLabelMap: Map<string, string>;
  descriptionMap: Map<string, string>;
  storageError: string | null;
  updatePlan: UpdatePlanFn;
  deletePlan: DeletePlanFn;
  backHref?: string;
  emptyTitle?: string;
  emptyBody?: string;
}

function SavedPlanDetailSurface({
  plan,
  freshness,
  courses,
  programs,
  programLabelMap,
  bucketLabelMap,
  descriptionMap,
  storageError,
  updatePlan,
  deletePlan,
  backHref,
  emptyTitle = "Select a saved plan",
  emptyBody = "Choose a plan from the list to review it here.",
}: SavedPlanDetailSurfaceProps) {
  const router = useRouter();
  const { dispatch } = useAppContext();
  const [selectedSemesterIdx, setSelectedSemesterIdx] = useState(0);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const [courseDetailCode, setCourseDetailCode] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftName, setDraftName] = useState(plan?.name ?? "");
  const [draftNotes, setDraftNotes] = useState(plan?.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  if (!plan || !freshness) {
    return <DetailPlaceholder title={emptyTitle} body={emptyBody} />;
  }

  const majorLabels = resolveProgramLabels(plan.inputs.declaredMajors, programs.majors);
  const trackLabels = resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks);
  const minorLabels = resolveProgramLabels(plan.inputs.declaredMinors, programs.minors);
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);
  const recommendationData = plan.recommendationData;
  const savedSnapshot = recommendationData?.mode === "recommendations" ? recommendationData : null;
  const semesters = savedSnapshot?.semesters ?? [];
  const activeSemesterIdx = semesters.length > 0 ? Math.min(selectedSemesterIdx, semesters.length - 1) : 0;
  const activeSemester = semesters[activeSemesterIdx] ?? null;
  const modalSemester = semesterModalIdx !== null ? semesters[semesterModalIdx] ?? null : null;
  const requestedCount = Number(plan.inputs.maxRecs) || plan.lastRequestedCount || 3;
  const totalCourses = semesters.reduce((sum, semester) => sum + (semester.recommendations?.length ?? 0), 0);
  const activeCourseCount = activeSemester?.recommendations?.length ?? 0;
  const primaryProgramLine = [majorLabels.join(", "), trackLabels.join(", ")].filter(Boolean).join(" / ");
  const exportHref = `/saved?plan=${encodeURIComponent(plan.id)}&export=pdf`;

  const handleResume = () => {
    dispatch({
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: buildSessionSnapshotFromSavedPlan(plan),
    });
    router.push("/planner");
  };

  const handleOpenEdit = () => {
    setFormError(null);
    setDraftName(plan.name);
    setDraftNotes(plan.notes);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    const result = updatePlan(plan.id, {
      name: draftName,
      notes: draftNotes,
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
    setEditOpen(false);
  };

  const handleDelete = () => {
    const result = deletePlan(plan.id);
    if (!result.ok) {
      setFormError(result.error || "Could not delete this plan.");
      setDeleteOpen(false);
      return;
    }
    setDeleteOpen(false);
    router.push("/saved");
  };

  const allRecommendations = semesters.flatMap((semester) => semester.recommendations ?? []);
  const selectedCourse = allRecommendations.find((course) => course.course_code === courseDetailCode);

  return (
    <>
      <section className="rounded-[24px] border border-white/10 bg-surface-overlay/92 shadow-[0_16px_44px_rgba(0,0,0,0.14)]">
        <header className="rounded-t-[24px] border-b border-white/8 bg-[rgba(10,24,48,0.96)] px-5 py-5 backdrop-blur">
          {backHref ? (
            <Link
              href={backHref}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-ink-secondary"
            >
              ← Back to saved plans
            </Link>
          ) : null}

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-ink-primary">
                  {plan.name}
                </h1>
                <FreshnessBadge freshness={freshness} />
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">
                {primaryProgramLine ? `${primaryProgramLine} · ` : ""}
                Target {plan.inputs.targetSemester} · Updated {formatSavedPlanDate(plan.updatedAt)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:justify-end">
              <Button variant="gold" size="sm" onClick={handleResume}>
                Resume in Planner
              </Button>
              {recommendationData ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={exportHref} target="_blank" rel="noopener noreferrer">
                    Export PDF
                  </Link>
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={handleOpenEdit}>
                Edit details
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-bad hover:bg-bad-light/25 hover:text-bad"
                onClick={() => {
                  setFormError(null);
                  setDeleteOpen(true);
                }}
              >
                Delete
              </Button>
            </div>
          </div>

          {!recommendationData ? (
            <p className="mt-3 text-xs text-ink-faint">PDF export requires a saved snapshot.</p>
          ) : null}
        </header>

        <div className="grid gap-5 p-5 md:p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div className="space-y-5">
            <section className="rounded-[20px] border border-white/8 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
                <h2 className="text-lg font-semibold text-ink-primary">Snapshot</h2>
                {activeSemester ? (
                  <span className="text-sm text-ink-muted">
                    {activeSemester.target_semester ?? `Semester ${activeSemesterIdx + 1}`} · {activeCourseCount} courses
                  </span>
                ) : null}
              </div>

              {semesters.length > 0 ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {semesters.map((semester, index) => {
                      const count = semester.recommendations?.length ?? 0;
                      const active = index === activeSemesterIdx;
                      return (
                        <button
                          key={`${semester.target_semester ?? "semester"}-${index}`}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedSemesterIdx(index)}
                          className={[
                            "rounded-full border px-3.5 py-1 text-sm font-medium transition-colors whitespace-nowrap",
                            active
                              ? "border-gold/40 bg-gold/12 text-ink-primary"
                              : "border-white/10 bg-white/[0.03] text-ink-secondary hover:border-white/20 hover:text-ink-primary",
                          ].join(" ")}
                          aria-label={`View ${semester.target_semester ?? `semester ${index + 1}`} saved semester`}
                        >
                          {semester.target_semester ?? `Semester ${index + 1}`}
                          <span className="ml-1.5 text-[11px] opacity-60">{count}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSemesterModalIdx(activeSemesterIdx)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-sm text-ink-faint transition-colors hover:border-white/20 hover:text-ink-secondary"
                    >
                      Expand ↗
                    </button>
                  </div>

                  <div className="mt-5 min-h-[22rem]">
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
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
                  <h3 className="text-base font-semibold text-ink-primary">No snapshot attached</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-secondary">
                    Save a planner run to review saved semesters here.
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[20px] border border-white/8 bg-white/[0.03] p-5">
              <h2 className="mb-4 text-base font-semibold text-ink-primary">Plan details</h2>
              <dl className="grid gap-3">
                <DetailRow label="Program" value={primaryProgramLine || "Not set"} multiline />
                {minorLabels.length > 0 ? (
                  <DetailRow label="Minors" value={minorLabels.join(", ")} multiline />
                ) : null}
                <DetailRow label="Target" value={plan.inputs.targetSemester} />
                <DetailRow
                  label="Pacing"
                  value={`${plan.inputs.semesterCount} terms · ${plan.inputs.maxRecs} max / term`}
                />
                <DetailRow label="Summer" value={plan.inputs.includeSummer ? "Included" : "Skipped"} />
                {plan.notes ? (
                  <DetailRow label="Note" value={plan.notes} multiline />
                ) : null}
              </dl>
            </section>

            <section className="rounded-[20px] border border-white/8 bg-white/[0.03] p-5">
              <h2 className="mb-4 text-base font-semibold text-ink-primary">Summary</h2>
              <div className="grid grid-cols-2 gap-3">
                <SnapshotMetric label="Semesters" value={String(semesters.length)} />
                <SnapshotMetric label="Courses" value={String(totalCourses)} />
              </div>
              <dl className="mt-4 grid gap-3">
                <DetailRow label="Completed" value={String(plan.inputs.completed.length)} />
                <DetailRow label="In progress" value={String(plan.inputs.inProgress.length)} />
                <DetailRow label="Freshness" value={freshnessCopy.reason} multiline />
              </dl>
            </section>

            {formError ? (
              <p className="rounded-xl border border-bad/25 bg-bad-light px-3 py-2 text-sm text-bad">
                {formError}
              </p>
            ) : null}

            {storageError ? (
              <p className="rounded-xl border border-bad/25 bg-bad-light px-3 py-2 text-sm text-bad">
                {storageError}
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit plan details">
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Plan name
            </span>
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="w-full rounded-[18px] border border-border-medium bg-surface-input px-4 py-3 text-sm text-ink-primary focus:border-gold/35 focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Saved note
            </span>
            <textarea
              rows={4}
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              placeholder="Add context for why you saved this version."
              className="w-full resize-none rounded-[18px] border border-border-medium bg-surface-input px-4 py-3 text-sm leading-6 text-ink-primary focus:border-gold/35 focus:outline-none focus:ring-2 focus:ring-gold/25"
            />
          </label>
          {formError ? <p className="text-sm text-bad">{formError}</p> : null}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={handleSaveEdit}
              disabled={!draftName.trim()}
            >
              Save changes
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete saved plan?">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-ink-secondary">
            <span className="font-semibold text-ink-primary">{plan.name}</span> will be permanently removed from
            your saved library.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>
              Keep plan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-bad/40 bg-bad/12 text-bad hover:border-bad/60 hover:bg-bad-light/25"
              onClick={handleDelete}
            >
              Yes, delete plan
            </Button>
          </div>
        </div>
      </Modal>

      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={() => setSemesterModalIdx(null)}
        semester={modalSemester as SemesterData | null}
        index={semesterModalIdx ?? 0}
        totalCount={semesters.length}
        requestedCount={requestedCount}
        courses={courses}
        declaredMajors={plan.inputs.declaredMajors}
        declaredTracks={plan.inputs.declaredTracks}
        declaredMinors={plan.inputs.declaredMinors}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
        programOrder={[...plan.inputs.declaredMajors, ...plan.inputs.declaredTracks, ...plan.inputs.declaredMinors]}
        onCourseClick={setCourseDetailCode}
      />

      <CourseDetailModal
        open={courseDetailCode !== null}
        onClose={() => setCourseDetailCode(null)}
        courseCode={courseDetailCode ?? ""}
        courseName={selectedCourse?.course_name}
        credits={selectedCourse?.credits}
        description={courseDetailCode ? descriptionMap.get(courseDetailCode) ?? null : null}
        prereqRaw={courseDetailCode ? courses.find((course) => course.course_code === courseDetailCode)?.catalog_prereq_raw : null}
        buckets={selectedCourse?.fills_buckets}
        plannerReason={sanitizeRecommendationWhy(selectedCourse?.why)}
        plannerNotes={selectedCourse?.notes}
        plannerWarnings={buildRecommendationWarnings(selectedCourse)}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
      />
    </>
  );
}

function useSavedWorkspaceData() {
  const { courses, loading: coursesLoading, error: coursesError, retry: retryCourses } = useCourses();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms();
  const {
    hydrated,
    plans,
    storageError,
    updatePlan,
    deletePlan,
    getFreshness,
  } = useSavedPlans();

  const isLoading =
    coursesLoading ||
    programsLoading ||
    (!courses.length && !coursesError) ||
    (!programs.majors.length && !programsError) ||
    !hydrated;

  const bootstrapError =
    (!courses.length ? coursesError : null) ??
    (!programs.majors.length ? programsError : null);

  const freshnessById = useMemo(
    () => new Map(plans.map((plan) => [plan.id, getFreshness(plan)])),
    [getFreshness, plans],
  );
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const programLabelMap = useMemo(() => makeProgramLabelMap(programs), [programs]);
  const bucketLabelMap = useMemo(() => makeBucketLabelMap(programs), [programs]);
  const descriptionMap = useMemo(() => makeDescriptionMap(courses), [courses]);

  const retry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

  return {
    courses,
    programs,
    plans,
    storageError,
    updatePlan,
    deletePlan,
    freshnessById,
    planById,
    programLabelMap,
    bucketLabelMap,
    descriptionMap,
    isLoading,
    bootstrapError,
    retry,
  };
}

function SavedPlansWorkspaceLoaded({ planId }: { planId: string | null }) {
  const data = useSavedWorkspaceData();
  const [searchText, setSearchText] = useState("");
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>("all");
  const [sortMode, setSortMode] = useState<LibrarySortMode>("updated");

  if (data.isLoading) {
    return <SavedPlansLoadingState message="Loading saved plans..." />;
  }
  if (data.bootstrapError) {
    return <SavedPlansErrorState message={data.bootstrapError} onRetry={data.retry} />;
  }
  if (data.plans.length === 0 && !planId) {
    return <SavedPlansEmptyState storageError={data.storageError} />;
  }

  const visiblePlans = filterAndSortPlans(
    data.plans,
    data.freshnessById,
    data.programs,
    searchText,
    freshnessFilter,
    sortMode,
  );

  if (planId) {
    const plan = data.planById.get(planId) ?? null;
    return (
      <div className="bg-orbs min-h-[calc(100vh-4rem)] px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-[1240px]">
          <SavedPlanDetailSurface
            key={plan?.id ?? `detail-missing-${planId}`}
            plan={plan}
            freshness={plan ? data.freshnessById.get(plan.id) ?? "missing" : null}
            courses={data.courses}
            programs={data.programs}
            programLabelMap={data.programLabelMap}
            bucketLabelMap={data.bucketLabelMap}
            descriptionMap={data.descriptionMap}
            storageError={data.storageError}
            updatePlan={data.updatePlan}
            deletePlan={data.deletePlan}
            backHref="/saved"
            emptyTitle="Saved plan not found"
            emptyBody="This saved plan is missing. It may have been deleted in another browser session."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orbs min-h-[calc(100vh-4rem)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1400px]">
        <SavedPlansGridPane
          plans={data.plans}
          visiblePlans={visiblePlans}
          programs={data.programs}
          freshnessById={data.freshnessById}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          freshnessFilter={freshnessFilter}
          onFreshnessFilterChange={setFreshnessFilter}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          selectedPlanId={null}
          linkBuilder={(targetPlanId) => `/saved?plan=${encodeURIComponent(targetPlanId)}`}
        />
      </div>
    </div>
  );
}

export function SavedPlansLibraryScaffold() {
  const data = useSavedWorkspaceData();
  const [searchText, setSearchText] = useState("");
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>("all");
  const [sortMode, setSortMode] = useState<LibrarySortMode>("updated");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (data.isLoading) {
    return <SavedPlansLoadingState message="Loading saved plans..." />;
  }
  if (data.bootstrapError) {
    return <SavedPlansErrorState message={data.bootstrapError} onRetry={data.retry} />;
  }
  if (data.plans.length === 0) {
    return <SavedPlansEmptyState storageError={data.storageError} />;
  }

  const visiblePlans = filterAndSortPlans(
    data.plans,
    data.freshnessById,
    data.programs,
    searchText,
    freshnessFilter,
    sortMode,
  );

  const selectedPlan = visiblePlans.find((plan) => plan.id === selectedPlanId) ?? visiblePlans[0] ?? null;

  return (
    <div className="bg-orbs min-h-[calc(100vh-4rem)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1600px] xl:grid xl:grid-cols-[minmax(28rem,1fr)_minmax(0,1fr)] xl:items-start xl:gap-6">
        <div>
          <SavedPlansGridPane
            plans={data.plans}
            visiblePlans={visiblePlans}
            programs={data.programs}
            freshnessById={data.freshnessById}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            freshnessFilter={freshnessFilter}
            onFreshnessFilterChange={setFreshnessFilter}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            selectedPlanId={selectedPlan?.id ?? null}
            onSelectPlan={setSelectedPlanId}
          />
        </div>

        <div className="mt-6 xl:mt-0">
          {visiblePlans.length === 0 ? (
            <DetailPlaceholder
              title="No saved plans match these filters"
              body="Adjust your filters to preview a saved plan."
            />
          ) : (
            <SavedPlanDetailSurface
              key={selectedPlan?.id ?? "library-empty"}
              plan={selectedPlan}
              freshness={selectedPlan ? data.freshnessById.get(selectedPlan.id) ?? "missing" : null}
              courses={data.courses}
              programs={data.programs}
              programLabelMap={data.programLabelMap}
              bucketLabelMap={data.bucketLabelMap}
              descriptionMap={data.descriptionMap}
              storageError={data.storageError}
              updatePlan={data.updatePlan}
              deletePlan={data.deletePlan}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function SavedPlanDetailScaffold({ planId }: { planId: string }) {
  const data = useSavedWorkspaceData();

  if (data.isLoading) {
    return <SavedPlansLoadingState message="Loading saved plan..." />;
  }
  if (data.bootstrapError) {
    return <SavedPlansErrorState message={data.bootstrapError} onRetry={data.retry} />;
  }

  const plan = data.planById.get(planId) ?? null;

  return (
    <div className="bg-orbs min-h-[calc(100vh-4rem)] px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1240px]">
        <SavedPlanDetailSurface
          key={plan?.id ?? `detail-missing-${planId}`}
          plan={plan}
          freshness={plan ? data.freshnessById.get(plan.id) ?? "missing" : null}
          courses={data.courses}
          programs={data.programs}
          programLabelMap={data.programLabelMap}
          bucketLabelMap={data.bucketLabelMap}
          descriptionMap={data.descriptionMap}
          storageError={data.storageError}
          updatePlan={data.updatePlan}
          deletePlan={data.deletePlan}
          backHref="/saved"
          emptyTitle="Saved plan not found"
          emptyBody="This saved plan is missing. It may have been deleted in another browser session."
        />
      </div>
    </div>
  );
}

export function SavedPlansWorkspace({ planId }: { planId: string | null }) {
  return <SavedPlansWorkspaceLoaded planId={planId} />;
}
