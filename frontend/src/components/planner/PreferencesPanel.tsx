"use client";

import { useAppContext } from "@/context/AppContext";
import { Button } from "@/components/shared/Button";
import {
  SEMESTER_OPTIONS,
  SEMESTER_COUNT_OPTIONS,
  MAX_RECS_OPTIONS,
} from "@/lib/constants";

interface PreferencesPanelProps {
  onSubmit: () => void;
  loading: boolean;
}

export function PreferencesPanel({ onSubmit, loading }: PreferencesPanelProps) {
  const { state, dispatch } = useAppContext();
  const hasMajor = state.selectedMajors.size > 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gold leading-tight">
          Adjust your preferences to cater the recommendations.
        </p>
        <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-sora)] text-white mt-2 leading-tight">
          Preferences
        </h3>
      </div>

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

      <div className="pt-2">
        <Button
          variant="gold"
          size="md"
          onClick={onSubmit}
          disabled={loading || !hasMajor}
          className="w-full"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
              Loading...
            </span>
          ) : (
            "Get Recommendations"
          )}
        </Button>
        {!hasMajor && (
          <p className="text-xs text-ink-faint text-center mt-2">
            Select a major above to get started
          </p>
        )}
      </div>
    </div>
  );
}
