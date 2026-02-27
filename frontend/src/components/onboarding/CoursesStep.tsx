"use client";

import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";

export function CoursesStep() {
  const { state, dispatch } = useAppContext();

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          What courses have you taken?
        </h2>
        <p className="text-base text-ink-muted mt-1">
          Add your completed and in-progress courses so we can give accurate
          recommendations. You can skip this and add them later.
        </p>
      </div>

      {/* Completed courses */}
      <div className="space-y-2 pt-1">
        <label className="text-sm font-medium text-ink-secondary">
          Completed courses
        </label>
        <MultiSelect
          courses={state.courses}
          selected={state.completed}
          otherSet={state.inProgress}
          onAdd={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
          onRemove={(code) => dispatch({ type: "REMOVE_COMPLETED", payload: code })}
          placeholder="Search completed courses..."
          resolveLabel={(code) => code}
        />
      </div>

      {/* In-progress courses */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink-secondary">
          Currently in progress
        </label>
        <MultiSelect
          courses={state.courses}
          selected={state.inProgress}
          otherSet={state.completed}
          onAdd={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
          onRemove={(code) => dispatch({ type: "REMOVE_IN_PROGRESS", payload: code })}
          placeholder="Search in-progress courses..."
          resolveLabel={(code) => code}
        />
      </div>
    </div>
  );
}
