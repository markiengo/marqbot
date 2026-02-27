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
    <div className="space-y-1.5">
      {/* Compact inline row: label + search + loading */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gold uppercase tracking-wider shrink-0">
          Can I Take...?
        </span>
        <div className="flex-1 min-w-0 max-w-[400px]">
          <SingleSelect
            courses={state.courses}
            value={state.canTakeQuery}
            onChange={(v) => dispatch({ type: "SET_CAN_TAKE_QUERY", payload: v })}
            onSelect={handleSelect}
            placeholder="Search a course..."
          />
        </div>
        {loading && (
          <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {data && !loading && (
          <span
            className={`text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full ${
              data.can_take === true
                ? "bg-ok-light text-ok"
                : data.can_take === false
                  ? "bg-bad-light text-bad"
                  : "bg-warn-light text-warn"
            }`}
          >
            {data.can_take === true
              ? "Yes"
              : data.can_take === false
                ? "Not yet"
                : "Review"}
          </span>
        )}
      </div>

      {/* Detail row — only when result exists */}
      {data && !loading && (
        <div
          className={`rounded-lg px-3 py-1.5 text-xs ${
            data.can_take === true
              ? "bg-ok-light/50 text-ok"
              : data.can_take === false
                ? "bg-bad-light/50 text-bad"
                : "bg-warn-light/50 text-warn"
          }`}
        >
          <span className="font-semibold">
            {data.can_take === true
              ? `Yes, you can take ${esc(data.requested_course)}`
              : data.can_take === false
                ? `Not yet: ${esc(data.requested_course)}`
                : `Manual review: ${esc(data.requested_course)}`}
          </span>
          {data.why_not && (
            <span className="ml-1 opacity-80">&mdash; {esc(data.why_not)}</span>
          )}
          {data.missing_prereqs && data.missing_prereqs.length > 0 && (
            <span className="ml-1 opacity-80">
              (Missing: {data.missing_prereqs.map(esc).join(", ")})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
