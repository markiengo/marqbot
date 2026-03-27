"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { useAppContext } from "@/context/AppContext";
import { useReducedEffects } from "@/context/EffectsContext";
import { filterCourses } from "@/lib/utils";
import type { Course, ImportResult, ImportRow, ImportStatus } from "@/lib/types";

type ReviewDisposition = "completed" | "in_progress" | "skip";

interface ReviewResolution {
  query: string;
  selectedCode: string;
  reviewStatus: ReviewDisposition;
}

interface ReviewRow extends ImportRow {
  reviewKey: string;
}

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const LOW_CONFIDENCE_THRESHOLD = 0.8;
let courseHistoryParserPromise: Promise<typeof import("@/lib/courseHistoryImport")> | null = null;

interface TutorialStep {
  tag: string;
  heading: string;
  body: string;
  visual: "screenshot" | "review" | "apply";
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    tag: "Step 1",
    heading: "Snap your CheckMarq history",
    body: "Go on CheckMarq, find your Graduation Checklist, and scroll to the bottom. Screenshot the Course History table \u2014 crop around the rows and MarqBot ignores the rest.",
    visual: "screenshot",
  },
  {
    tag: "Step 2",
    heading: "Review what MarqBot matched",
    body: "MarqBot reads the screenshot locally in your browser, matches rows to our catalog, and shows you a review screen. Nothing touches your profile until you say so.",
    visual: "review",
  },
  {
    tag: "Step 3",
    heading: "Apply & keep editing",
    body: "Hit Apply to load matched courses into your plan. You can always adjust with the normal course chips afterwards \u2014 the import is just a head start.",
    visual: "apply",
  },
];

function reviewKey(prefix: string, row: ImportRow, index: number): string {
  return `${prefix}-${row.course_code || "unmatched"}-${row.term || "term"}-${index}`;
}

function dedupeCodes(codes: string[]): string[] {
  return [...new Set(codes.filter(Boolean))];
}

function initialDisposition(row: ImportRow): ReviewDisposition {
  if (row.status === "completed") return "completed";
  if (row.status === "in_progress") return "in_progress";
  return "skip";
}

function partitionResult(result: ImportResult | null) {
  if (!result) {
    return {
      completedMatches: [] as ImportRow[],
      inProgressMatches: [] as ImportRow[],
      needsReview: [] as ReviewRow[],
    };
  }

  const completedMatches = result.completed_matches.filter((row) => row.confidence >= LOW_CONFIDENCE_THRESHOLD);
  const inProgressMatches = result.in_progress_matches.filter((row) => row.confidence >= LOW_CONFIDENCE_THRESHOLD);
  const lowConfidenceRows = [
    ...result.completed_matches
      .filter((row) => row.confidence < LOW_CONFIDENCE_THRESHOLD)
      .map((row, index) => ({
        ...row,
        suggested_matches: dedupeCodes([row.course_code || "", ...(row.suggested_matches || [])]),
        reviewKey: reviewKey("completed", row, index),
      })),
    ...result.in_progress_matches
      .filter((row) => row.confidence < LOW_CONFIDENCE_THRESHOLD)
      .map((row, index) => ({
        ...row,
        suggested_matches: dedupeCodes([row.course_code || "", ...(row.suggested_matches || [])]),
        reviewKey: reviewKey("in-progress", row, index),
      })),
    ...result.unmatched_rows.map((row, index) => ({
      ...row,
      reviewKey: reviewKey("unmatched", row, index),
    })),
  ];

  return { completedMatches, inProgressMatches, needsReview: lowConfidenceRows };
}

function loadCourseHistoryParser() {
  if (!courseHistoryParserPromise) {
    courseHistoryParserPromise = import("@/lib/courseHistoryImport");
  }
  return courseHistoryParserPromise;
}


export function CourseHistoryImport() {
  const { state, dispatch } = useAppContext();
  const reducedEffects = useReducedEffects();
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [selectedCompleted, setSelectedCompleted] = useState<Set<string>>(new Set());
  const [selectedInProgress, setSelectedInProgress] = useState<Set<string>>(new Set());
  const [reviewResolutions, setReviewResolutions] = useState<Record<string, ReviewResolution>>({});
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const courseByCode = useMemo(() => {
    const map = new Map<string, Course>();
    state.courses.forEach((course) => map.set(course.course_code, course));
    return map;
  }, [state.courses]);

  const { completedMatches, inProgressMatches, needsReview } = useMemo(
    () => partitionResult(result),
    [result],
  );

  useEffect(() => {
    if (!result) {
      setSelectedCompleted(new Set());
      setSelectedInProgress(new Set());
      setReviewResolutions({});
      return;
    }
    setSelectedCompleted(new Set(completedMatches.map((row) => row.course_code).filter(Boolean) as string[]));
    setSelectedInProgress(new Set(inProgressMatches.map((row) => row.course_code).filter(Boolean) as string[]));
    setReviewResolutions(
      Object.fromEntries(
        needsReview.map((row) => [
          row.reviewKey,
          {
            query: "",
            selectedCode: row.course_code || row.suggested_matches?.[0] || "",
            reviewStatus: initialDisposition(row),
          },
        ]),
      ),
    );
  }, [completedMatches, inProgressMatches, needsReview, result]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
    setApplyNotice(null);
    setSelectedCompleted(new Set());
    setSelectedInProgress(new Set());
    setReviewResolutions({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleImport = useCallback(async (file: File) => {
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setStatus("failed");
      setError("Course history screenshots must be 5MB or smaller.");
      setResult(null);
      return;
    }

    setApplyNotice(null);
    setError(null);
    setResult(null);
    setStatus("preprocessing");
    try {
      const { parseCourseHistoryScreenshot } = await loadCourseHistoryParser();
      const nextResult = await parseCourseHistoryScreenshot(file, state.courses, {
        onStageChange: (nextStage) => setStatus(nextStage),
      });
      setResult(nextResult);
      setStatus("parsed");
    } catch (nextError) {
      setStatus("failed");
      setError(nextError instanceof Error ? nextError.message : "Course history import failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [state.courses]);

  const onFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImport(file);
  }, [handleImport]);

  const toggleCode = useCallback((bucket: "completed" | "in_progress", code: string, checked: boolean) => {
    const setter = bucket === "completed" ? setSelectedCompleted : setSelectedInProgress;
    setter((previous) => {
      const next = new Set(previous);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    setApplyNotice(null);
  }, []);

  const updateResolution = useCallback((key: string, patch: Partial<ReviewResolution>) => {
    setReviewResolutions((previous) => ({
      ...previous,
      [key]: { ...previous[key], ...patch },
    }));
    setApplyNotice(null);
  }, []);

  const matchedCount = (result?.summary.completed_count ?? 0) + (result?.summary.in_progress_count ?? 0);
  const resolvedReviewCount = needsReview.reduce((count, row) => {
    const resolution = reviewResolutions[row.reviewKey];
    if (!resolution || resolution.reviewStatus === "skip" || !resolution.selectedCode) return count;
    return count + 1;
  }, 0);

  const applyImport = useCallback(() => {
    const completed = new Set(selectedCompleted);
    const inProgress = new Set(selectedInProgress);
    needsReview.forEach((row) => {
      const resolution = reviewResolutions[row.reviewKey];
      if (!resolution || resolution.reviewStatus === "skip" || !resolution.selectedCode) return;
      if (resolution.reviewStatus === "completed") {
        inProgress.delete(resolution.selectedCode);
        completed.add(resolution.selectedCode);
      } else {
        completed.delete(resolution.selectedCode);
        inProgress.add(resolution.selectedCode);
      }
    });

    dispatch({
      type: "IMPORT_COURSES",
      payload: { completed: [...completed], inProgress: [...inProgress] },
    });
    setApplyNotice(`Imported ${completed.size} completed and ${inProgress.size} in-progress courses.`);
  }, [dispatch, needsReview, reviewResolutions, selectedCompleted, selectedInProgress]);

  const canApply = selectedCompleted.size > 0 || selectedInProgress.size > 0 || resolvedReviewCount > 0;

  return (
    <section className="onboarding-panel overflow-hidden rounded-[1.9rem] shadow-[0_22px_40px_rgba(0,0,0,0.24)]">
      <div className="border-b border-border-subtle px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <div className="onboarding-pill onboarding-pill-gold inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
              Screenshot Import
            </div>
            <h3 className="font-[family-name:var(--font-sora)] text-[1.45rem] font-semibold tracking-[-0.03em] text-ink-primary sm:text-[1.7rem]">
              Drop in your CheckMarq history.
            </h3>
            <p className="text-sm leading-relaxed text-ink-secondary sm:text-[0.97rem]">
              Screenshot your course history, and MarqBot handles the rest.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTutorialOpen(true)}
              className="onboarding-ghost-button rounded-full px-4 py-2 hover:border-gold/40 hover:bg-gold/14 hover:text-gold"
            >
              <svg className="mr-1.5 h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
              </svg>
              How it works
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="ink"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === "preprocessing" || status === "parsing"}
              className="rounded-full px-5"
            >
              Upload Screenshot
            </Button>
          </div>
        </div>
      </div>

      <ImportTutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      <div className="px-5 py-5 sm:px-6">
        {status !== "idle" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="onboarding-panel-soft rounded-[1.5rem] border-dashed px-4 py-4">
              <p className="text-sm font-semibold text-ink-primary">Best results</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                Crop tightly around the table. JPG, PNG, WEBP, or GIF. Max 5MB. Footer notes and GPA lines
                are ignored.
              </p>
            </div>
            <ImportStatusBar status={status} matchedCount={matchedCount} totalRows={result?.summary.total_rows ?? 0} />
          </div>
        )}

        {error && (
          <motion.div
            initial={reducedEffects ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={reducedEffects ? { opacity: 1 } : { opacity: 1, y: 0 }}
            className="onboarding-panel-danger mt-4 rounded-[1.25rem] px-4 py-4 text-sm text-ink-primary"
          >
            {error}
          </motion.div>
        )}
        {applyNotice && (
          <motion.div
            initial={reducedEffects ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={reducedEffects ? { opacity: 1 } : { opacity: 1, y: 0 }}
            className="onboarding-panel-success mt-4 rounded-[1.25rem] px-4 py-4 text-sm text-ink-primary"
          >
            {applyNotice}
          </motion.div>
        )}

        <AnimatePresence>
          {result && status === "parsed" && (
            <motion.div
              initial={reducedEffects ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={reducedEffects ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedEffects ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: reducedEffects ? 0.16 : 0.24 }}
              className="mt-5 space-y-4"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="onboarding-panel-gold rounded-[1.4rem] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light">Match rate</p>
                  <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-ink-primary">
                    Matched {matchedCount} of {result.summary.total_rows} rows
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                    Rows MarqBot can place cleanly are pre-checked. Anything ambiguous stays in review until you confirm it.
                  </p>
                </div>
                <div className="onboarding-panel-soft rounded-[1.4rem] px-4 py-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <StatChip label="Completed" value={result.summary.completed_count} />
                    <StatChip label="In Progress" value={result.summary.in_progress_count} />
                    <StatChip label="Review" value={result.summary.unmatched_count} />
                    <StatChip label="Ignored" value={result.summary.ignored_count} />
                  </div>
                </div>
              </div>
              <MatchSection
                title="Completed"
                subtitle="These rows look like finished credit."
                rows={completedMatches}
                selectedCodes={selectedCompleted}
                onToggle={(code, checked) => toggleCode("completed", code, checked)}
                tone="blue"
              />
              <MatchSection
                title="In Progress"
                subtitle="These rows look like active or upcoming enrollment."
                rows={inProgressMatches}
                selectedCodes={selectedInProgress}
                onToggle={(code, checked) => toggleCode("in_progress", code, checked)}
                tone="gold"
              />
              {needsReview.length > 0 && (
                <NeedsReviewSection
                  rows={needsReview}
                  courses={state.courses}
                  courseByCode={courseByCode}
                  reviewResolutions={reviewResolutions}
                  onUpdate={updateResolution}
                />
              )}
              {result.ignored_rows.length > 0 && <IgnoredSection rows={result.ignored_rows} />}
              <div className="onboarding-panel-soft flex flex-wrap items-center justify-between gap-3 rounded-[1.45rem] px-4 py-4">
                <p className="text-sm leading-relaxed text-ink-secondary">
                  Apply what looks right now, then keep editing with the normal course chips below.
                  {reducedEffects ? " Screenshot OCR may take a bit longer on lower-power setups." : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={reset}
                    className="onboarding-ghost-button rounded-full px-4 py-2"
                  >
                    Try Again
                  </Button>
                  <Button
                    type="button"
                    variant="ink"
                    onClick={applyImport}
                    disabled={!canApply}
                    className="rounded-full px-5"
                  >
                    Apply Imported Courses
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="onboarding-panel-soft rounded-[1rem] px-3 py-2 text-ink-secondary">
      <p className="text-[1.1rem] font-semibold tracking-[-0.03em] text-ink-primary">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{label}</p>
    </div>
  );
}

function MatchSection({
  title,
  subtitle,
  rows,
  selectedCodes,
  onToggle,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: ImportRow[];
  selectedCodes: Set<string>;
  onToggle: (code: string, checked: boolean) => void;
  tone: "blue" | "gold";
}) {
  if (rows.length === 0) return null;

  const palette =
    tone === "blue"
      ? {
          wrapper: "onboarding-panel border-[rgba(0,114,206,0.24)]",
          badge: "onboarding-pill onboarding-pill-blue",
          accent: "accent-ink-accent-blue",
        }
      : {
          wrapper: "onboarding-panel-gold",
          badge: "onboarding-pill onboarding-pill-gold",
          accent: "accent-gold",
        };

  return (
    <section className={`rounded-[1.55rem] border px-4 py-4 sm:px-5 ${palette.wrapper}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light">{title}</p>
          <h4 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.03em] text-ink-primary">
            {rows.length} {rows.length === 1 ? "row" : "rows"} ready to apply
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{subtitle}</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${palette.badge}`}>
          {selectedCodes.size} selected
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const code = row.course_code || "";
          return (
            <label
              key={`${code}-${row.term}`}
              className="onboarding-panel-soft flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={selectedCodes.has(code)}
                onChange={(event) => onToggle(code, event.target.checked)}
                className={`h-4 w-4 shrink-0 ${palette.accent}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-ink-primary">{code}</span>
                </div>
                <p className="truncate text-xs text-ink-secondary">{row.term || "term unknown"}</p>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function NeedsReviewSection({
  rows,
  courses,
  courseByCode,
  reviewResolutions,
  onUpdate,
}: {
  rows: ReviewRow[];
  courses: Course[];
  courseByCode: Map<string, Course>;
  reviewResolutions: Record<string, ReviewResolution>;
  onUpdate: (key: string, patch: Partial<ReviewResolution>) => void;
}) {
  const resolvedCount = rows.reduce((count, row) => {
    const resolution = reviewResolutions[row.reviewKey];
    if (!resolution || resolution.reviewStatus === "skip" || !resolution.selectedCode) return count;
    return count + 1;
  }, 0);

  return (
    <section className="onboarding-panel rounded-[1.55rem] border-[rgba(199,59,69,0.22)] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bad">Needs Review</p>
          <h4 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.03em] text-ink-primary">
            Resolve the rows MarqBot won&apos;t auto-apply.
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
            Use a suggestion, search the catalog manually, or skip the row.
          </p>
        </div>
        <div className="onboarding-pill onboarding-pill-danger rounded-full px-3 py-1 text-xs font-semibold">
          {resolvedCount} resolved
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <NeedsReviewCard
            key={row.reviewKey}
            row={row}
            courses={courses}
            courseByCode={courseByCode}
            resolution={reviewResolutions[row.reviewKey]}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </section>
  );
}

function NeedsReviewCard({
  row,
  courses,
  courseByCode,
  resolution,
  onUpdate,
}: {
  row: ReviewRow;
  courses: Course[];
  courseByCode: Map<string, Course>;
  resolution?: ReviewResolution;
  onUpdate: (key: string, patch: Partial<ReviewResolution>) => void;
}) {
  const safeResolution = resolution ?? {
    query: "",
    selectedCode: "",
    reviewStatus: initialDisposition(row),
  };
  const selectedCourse = safeResolution.selectedCode ? courseByCode.get(safeResolution.selectedCode) : null;
  const suggestedCourses = (row.suggested_matches || [])
    .map((code) => courseByCode.get(code))
    .filter((course): course is Course => Boolean(course));
  const searchResults = useMemo(() => {
    if (!safeResolution.query.trim()) return [];
    return filterCourses(safeResolution.query, new Set<string>(), courses);
  }, [courses, safeResolution.query]);

  return (
    <div className="onboarding-panel-soft rounded-[1.25rem] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="onboarding-pill onboarding-pill-danger rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
              {row.reason || row.status}
            </span>
          </div>
          <p className="text-sm font-semibold text-ink-primary">{row.source_text}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">{row.term || "term unknown"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DispositionButton
            active={safeResolution.reviewStatus === "completed"}
            tone="blue"
            onClick={() => onUpdate(row.reviewKey, { reviewStatus: "completed" })}
          >
            Completed
          </DispositionButton>
          <DispositionButton
            active={safeResolution.reviewStatus === "in_progress"}
            tone="gold"
            onClick={() => onUpdate(row.reviewKey, { reviewStatus: "in_progress" })}
          >
            In Progress
          </DispositionButton>
          <DispositionButton
            active={safeResolution.reviewStatus === "skip"}
            tone="neutral"
            onClick={() => onUpdate(row.reviewKey, { reviewStatus: "skip" })}
          >
            Skip
          </DispositionButton>
        </div>
      </div>

      {suggestedCourses.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedCourses.map((course) => (
            <button
              key={course.course_code}
              type="button"
              onClick={() => onUpdate(row.reviewKey, { selectedCode: course.course_code })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                safeResolution.selectedCode === course.course_code
                  ? "onboarding-pill onboarding-pill-blue"
                  : "onboarding-pill"
              }`}
            >
              {course.course_code}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Search catalog
        </label>
        <input
          type="text"
          value={safeResolution.query}
          onChange={(event) => onUpdate(row.reviewKey, { query: event.target.value })}
          placeholder="Search for the right course code"
          className="onboarding-input w-full rounded-xl px-4 py-3 text-sm"
        />
      </div>

      {searchResults.length > 0 && (
        <div className="onboarding-panel-soft mt-3 rounded-[1rem] p-2">
          <div className="grid gap-2">
            {searchResults.map((course) => (
              <button
                key={course.course_code}
                type="button"
                onClick={() => onUpdate(row.reviewKey, { selectedCode: course.course_code })}
                className="flex items-start justify-between gap-3 rounded-[0.9rem] px-3 py-2 text-left transition-colors hover:bg-[rgba(141,170,224,0.12)]"
              >
                <div>
                  <p className="text-sm font-semibold text-mu-blue">{course.course_code}</p>
                  <p className="text-xs text-ink-secondary">{course.course_name}</p>
                </div>
                <span className="text-xs font-semibold text-gold-light">{course.credits}cr</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="onboarding-panel-soft mt-3 rounded-[1rem] px-3 py-3 text-sm text-ink-secondary">
        {selectedCourse ? (
          <span>
            Selected: <span className="font-semibold text-ink-primary">{selectedCourse.course_code}</span>
            {selectedCourse.course_name ? ` - ${selectedCourse.course_name}` : ""}
          </span>
        ) : (
          "No course selected yet."
        )}
      </div>
    </div>
  );
}

function IgnoredSection({ rows }: { rows: ImportRow[] }) {
  return (
    <section className="onboarding-panel-soft rounded-[1.55rem] px-4 py-4 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Ignored</p>
      <h4 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-ink-primary">
        Informational rows MarqBot left out.
      </h4>
      <div className="mt-3 grid gap-2">
        {rows.map((row, index) => (
          <div
            key={`${row.source_text}-${index}`}
            className="onboarding-panel rounded-[1.15rem] px-3 py-3 text-sm text-ink-secondary opacity-80"
          >
            <p className="font-medium text-ink-primary">{row.source_text}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-muted">{row.reason || "ignored"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ImportStatusBar({
  status,
  matchedCount,
  totalRows,
}: {
  status: ImportStatus;
  matchedCount: number;
  totalRows: number;
}) {
  const steps: { key: ImportStatus | "idle"; label: string }[] = [
    { key: "idle", label: "Upload" },
    { key: "preprocessing", label: "Preparing" },
    { key: "parsing", label: "Reading" },
    { key: "parsed", label: "Done" },
  ];

  const activeIndex = status === "failed" ? -1 : steps.findIndex((s) => s.key === status);
  const percent = status === "parsed" ? 100 : status === "parsing" ? 66 : status === "preprocessing" ? 33 : 0;
  const isFailed = status === "failed";

  return (
    <div className="onboarding-panel-soft rounded-[1.5rem] px-4 py-4" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light">Import status</p>
        {status === "parsed" && totalRows > 0 && (
          <p className="text-[11px] font-semibold text-ok">
            {matchedCount}/{totalRows} matched
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <motion.div
          className={`h-full rounded-full ${isFailed ? "bg-bad" : "bg-gold"}`}
          initial={{ width: 0 }}
          animate={{ width: isFailed ? "100%" : `${percent}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      {/* Step labels */}
      <div className="mt-2.5 flex justify-between">
        {steps.map((s, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          return (
            <span
              key={s.key}
              className={`text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                isFailed ? "text-bad" :
                isActive ? "text-gold" :
                isDone ? "text-ink-secondary" :
                "text-ink-faint/50"
              }`}
            >
              {s.label}
            </span>
          );
        })}
      </div>

      {isFailed && (
        <p className="mt-2 text-xs text-bad">Import failed. Retry or add courses manually.</p>
      )}
    </div>
  );
}

function ImportTutorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    if (open) return;
    const resetTimer = window.setTimeout(() => setStep(0), 0);
    return () => window.clearTimeout(resetTimer);
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="How Screenshot Import Works" size="xl">
      <div className="flex flex-col gap-6">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {TUTORIAL_STEPS.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setStep(index)}
              aria-label={`Go to step ${index + 1}`}
              className="group relative flex h-8 w-8 items-center justify-center"
            >
              <motion.div
                animate={{
                  width: index === step ? 28 : 10,
                  backgroundColor: index === step ? "var(--color-ink-accent-blue)" : index < step ? "var(--color-gold)" : "var(--color-ink-faint)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="h-[10px] rounded-full"
              />
            </button>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Visual area */}
            <div className="onboarding-panel relative mx-auto mb-6 overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.22)]">
              {current.visual === "screenshot" && (
                <div className="relative">
                  <Image
                    src="/assets/coursehistory.jpg"
                    alt="Example CheckMarq course history table"
                    width={440}
                    height={300}
                    className="mx-auto max-h-[260px] w-auto object-contain"
                    priority
                  />
                  {/* Annotation overlays */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute left-3 top-3 rounded-xl border border-ink-accent-blue/30 bg-mu-blue/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-sm sm:left-4 sm:top-4"
                  >
                    Crop this area
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-mu-blue/25"
                  />
                  {/* Arrow pointing at the table body */}
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, type: "spring" }}
                    className="absolute bottom-3 right-3 rounded-lg border border-gold/35 bg-[rgba(0,31,63,0.9)] px-3 py-1.5 text-[11px] font-semibold text-gold-light shadow-md backdrop-blur-sm sm:bottom-4 sm:right-4"
                  >
                    JPG, PNG, WEBP &middot; Max 5 MB
                  </motion.div>
                </div>
              )}

              {current.visual === "review" && (
                <div className="px-5 py-6 sm:px-8 sm:py-8">
                  <div className="space-y-3">
                    {/* Mock matched row */}
                    <div className="onboarding-panel-soft flex items-center gap-3 rounded-xl border-[rgba(0,114,206,0.24)] px-4 py-3">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-mu-blue bg-mu-blue">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-primary">ECON 1103</span>
                          <span className="onboarding-pill onboarding-pill-blue rounded-full px-2 py-0.5 text-[10px] font-bold">Completed</span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-secondary">Principles of Microeconomics &middot; 2025 Fall</p>
                      </div>
                    </div>
                    {/* Mock in-progress row */}
                    <div className="onboarding-panel-soft flex items-center gap-3 rounded-xl border-[rgba(255,204,0,0.22)] px-4 py-3">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-warn bg-warn">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-primary">FINA 3001</span>
                          <span className="onboarding-pill onboarding-pill-gold rounded-full px-2 py-0.5 text-[10px] font-bold">In Progress</span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-secondary">Intro to Financial Management &middot; 2026 Sum</p>
                      </div>
                    </div>
                    {/* Mock needs-review row */}
                    <div className="onboarding-panel-soft flex items-center gap-3 rounded-xl border-[rgba(199,59,69,0.22)] px-4 py-3 opacity-80">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-[rgba(199,59,69,0.38)] bg-[rgba(199,59,69,0.12)]">
                        <span className="text-[9px] font-bold text-bad">?</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-primary">SOCI 9290</span>
                          <span className="onboarding-pill onboarding-pill-danger rounded-full px-2 py-0.5 text-[10px] font-bold">Needs Review</span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-secondary">Something looked off, so you pick the right match.</p>
                      </div>
                    </div>
                  </div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light/80"
                  >
                    Everything runs locally in your browser
                  </motion.p>
                </div>
              )}

              {current.visual === "apply" && (
                <div className="flex flex-col items-center gap-5 px-5 py-8 sm:px-8 sm:py-10">
                  {/* Mock summary chips */}
                  <div className="grid w-full max-w-sm grid-cols-3 gap-3">
                    {[
                      { label: "Completed", value: "14", color: "onboarding-pill onboarding-pill-blue" },
                      { label: "In Progress", value: "6", color: "onboarding-pill onboarding-pill-gold" },
                      { label: "Skipped", value: "2", color: "onboarding-pill" },
                    ].map((chip) => (
                      <motion.div
                        key={chip.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={`rounded-xl border px-3 py-3 text-center ${chip.color}`}
                      >
                        <p className="text-xl font-bold tracking-tight">{chip.value}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">{chip.label}</p>
                      </motion.div>
                    ))}
                  </div>
                  {/* Mock apply button */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 20 }}
                    className="rounded-full bg-[linear-gradient(180deg,rgba(0,51,102,0.96),rgba(0,31,63,0.96))] px-8 py-3 text-sm font-semibold text-white shadow-lg"
                  >
                    Apply Imported Courses
                  </motion.div>
                  <p className="max-w-xs text-center text-xs leading-relaxed text-ink-secondary">
                    After applying, your course chips update instantly. Keep tweaking as needed.
                  </p>
                </div>
              )}
            </div>

            {/* Text content */}
            <div className="text-center">
              <span className="onboarding-pill onboarding-pill-gold inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em]">
                {current.tag}
              </span>
              <h4 className="mt-3 font-[family-name:var(--font-sora)] text-[1.5rem] font-semibold tracking-[-0.03em] text-ink-primary sm:text-[1.65rem]">
                {current.heading}
              </h4>
              <p className="mx-auto mt-2 max-w-md text-[0.95rem] leading-relaxed text-ink-secondary sm:text-[1.05rem]">
                {current.body}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-primary transition-opacity disabled:opacity-0"
          >
            Back
          </button>
          <Button
            type="button"
            variant={isLast ? "ink" : "gold"}
            onClick={() => {
              if (isLast) onClose();
              else setStep((s) => s + 1);
            }}
            className="rounded-full px-6"
          >
            {isLast ? "Got it, let\u2019s go" : "Next"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DispositionButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "blue" | "gold" | "neutral";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "blue"
      ? active
        ? "border-[#1e9f61] bg-[rgba(30,159,97,0.18)] text-[#8ee0b6]"
        : "onboarding-pill hover:border-[#1e9f61]/50 hover:bg-[rgba(30,159,97,0.1)] hover:text-[#8ee0b6]"
      : tone === "gold"
        ? active
          ? "onboarding-pill onboarding-pill-gold"
          : "onboarding-pill"
        : active
          ? "onboarding-pill onboarding-pill-danger"
          : "onboarding-pill";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${toneClass}`}
    >
      {children}
    </button>
  );
}
