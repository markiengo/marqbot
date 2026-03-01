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
        titleClassName="!text-[clamp(1.25rem,2.5vw,1.75rem)] font-semibold font-[family-name:var(--font-sora)] text-gold"
        size="planner-detail"
      >
        <div className="space-y-4 text-[16px] text-ink-secondary">
          <p className="text-ink-faint text-[14px]">
            Hey! Here&apos;s how I pick your courses. No guessing — just rules, top to bottom:
          </p>
          <ol className="space-y-3 list-none">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">1</span>
              <div>
                <p className="font-semibold text-white text-[16px]">Can you actually take it?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">First, I remove anything you can&apos;t register for. Missing a prereq? Not offered this semester? Not enough credits to qualify? It&apos;s gone. I only show you courses you can actually sign up for.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">2</span>
              <div>
                <p className="font-semibold text-white text-[16px]">What does it count toward?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">University requirements (PHIL, THEO, ENGL) and business core (BUAD, ECON, ACCO) come first. Then your major. Then your track or concentration. Electives come last. I knock out the important stuff before the flexible stuff.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">3</span>
              <div>
                <p className="font-semibold text-white text-[16px]">Is it blocking you?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">Some courses are gatekeepers — you can&apos;t take a bunch of other classes until you finish them. I find those bottlenecks and push them to the front so you don&apos;t get stuck later.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">4</span>
              <div>
                <p className="font-semibold text-white text-[16px]">How long is the chain?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">Some courses kick off a sequence that takes multiple semesters to finish. The longer that chain, the earlier you need to start. I make sure you&apos;re not scrambling senior year because you started a 4-course sequence too late.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">5</span>
              <div>
                <p className="font-semibold text-white text-[16px]">Does it knock out multiple requirements?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">If one course counts toward your major AND your business core at the same time, that&apos;s a two-for-one. Those move up the list because they save you time and credits.</p>
              </div>
            </li>
          </ol>
          <p className="text-ink-faint text-[14px] pt-1 border-t border-border-subtle/40">
            I assume you&apos;ll pass everything. Keep your courses updated so I don&apos;t accidentally plan your downfall.
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
