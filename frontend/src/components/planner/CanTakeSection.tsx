"use client";

import { useEffect, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { isCanTakeResultForQuery, useCanTake } from "@/hooks/useCanTake";
import { SingleSelect } from "@/components/shared/SingleSelect";
import { esc } from "@/lib/utils";

export function CanTakeSection() {
  const { state, dispatch } = useAppContext();
  const { data, loading, error, checkCanTake, clearCanTake } = useCanTake();
  const didAutoFetch = useRef(false);
  const hasVisibleResult = isCanTakeResultForQuery(state.canTakeQuery, data);

  useEffect(() => {
    if (state.canTakeQuery.trim()) return;
    didAutoFetch.current = false;
    clearCanTake();
  }, [state.canTakeQuery, clearCanTake]);

  // If a query is already set (persisted from a previous visit) but we have no
  // result yet, re-fetch automatically so the answer is always visible.
  useEffect(() => {
    if (didAutoFetch.current || !state.canTakeQuery || hasVisibleResult) return;
    didAutoFetch.current = true;
    void checkCanTake(state.canTakeQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.canTakeQuery, hasVisibleResult]);

  const handleSelect = (course: { course_code: string }) => {
    dispatch({ type: "SET_CAN_TAKE_QUERY", payload: course.course_code });
    void checkCanTake(course.course_code);
  };

  return (
    <div className="lg:h-full rounded-2xl border border-border-subtle bg-gradient-to-br from-[#0f2a52]/70 to-[#10284a]/55 p-3 sm:p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="shrink-0">
        <span className="text-xs font-semibold text-gold uppercase tracking-wider">
          {state.canTakeQuery
            ? `Can I take ${state.canTakeQuery} next semester?`
            : "Can I take... next semester?"}
        </span>
      </div>

      {/* Search row */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <SingleSelect
            courses={state.courses}
            value={state.canTakeQuery}
            onChange={(value) => {
              dispatch({ type: "SET_CAN_TAKE_QUERY", payload: value });
              clearCanTake();
            }}
            onSelect={handleSelect}
            placeholder="Search a course..."
          />
        </div>
        {loading && (
          <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {hasVisibleResult && data && !loading && (
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
      {error && state.canTakeQuery.trim() && !loading && (
        <div className="rounded-lg px-3 py-2 text-xs bg-bad-light/50 text-bad">
          Couldn&apos;t check {esc(state.canTakeQuery)} right now. {esc(error)}
        </div>
      )}

      {hasVisibleResult && data && !loading && (
        <div
          className={`rounded-lg px-3 py-1.5 text-xs ${
            data.can_take === true
              ? "bg-ok-light/50 text-ok"
              : data.can_take === false
                ? "bg-bad-light/50 text-bad"
                : "bg-warn-light/50 text-warn"
          }`}
        >
          <span className="font-semibold text-sm">
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
