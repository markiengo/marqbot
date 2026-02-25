"use client";

import { useAppContext } from "@/context/AppContext";
import {
  SEMESTER_OPTIONS,
  SEMESTER_COUNT_OPTIONS,
  MAX_RECS_OPTIONS,
} from "@/lib/constants";

export function PreferencesPanel() {
  const { state, dispatch } = useAppContext();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink-secondary uppercase tracking-wider">
        Preferences
      </h3>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          Target Semester
        </label>
        <select
          value={state.targetSemester}
          onChange={(e) =>
            dispatch({ type: "SET_TARGET_SEMESTER", payload: e.target.value })
          }
          className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40"
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
          <label className="text-xs font-medium text-ink-muted">
            Semesters
          </label>
          <select
            value={state.semesterCount}
            onChange={(e) =>
              dispatch({ type: "SET_SEMESTER_COUNT", payload: e.target.value })
            }
            className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            {SEMESTER_COUNT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">
            Max Courses
          </label>
          <select
            value={state.maxRecs}
            onChange={(e) =>
              dispatch({ type: "SET_MAX_RECS", payload: e.target.value })
            }
            className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            {MAX_RECS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
