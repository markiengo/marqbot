"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { useAppContext } from "@/context/AppContext";
import { postImportCourseHistory } from "@/lib/api";
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
const WALKTHROUGH = [
  "Upload a tight crop of the CheckMarq course-history table.",
  "Review what MarqBot matched before anything touches your profile.",
  "Apply the result, then keep editing with the normal course chips.",
] as const;

function reviewKey(prefix: string, row: ImportRow, index: number): string {
  return `${prefix}-${row.course_code || "unmatched"}-${row.term || "term"}-${index}`;
}

function formatConfidence(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
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

function statusCopy(status: ImportStatus): string {
  switch (status) {
    case "uploading":
      return "Uploading screenshot...";
    case "parsing":
      return "Reading the screenshot with GPT-4o...";
    case "parsed":
      return "Parsed. Review and apply what looks right.";
    case "failed":
      return "Import failed. Retry or keep entering classes manually.";
    default:
      return "Upload a CheckMarq course-history screenshot to speed this up.";
  }
}

export function CourseHistoryImport() {
  const { state, dispatch } = useAppContext();
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(true);
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
    setStatus("uploading");
    try {
      await Promise.resolve();
      setStatus("parsing");
      const nextResult = await postImportCourseHistory(file);
      setResult(nextResult);
      setStatus("parsed");
    } catch (nextError) {
      setStatus("failed");
      setError(nextError instanceof Error ? nextError.message : "Course history import failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

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
    <section className="overflow-hidden rounded-[1.9rem] border border-[#d7c4ad] bg-[radial-gradient(circle_at_top_right,_rgba(46,110,167,0.12),_transparent_35%),linear-gradient(180deg,#fff7ea_0%,#fffdf8_100%)] shadow-[0_22px_40px_rgba(83,56,30,0.08)]">
      <div className="border-b border-[#e6d6c2] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center rounded-full border border-[#dfccb4] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f5e1e]">
              Screenshot Import
            </div>
            <h3 className="font-[family-name:var(--font-sora)] text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--ink-warm)] sm:text-[1.7rem]">
              Drop in your CheckMarq history. Keep the chips editable.
            </h3>
            <p className="text-sm leading-relaxed text-[var(--ink-warm-soft)] sm:text-[0.97rem]">
              MarqBot can read a course-history screenshot, sort rows into completed and in-progress buckets,
              and hand you a review screen before anything touches your profile.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setWalkthroughOpen((previous) => !previous)}
              className="rounded-full border border-[#decdbb] bg-white/70 px-4 py-2 text-[var(--ink-warm)] hover:bg-[#fff6ea]"
            >
              {walkthroughOpen ? "Hide tutorial" : "Show tutorial"}
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
              disabled={status === "uploading" || status === "parsing"}
              className="rounded-full px-5"
            >
              Upload Screenshot
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {walkthroughOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24 }}
              className="overflow-hidden"
            >
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {WALKTHROUGH.map((detail, index) => (
                  <div
                    key={detail}
                    className="rounded-[1.35rem] border border-[#dfcfbc] bg-white/70 px-4 py-4 shadow-[0_12px_24px_rgba(83,56,30,0.05)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a46b28]">
                      Step {index + 1}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-warm-soft)]">{detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-[1.5rem] border border-dashed border-[#d5bf9a] bg-[#fffdf8] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--ink-warm)]">Best results</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink-warm-soft)]">
              Crop tightly around the table. JPG, PNG, WEBP, or GIF. Max 5MB. Footer notes and GPA lines
              are ignored.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[#e2d4c3] bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f5e1e]">Import status</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-warm)]" aria-live="polite">
              {statusCopy(status)}
            </p>
            {status === "parsed" && result && (
              <p className="mt-3 text-xs text-[var(--ink-warm-soft)]">
                Matched {matchedCount} of {result.summary.total_rows} rows.
              </p>
            )}
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-[1.25rem] border border-[#e7c8ba] bg-[#fff3ee] px-4 py-4 text-sm text-[#95513c]"
          >
            {error}
          </motion.div>
        )}
        {applyNotice && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-[1.25rem] border border-[#cfe2c1] bg-[#f4fbef] px-4 py-4 text-sm text-[#456a2f]"
          >
            {applyNotice}
          </motion.div>
        )}

        <AnimatePresence>
          {result && status === "parsed" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24 }}
              className="mt-5 space-y-4"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="rounded-[1.4rem] border border-[#d9c6ae] bg-[#fffaf2] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f5e1e]">Match rate</p>
                  <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--ink-warm)]">
                    Matched {matchedCount} of {result.summary.total_rows} rows
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-warm-soft)]">
                    Confident matches are pre-checked. Lower-confidence rows stay in review until you confirm them.
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#d9c6ae] bg-white/80 px-4 py-4">
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.45rem] border border-[#ddceb9] bg-[#fffaf3] px-4 py-4">
                <p className="text-sm leading-relaxed text-[var(--ink-warm-soft)]">
                  Apply what looks right now, then keep editing with the normal course chips below.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={reset}
                    className="rounded-full border border-[#decdbb] bg-white/70 px-4 py-2 text-[var(--ink-warm)] hover:bg-[#fff6ea]"
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
    <div className="rounded-[1rem] border border-[#ddd5ca] bg-[#f8f4ed] px-3 py-2 text-[#6f5d48]">
      <p className="text-[1.1rem] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
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
          wrapper: "border-[#cadbed] bg-[#f7fbff]",
          badge: "border-[#c5d8ea] bg-[#ebf4fb] text-[#2e6ea7]",
          accent: "accent-[#2e6ea7]",
        }
      : {
          wrapper: "border-[#e6d3ad] bg-[#fffaf0]",
          badge: "border-[#e6d0a5] bg-[#fff2d7] text-[#9c6b1b]",
          accent: "accent-[#c4861f]",
        };

  return (
    <section className={`rounded-[1.55rem] border px-4 py-4 sm:px-5 ${palette.wrapper}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f5e1e]">{title}</p>
          <h4 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ink-warm)]">
            {rows.length} {rows.length === 1 ? "row" : "rows"} ready to apply
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-warm-soft)]">{subtitle}</p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${palette.badge}`}>
          {selectedCodes.size} selected
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const code = row.course_code || "";
          return (
            <label
              key={`${code}-${row.term}`}
              className="flex cursor-pointer items-start gap-3 rounded-[1.2rem] border border-white/70 bg-white/80 px-4 py-3"
            >
              <input
                type="checkbox"
                checked={selectedCodes.has(code)}
                onChange={(event) => onToggle(code, event.target.checked)}
                className={`mt-1 h-4 w-4 shrink-0 ${palette.accent}`}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--ink-warm)]">{code}</span>
                  <span className="rounded-full border border-[#ddd5ca] bg-[#f7f4ef] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c6952]">
                    {row.term || "term unknown"}
                  </span>
                  <span className="rounded-full border border-[#ddd5ca] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c6952]">
                    Confidence {formatConfidence(row.confidence)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-warm-soft)]">{row.source_text}</p>
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
    <section className="rounded-[1.55rem] border border-[#e5cbbf] bg-[#fff7f2] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a15a3d]">Needs Review</p>
          <h4 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ink-warm)]">
            Resolve the rows MarqBot won&apos;t auto-apply.
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-warm-soft)]">
            Use a suggestion, search the catalog manually, or skip the row.
          </p>
        </div>
        <div className="rounded-full border border-[#e5cab9] bg-white/80 px-3 py-1 text-xs font-semibold text-[#a15a3d]">
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
    <div className="rounded-[1.25rem] border border-[#e5cab9] bg-white/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#e1cbbd] bg-[#fff3ec] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a15a3d]">
              {row.reason || row.status}
            </span>
            <span className="rounded-full border border-[#ddd5ca] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c6952]">
              Confidence {formatConfidence(row.confidence)}
            </span>
          </div>
          <p className="text-sm font-semibold text-[var(--ink-warm)]">{row.source_text}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-warm-muted)]">{row.term || "term unknown"}</p>
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
                  ? "border-[#2e6ea7] bg-[#edf5fc] text-[#2e6ea7]"
                  : "border-[#ddd5ca] bg-[#f9f6f1] text-[var(--ink-warm)] hover:bg-white"
              }`}
            >
              {course.course_code}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-warm-muted)]">
          Search catalog
        </label>
        <input
          type="text"
          value={safeResolution.query}
          onChange={(event) => onUpdate(row.reviewKey, { query: event.target.value })}
          placeholder="Search for the right course code"
          className="w-full rounded-xl border border-[#d8c8b8] bg-[#fffdf9] px-4 py-3 text-sm text-[var(--ink-warm)] placeholder:text-[var(--ink-warm-muted)] focus:border-[#2e6ea7] focus:outline-none focus:ring-2 focus:ring-[#2e6ea7]/20"
        />
      </div>

      {searchResults.length > 0 && (
        <div className="mt-3 rounded-[1rem] border border-[#ddd5ca] bg-[#fffdf9] p-2">
          <div className="grid gap-2">
            {searchResults.map((course) => (
              <button
                key={course.course_code}
                type="button"
                onClick={() => onUpdate(row.reviewKey, { selectedCode: course.course_code })}
                className="flex items-start justify-between gap-3 rounded-[0.9rem] px-3 py-2 text-left transition-colors hover:bg-[#f7efe3]"
              >
                <div>
                  <p className="text-sm font-semibold text-[#2e6ea7]">{course.course_code}</p>
                  <p className="text-xs text-[var(--ink-warm-soft)]">{course.course_name}</p>
                </div>
                <span className="text-xs font-semibold text-[#8f5e1e]">{course.credits}cr</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-[1rem] border border-[#ddd5ca] bg-[#f8f4ed] px-3 py-3 text-sm text-[var(--ink-warm-soft)]">
        {selectedCourse ? (
          <span>
            Selected: <span className="font-semibold text-[var(--ink-warm)]">{selectedCourse.course_code}</span>
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
    <section className="rounded-[1.55rem] border border-[#ddd5ca] bg-[#f7f4ef] px-4 py-4 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f6b56]">Ignored</p>
      <h4 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-[var(--ink-warm)]">
        Informational rows MarqBot left out.
      </h4>
      <div className="mt-3 grid gap-2">
        {rows.map((row, index) => (
          <div
            key={`${row.source_text}-${index}`}
            className="rounded-[1.15rem] border border-[#ded6ca] bg-white/60 px-3 py-3 text-sm text-[var(--ink-warm-soft)] opacity-80"
          >
            <p className="font-medium text-[var(--ink-warm)]">{row.source_text}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7f6b56]">{row.reason || "ignored"}</p>
          </div>
        ))}
      </div>
    </section>
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
        ? "border-[#2e6ea7] bg-[#edf5fc] text-[#2e6ea7]"
        : "border-[#d9dbe0] bg-white text-[var(--ink-warm)]"
      : tone === "gold"
        ? active
          ? "border-[#c4861f] bg-[#fff2d5] text-[#9c6b1b]"
          : "border-[#d9dbe0] bg-white text-[var(--ink-warm)]"
        : active
          ? "border-[#7c6952] bg-[#f1ece5] text-[#6f5d48]"
          : "border-[#d9dbe0] bg-white text-[var(--ink-warm)]";

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
