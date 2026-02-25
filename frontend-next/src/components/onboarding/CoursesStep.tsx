"use client";

import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { PasteFallback } from "@/components/shared/PasteFallback";

export function CoursesStep() {
  const { state, dispatch } = useAppContext();

  const courseNameMap = new Map(
    state.courses.map((c) => [c.course_code, c.course_name]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          What courses have you taken?
        </h2>
        <p className="text-sm text-ink-muted mt-1">
          Add your completed and in-progress courses so we can give accurate
          recommendations. You can skip this and add them later.
        </p>
      </div>

      {/* Completed courses */}
      <div className="space-y-2">
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
          resolveLabel={(code) => courseNameMap.get(code) || code}
        />
        <PasteFallback
          courses={state.courses}
          onAdd={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
          label="Paste completed course list"
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
          resolveLabel={(code) => courseNameMap.get(code) || code}
        />
        <PasteFallback
          courses={state.courses}
          onAdd={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
          label="Paste in-progress course list"
        />
      </div>
    </div>
  );
}
