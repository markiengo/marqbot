"use client";

import { useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { useCanTake } from "@/hooks/useCanTake";
import { SingleSelect } from "@/components/shared/SingleSelect";
import { Modal } from "@/components/shared/Modal";
import { esc } from "@/lib/utils";

export function CanTakeSection() {
  const { state, dispatch } = useAppContext();
  const { data, loading, checkCanTake } = useCanTake();
  const [showExplainer, setShowExplainer] = useState(false);

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
        <button
          type="button"
          onClick={() => setShowExplainer(true)}
          className="ml-auto shrink-0 text-[11px] text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
        >
          See how Marqbot recommends courses
        </button>
      </div>

      {/* How Recs Work explainer modal */}
      <Modal
        open={showExplainer}
        onClose={() => setShowExplainer(false)}
        title="How Marqbot Recommends Courses"
        size="planner-detail"
      >
        <div className="space-y-4 text-sm text-ink-secondary">
          <p className="text-ink-faint text-xs">
            Marqbot uses a deterministic, rule-based engine — no AI guessing. Here&apos;s the exact priority order:
          </p>
          <ol className="space-y-3 list-none">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <p className="font-semibold text-white">Foundation First (MCC Core)</p>
                <p className="text-ink-faint text-xs mt-0.5">CORE 1929, ENGL 1001, PHIL 1001, THEO 1001, and ESSV1 courses are scheduled early because nearly every upper-level course depends on them.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <p className="font-semibold text-white">Major Requirements</p>
                <p className="text-ink-faint text-xs mt-0.5">Required and choose-N buckets for your declared major(s) are prioritized next. Courses that unlock the most future options are scheduled before ones that don&apos;t.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <p className="font-semibold text-white">Tracks &amp; Minors</p>
                <p className="text-ink-faint text-xs mt-0.5">Concentration tracks and minor requirements are layered in after major requirements are on track.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">4</span>
              <div>
                <p className="font-semibold text-white">Standing Gates</p>
                <p className="text-ink-faint text-xs mt-0.5">Some courses require Sophomore, Junior, or Senior standing. Marqbot projects your standing as you complete each semester and only surfaces courses you&apos;ll actually be eligible for.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">5</span>
              <div>
                <p className="font-semibold text-white">Prerequisite Chains</p>
                <p className="text-ink-faint text-xs mt-0.5">A course that is a prerequisite for many others is always scheduled before those courses — even if it belongs to a lower-priority bucket.</p>
              </div>
            </li>
          </ol>
          <p className="text-ink-faint text-xs pt-1 border-t border-border-subtle/40">
            Recommendations assume you complete all suggested courses. Adjust completed/in-progress courses in your profile to see updated suggestions.
          </p>
        </div>
      </Modal>

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
