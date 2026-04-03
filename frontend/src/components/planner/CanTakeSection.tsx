"use client";

import { memo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useCatalogContext, useUiContext } from "@/context/AppContext";
import { isCanTakeResultForQuery, useCanTake } from "@/hooks/useCanTake";
import { SingleSelect } from "@/components/shared/SingleSelect";
import { esc } from "@/lib/utils";

function CanTakeSectionInner() {
  const { courses } = useCatalogContext();
  const { canTakeQuery, dispatch } = useUiContext();
  const { data, loading, error, checkCanTake, clearCanTake } = useCanTake();
  const didAutoFetch = useRef(false);
  const hasVisibleResult = isCanTakeResultForQuery(canTakeQuery, data);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (canTakeQuery.trim()) return;
    didAutoFetch.current = false;
    clearCanTake();
  }, [canTakeQuery, clearCanTake]);

  // If a query is already set (persisted from a previous visit) but we have no
  // result yet, re-fetch automatically so the answer is always visible.
  useEffect(() => {
    if (didAutoFetch.current || !canTakeQuery || hasVisibleResult) return;
    didAutoFetch.current = true;
    void checkCanTake(canTakeQuery);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canTakeQuery, hasVisibleResult]);

  const handleSelect = (course: { course_code: string }) => {
    dispatch({ type: "SET_CAN_TAKE_QUERY", payload: course.course_code });
    void checkCanTake(course.course_code);
  };

  return (
    <div className="lg:h-full rounded-2xl glass-card p-3 sm:p-4 flex flex-col gap-3 relative overflow-hidden">
      {/* Atmospheric glow */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 50% at 85% 20%, rgba(0, 114, 206, 0.06), transparent)"
      }} />

      {/* Header */}
      <div className="shrink-0 relative z-[1]">
        <span className="section-kicker" style={{ fontSize: "0.816rem" }}>
          {canTakeQuery
            ? `Can I take ${canTakeQuery} next term?`
            : "Can I take... next term?"}
        </span>
      </div>

      {/* Search row */}
      <div className="flex items-center gap-2 shrink-0 relative z-[6]">
        <div className="flex-1 min-w-0">
          <SingleSelect
            courses={courses}
            value={canTakeQuery}
            onChange={(value) => {
              dispatch({ type: "SET_CAN_TAKE_QUERY", payload: value });
              clearCanTake();
            }}
            onSelect={handleSelect}
            placeholder="Search a course"
          />
        </div>
        {loading && (
          <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        <AnimatePresence>
          {hasVisibleResult && data && !loading && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
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
                  : "Check"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Detail row - only when result exists */}
      {error && canTakeQuery.trim() && !loading && (
        <div className="relative z-[1] rounded-lg px-3 py-2 text-xs bg-bad-light/50 text-bad">
          Couldn&apos;t check {esc(canTakeQuery)} right now. {esc(error)}
        </div>
      )}

      {hasVisibleResult && data && !loading && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.14 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={`relative z-[1] rounded-lg px-3 py-1.5 text-xs ${
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
                : `Check manually: ${esc(data.requested_course)}`}
          </span>
          {data.why_not && (
            <span className="ml-1 opacity-80">&mdash; {esc(data.why_not)}</span>
          )}
          {data.missing_prereqs && data.missing_prereqs.length > 0 && (
            <span className="ml-1 opacity-80">
              (Missing: {data.missing_prereqs.map(esc).join(", ")})
            </span>
          )}
        </motion.div>
      )}

      <div className="relative z-[1] mt-auto rounded-[1.05rem] border border-white/8 bg-white/[0.035] px-3 py-2.5 text-[0.74rem] leading-relaxed text-ink-faint">
        Prereq checks use your saved course history, visible restrictions, and the current planner profile.
      </div>
    </div>
  );
}

export const CanTakeSection = memo(CanTakeSectionInner);
CanTakeSection.displayName = "CanTakeSection";
