"use client";

import { useAppContext } from "@/context/AppContext";
import { useCanTake } from "@/hooks/useCanTake";
import { SingleSelect } from "@/components/shared/SingleSelect";
import { esc } from "@/lib/utils";

export function CanTakeSection() {
  const { state, dispatch } = useAppContext();
  const { data, loading, checkCanTake } = useCanTake();

  const handleSelect = (course: { course_code: string }) => {
    dispatch({ type: "SET_CAN_TAKE_QUERY", payload: course.course_code });
    checkCanTake(course.course_code);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gold uppercase tracking-wider">
        Can I Take...?
      </h3>

      <SingleSelect
        courses={state.courses}
        value={state.canTakeQuery}
        onChange={(v) => dispatch({ type: "SET_CAN_TAKE_QUERY", payload: v })}
        onSelect={handleSelect}
        placeholder="Search for a course and press Enter"
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-faint">
          <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
          Checking...
        </div>
      )}

      {data && !loading && (
        <div
          className={`rounded-xl p-3 text-sm ${
            data.can_take === true
              ? "bg-ok-light text-ok"
              : data.can_take === false
                ? "bg-bad-light text-bad"
                : "bg-warn-light text-warn"
          }`}
        >
          <div className="font-semibold">
            {data.can_take === true
              ? `Yes, you can take ${esc(data.requested_course)}`
              : data.can_take === false
                ? `Not yet: ${esc(data.requested_course)}`
                : `Manual review: ${esc(data.requested_course)}`}
          </div>
          {data.why_not && (
            <p className="text-xs mt-1 opacity-80">{esc(data.why_not)}</p>
          )}
          {data.missing_prereqs && data.missing_prereqs.length > 0 && (
            <p className="text-xs mt-1 opacity-80">
              Missing: {data.missing_prereqs.map(esc).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
