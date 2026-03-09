"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { isCanTakeResultForQuery, useCanTake } from "@/hooks/useCanTake";
import { SingleSelect } from "@/components/shared/SingleSelect";
import { esc } from "@/lib/utils";

interface CanTakeSectionProps {
  feedbackExpanded: boolean;
  onFeedbackOpen: () => void;
  onFeedbackDismiss: () => void;
  onFeedbackNudgeEligibilityChange: (eligible: boolean) => void;
}

export function CanTakeSection({
  feedbackExpanded,
  onFeedbackOpen,
  onFeedbackDismiss,
  onFeedbackNudgeEligibilityChange,
}: CanTakeSectionProps) {
  const { state, dispatch } = useAppContext();
  const { data, loading, error, checkCanTake, clearCanTake } = useCanTake();
  const didAutoFetch = useRef(false);
  const hasVisibleResult = isCanTakeResultForQuery(state.canTakeQuery, data);
  const reduceMotion = useReducedMotion();

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

  useEffect(() => {
    onFeedbackNudgeEligibilityChange(hasVisibleResult);
    return () => onFeedbackNudgeEligibilityChange(false);
  }, [hasVisibleResult, onFeedbackNudgeEligibilityChange]);

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
          {state.canTakeQuery
            ? `Can I take ${state.canTakeQuery} next term?`
            : "Can I take... next term?"}
        </span>
      </div>

      {/* Search row */}
      <div className="flex items-center gap-2 shrink-0 relative z-[6]">
        <div className="flex-1 min-w-0">
          <SingleSelect
            courses={state.courses}
            value={state.canTakeQuery}
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

      {/* Detail row — only when result exists */}
      {error && state.canTakeQuery.trim() && !loading && (
        <div className="relative z-[1] rounded-lg px-3 py-2 text-xs bg-bad-light/50 text-bad">
          Couldn&apos;t check {esc(state.canTakeQuery)} right now. {esc(error)}
        </div>
      )}

      {hasVisibleResult && data && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
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

      <div className="relative z-[1] flex flex-1 flex-col gap-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <span className="section-kicker" style={{ fontSize: "0.816rem" }}>
            Have feedback on this plan?
          </span>
          <AnimatePresence initial={false}>
            {feedbackExpanded && (
              <motion.button
                key="feedback-dismiss"
                type="button"
                onClick={onFeedbackDismiss}
                aria-label="Dismiss feedback nudge"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.16 }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-medium bg-surface-input/70 text-ink-faint transition-colors hover:border-gold/30 hover:text-ink-primary cursor-pointer"
              >
                <span aria-hidden="true">x</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          animate={
            feedbackExpanded && !reduceMotion
              ? { scale: [1, 1.008, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={`rounded-[28px] border p-2 sm:p-2.5 ${
            feedbackExpanded
              ? "border-gold/38 bg-[linear-gradient(135deg,rgba(255,204,0,0.08),rgba(0,114,206,0.10))] shadow-[0_0_28px_rgba(255,204,0,0.12),0_0_42px_rgba(0,114,206,0.08)]"
              : "border-border-medium bg-surface-input/70"
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/about"
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-[22px] border border-border-medium bg-surface-card/70 px-4 py-3 text-sm font-medium text-ink-primary transition-colors hover:border-gold/25 hover:bg-surface-hover"
            >
              Contact Markie
            </Link>
            <motion.button
              type="button"
              onClick={onFeedbackOpen}
              aria-label="Feedback form"
              whileHover={reduceMotion ? undefined : { y: -1 }}
              className={`inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-[22px] border px-4 py-3 text-sm font-semibold transition-all cursor-pointer ${
                feedbackExpanded
                  ? "border-gold/45 bg-gold/16 text-gold shadow-[0_0_20px_rgba(255,204,0,0.14)]"
                  : "border-border-medium bg-surface-card/70 text-ink-primary hover:border-gold/25 hover:bg-surface-hover"
              }`}
            >
              Feedback form
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
