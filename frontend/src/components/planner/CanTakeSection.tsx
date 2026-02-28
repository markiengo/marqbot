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
            Hi, I&apos;m Marqbot. I don&apos;t guess — I follow a strict rulebook to figure out which courses make the most sense for you right now. Here&apos;s the full algorithm, top to bottom:
          </p>
          <ol className="space-y-3 list-none">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <p className="font-semibold text-white">Eligibility Filter</p>
                <p className="text-ink-faint text-xs mt-0.5">Before anything gets ranked, I throw out everything you literally can&apos;t take. Prereqs not done? Not offered this term? Standing too low? Gone. Zero point recommending a course you can&apos;t register for.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <p className="font-semibold text-white">Requirement Tiers</p>
                <p className="text-ink-faint text-xs mt-0.5">Courses get sorted into tiers based on what they fulfill. MCC (ENGL, PHIL, THEO, CORE) and BCC core (BUAD, ECON, MANA, BULA) sit at the top. Major requirements come next. Tracks, concentrations, and minors follow. Everything else is below. I clear the foundations first so nothing bottlenecks later.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <p className="font-semibold text-white">Prereq Blocker Priority</p>
                <p className="text-ink-faint text-xs mt-0.5">Out of everything you still need to take, which one course is gatekeeping the most other courses on your list? That&apos;s the bottleneck. I find it and push it to the front — take that one class and suddenly half your schedule opens up.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">4</span>
              <div>
                <p className="font-semibold text-white">Chain Depth</p>
                <p className="text-ink-faint text-xs mt-0.5">I trace the full prereq chain from every course all the way down. FINA 3001 kicks off a 5-semester sequence to AIM 4430? That&apos;s depth 4 — it gets scheduled way before some standalone elective with depth 0. Long chains = early starts. No surprises senior year.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">5</span>
              <div>
                <p className="font-semibold text-white">Multi-Bucket Score</p>
                <p className="text-ink-faint text-xs mt-0.5">One course checking off your major, BCC, and a track requirement at the same time? That&apos;s a 3-for-1 deal and it absolutely moves up the list. More requirements knocked out per course = faster graduation. Efficiency is bussin.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">6</span>
              <div>
                <p className="font-semibold text-white">Direct Unlockers</p>
                <p className="text-ink-faint text-xs mt-0.5">If two courses are still tied, I pick the one that directly unlocks more options for your next semester. More doors opened = better pick. Simple math.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">7</span>
              <div>
                <p className="font-semibold text-white">Program Diversity</p>
                <p className="text-ink-faint text-xs mt-0.5">Double major? I make sure both majors get love. If Finance already has 3 picks and INSY has 0, the next FINA course gets deferred so INSY can catch up. No major gets left behind.</p>
              </div>
            </li>
          </ol>
          <p className="text-ink-faint text-xs pt-1 border-t border-border-subtle/40">
            I assume you pass everything I recommend. Keep your completed and in-progress courses updated and I&apos;ll keep the plan accurate.
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
