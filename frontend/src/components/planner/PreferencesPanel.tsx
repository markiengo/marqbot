"use client";

import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/shared/Button";
import {
  SEMESTER_OPTIONS,
  SEMESTER_COUNT_OPTIONS,
  MAX_RECS_OPTIONS,
} from "@/lib/constants";
import { STUDENT_STAGE_OPTIONS } from "@/lib/studentStage";
import type { StudentStage } from "@/lib/types";

interface PreferencesPanelProps {
  onSubmit?: () => void;
  loading?: boolean;
  error?: string | null;
  submitLabel?: string;
}

export function PreferencesPanel({
  onSubmit,
  loading = false,
  error = null,
  submitLabel = "Get My Plan",
}: PreferencesPanelProps) {
  const { state, dispatch } = useAppContext();
  const hasProgram = state.selectedMajors.size > 0 || state.selectedTracks.length > 0;

  return (
    <div className="space-y-5">
      <p className="section-kicker">
        Adjust inputs below.
      </p>

      <div className="space-y-1.5">
        <label className="text-sm font-medium uppercase tracking-wider text-ink-muted">
          Target Semester
        </label>
        <select
          value={state.targetSemester}
          onChange={(e) =>
            dispatch({ type: "SET_TARGET_SEMESTER", payload: e.target.value })
          }
          className="w-full rounded-lg border border-border-medium bg-surface-input px-2 py-1.5 text-sm text-ink-primary transition-colors hover:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/40"
        >
          {SEMESTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-ink-muted">
            Semesters
          </label>
          <select
            value={state.semesterCount}
            onChange={(e) =>
              dispatch({ type: "SET_SEMESTER_COUNT", payload: e.target.value })
            }
            className="w-full rounded-lg border border-border-medium bg-surface-input px-2 py-1.5 text-sm text-ink-primary transition-colors hover:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            {SEMESTER_COUNT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-ink-muted">
            Max Courses
          </label>
          <select
            value={state.maxRecs}
            onChange={(e) =>
              dispatch({ type: "SET_MAX_RECS", payload: e.target.value })
            }
            className="w-full rounded-lg border border-border-medium bg-surface-input px-2 py-1.5 text-sm text-ink-primary transition-colors hover:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            {MAX_RECS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium uppercase tracking-wider text-ink-muted">
          Student Stage
        </label>
        <select
          aria-label="Student stage"
          value={state.studentStage}
          onChange={(e) =>
            dispatch({ type: "SET_STUDENT_STAGE", payload: e.target.value as StudentStage })
          }
          className="w-full rounded-lg border border-border-medium bg-surface-input px-2 py-1.5 text-sm text-ink-primary transition-colors hover:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/40"
        >
          {STUDENT_STAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-faint">
          {STUDENT_STAGE_OPTIONS.find((option) => option.value === state.studentStage)?.helper}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium leading-tight text-ink-secondary">Include Summer Semesters</p>
          <p className="mt-0.5 text-sm leading-tight text-ink-faint">Summer limit: 4 courses.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.includeSummer}
          onClick={() => dispatch({ type: "SET_INCLUDE_SUMMER", payload: !state.includeSummer })}
          className={[
            "relative flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/40",
            state.includeSummer ? "bg-gold" : "bg-white/20",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
              state.includeSummer ? "translate-x-4" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium leading-tight text-ink-secondary">Honors Student</p>
          <p className="mt-0.5 text-sm leading-tight text-ink-faint">Show honors courses.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.isHonorsStudent}
          onClick={() => dispatch({ type: "SET_HONORS_STUDENT", payload: !state.isHonorsStudent })}
          className={[
            "relative flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/40",
            state.isHonorsStudent ? "bg-gold" : "bg-white/20",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
              state.isHonorsStudent ? "translate-x-4" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>

      {onSubmit !== undefined && (
        <div className="pt-2">
          {error && (
            <div className="mb-3 rounded-xl border border-bad/25 bg-bad-light px-3 py-2 text-sm text-bad">
              {error}
            </div>
          )}
          <Button
            variant="gold"
            size="md"
            onClick={onSubmit}
            disabled={loading || !hasProgram}
            className="w-full shadow-[0_0_24px_rgba(255,204,0,0.35),0_0_48px_rgba(255,204,0,0.15)]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                Running...
              </span>
            ) : (
              submitLabel
            )}
          </Button>
          {!hasProgram && (
            <p className="mt-2 text-center text-sm text-ink-faint">
              Add a major or track above to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
