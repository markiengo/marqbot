"use client";

import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/shared/Button";
import {
  SEMESTER_OPTIONS,
  SEMESTER_COUNT_OPTIONS,
  MAX_RECS_OPTIONS,
} from "@/lib/constants";

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
        Adjust your preferences to cater the recommendations.
      </p>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink-muted uppercase tracking-wider">
          Target Semester
        </label>
        <select
          value={state.targetSemester}
          onChange={(e) =>
            dispatch({ type: "SET_TARGET_SEMESTER", payload: e.target.value })
          }
          className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40 hover:border-gold/40 transition-colors"
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
            className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40 hover:border-gold/40 transition-colors"
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
            className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40 hover:border-gold/40 transition-colors"
          >
            {MAX_RECS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summer toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-secondary leading-tight">Include Summer Semesters</p>
          <p className="text-sm text-ink-faint leading-tight mt-0.5">Max 4 courses · Summer-only offerings</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.includeSummer}
          onClick={() => dispatch({ type: "SET_INCLUDE_SUMMER", payload: !state.includeSummer })}
          className={[
            "relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/40",
            state.includeSummer ? "bg-gold" : "bg-white/20",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
              state.includeSummer ? "translate-x-4" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Honors student toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-secondary leading-tight">Honors Student</p>
          <p className="text-sm text-ink-faint leading-tight mt-0.5">Include honors sections in plan</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.isHonorsStudent}
          onClick={() => dispatch({ type: "SET_HONORS_STUDENT", payload: !state.isHonorsStudent })}
          className={[
            "relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/40",
            state.isHonorsStudent ? "bg-gold" : "bg-white/20",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
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
                <span className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              submitLabel
            )}
          </Button>
          {!hasProgram && (
            <p className="text-sm text-ink-faint text-center mt-2">
              Select a major or track above to get started
            </p>
          )}
        </div>
      )}
    </div>
  );
}
