"use client";

import { useAppContext } from "@/context/AppContext";
import {
  SEMESTER_OPTIONS,
  SEMESTER_COUNT_OPTIONS,
  MAX_RECS_OPTIONS,
} from "@/lib/constants";

export function PreferencesStep() {
  const { state, dispatch } = useAppContext();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          Let&apos;s build your plan.
        </h2>
        <p className="text-base text-ink-muted mt-1">
          Pick your semester. Pick your load. We&apos;ll do the rest.
        </p>
      </div>

      <div className="space-y-7">
        {/* Target semester */}
        <div className="space-y-2">
          <div>
            <label className="text-base font-medium text-ink-secondary">
              What&apos;s your next semester?
            </label>
            <p className="text-xs text-ink-faint mt-0.5">
              The semester you&apos;re planning for — the one you haven&apos;t started yet.
            </p>
          </div>
          <select
            value={state.targetSemester}
            onChange={(e) =>
              dispatch({ type: "SET_TARGET_SEMESTER", payload: e.target.value })
            }
            className="w-full px-4 py-3 bg-surface-input border border-border-medium rounded-xl text-base text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            {SEMESTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Semester count */}
        <div className="space-y-2">
          <div>
            <label className="text-base font-medium text-ink-secondary">
              How far ahead do you want to plan?
            </label>
            <p className="text-xs text-ink-faint mt-0.5">
              Pick 1 if you just want next semester. Pick 8 if you want a full roadmap to graduation.
            </p>
          </div>
          <select
            value={state.semesterCount}
            onChange={(e) =>
              dispatch({ type: "SET_SEMESTER_COUNT", payload: e.target.value })
            }
            className="w-full px-4 py-3 bg-surface-input border border-border-medium rounded-xl text-base text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            {SEMESTER_COUNT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Max recommendations */}
        <div className="space-y-2">
          <div>
            <label className="text-base font-medium text-ink-secondary">
              How many courses do you want each semester?
            </label>
            <p className="text-xs text-ink-faint mt-0.5">
              MarqBot will suggest this many courses per semester. Most students do 4–5. 6 is a lot. You&apos;ve been warned.
            </p>
          </div>
          <select
            value={state.maxRecs}
            onChange={(e) =>
              dispatch({ type: "SET_MAX_RECS", payload: e.target.value })
            }
            className="w-full px-4 py-3 bg-surface-input border border-border-medium rounded-xl text-base text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            {MAX_RECS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
