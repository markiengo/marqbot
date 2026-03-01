"use client";

import { useAppContext } from "@/context/AppContext";
import {
  SEMESTER_OPTIONS,
  SEMESTER_COUNT_OPTIONS,
  MAX_RECS_OPTIONS,
} from "@/lib/constants";

export function PreferencesStep() {
  const { state, dispatch } = useAppContext();
  const optionButtonClass = (selected: boolean) =>
    [
      "w-full rounded-xl px-4 py-3 text-base font-medium leading-tight transition-all cursor-pointer",
      selected
        ? "bg-gold text-navy-dark"
        : "bg-surface-card text-ink-secondary hover:bg-surface-hover border border-border-subtle",
    ].join(" ");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          Let&apos;s build your plan.
        </h2>
        <p className="text-base text-ink-muted mt-1">
          Pick your semester. Pick your load. We&apos;ll do the rest.
        </p>
      </div>

      <div className="space-y-4">
        {/* Target semester */}
        <div className="space-y-1.5">
          <label className="text-base font-medium text-ink-secondary">
            Target semester
          </label>
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
        <div className="space-y-1.5">
          <label className="text-base font-medium text-ink-secondary">
            How many semesters to plan?
          </label>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {SEMESTER_COUNT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  dispatch({ type: "SET_SEMESTER_COUNT", payload: o.value })
                }
                className={`${optionButtonClass(
                  state.semesterCount === o.value,
                )} min-h-[5.25rem]`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max recommendations */}
        <div className="space-y-1.5">
          <label className="text-base font-medium text-ink-secondary">
            Courses per semester
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {MAX_RECS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  dispatch({ type: "SET_MAX_RECS", payload: o.value })
                }
                className={optionButtonClass(state.maxRecs === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
