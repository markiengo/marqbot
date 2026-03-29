"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { Modal } from "@/components/shared/Modal";
import { OnboardingStepHeader } from "./OnboardingStepHeader";
import { CourseHistoryImport } from "./CourseHistoryImport";
import { postValidatePrereqs } from "@/lib/api";

interface CoursesStepProps {
  onWarningChange?: (hasWarning: boolean) => void;
}

export function CoursesStep({ onWarningChange }: CoursesStepProps) {
  const { state, dispatch } = useAppContext();
  const [inconsistencies, setInconsistencies] = useState<
    { course_code: string; prereqs_in_progress: string[] }[]
  >([]);
  const [whyModalOpen, setWhyModalOpen] = useState(false);

  const onWarningChangeRef = useRef(onWarningChange);
  useEffect(() => {
    onWarningChangeRef.current = onWarningChange;
  }, [onWarningChange]);

  const check = useCallback(async () => {
    if (state.completed.size === 0 || state.inProgress.size === 0) {
      setInconsistencies([]);
      onWarningChangeRef.current?.(false);
      return;
    }

    try {
      const result = await postValidatePrereqs({
        completed_courses: [...state.completed].join(", "),
        in_progress_courses: [...state.inProgress].join(", "),
      });
      setInconsistencies(result.inconsistencies);
      onWarningChangeRef.current?.(result.inconsistencies.length > 0);
    } catch {
      setInconsistencies([]);
      onWarningChangeRef.current?.(false);
    }
  }, [state.completed, state.inProgress]);

  useEffect(() => {
    const timer = setTimeout(check, 400);
    return () => clearTimeout(timer);
  }, [check]);

  return (
    <div className="space-y-5">
      <OnboardingStepHeader
        eyebrow="Add your classes"
        title={
          <>
            Add what you have <span className="text-gold">right now</span>.
          </>
        }
        description={
          <button
            type="button"
            onClick={() => setWhyModalOpen(true)}
            className="text-[0.98rem] font-medium text-[#8ec8ff] underline decoration-[#8ec8ff]/30 underline-offset-2 transition-colors hover:text-[#b7deff] hover:decoration-[#b7deff]/50 sm:text-[1.03rem]"
          >
            Why does MarqBot need this?
          </button>
        }
      />

      <Modal open={whyModalOpen} onClose={() => setWhyModalOpen(false)} title="Why MarqBot needs your courses">
        <div className="space-y-5 text-[0.95rem] leading-relaxed text-ink-secondary sm:text-[1.05rem]">
          <p className="text-ink-primary font-medium">
            Without your history, MarqBot is just guessing. With it, <span className="text-gold-light">it reads the prereq chains so you don&apos;t have to</span>.
          </p>
          <div className="space-y-3">
            <div className="onboarding-panel-soft rounded-xl px-4 py-3">
              <p className="font-semibold text-gold-light">Completed courses</p>
              <p className="mt-1">Requirements get marked satisfied, and courses that depend on them <span className="font-medium text-gold-light">unlock</span>. AP, IB, and transfer credit all count. No more digging through CheckMarq to figure out what&apos;s done.</p>
            </div>
            <div className="onboarding-panel-soft rounded-xl px-4 py-3">
              <p className="font-semibold text-gold-light">In-progress courses</p>
              <p className="mt-1">Assumed done by <span className="font-medium text-gold-light">end of term</span>. MarqBot plans around them so your next semester actually builds on what you&apos;re taking now. Not what you took two years ago.</p>
            </div>
          </div>

          <div className="onboarding-panel-gold rounded-xl px-4 py-4">
            <p className="font-semibold text-ink-primary">You don&apos;t need to add every class. Seriously.</p>
            <p className="mt-2 text-ink-secondary">
              Add <span className="font-semibold text-ink-primary">FINA 3001</span> and MarqBot already knows you passed <span className="font-semibold text-ink-primary">ACCO 1031</span> to get there. It walks backward through the <span className="font-medium text-gold-light">entire prereq chain</span> and marks each one done. That prereq is not bluffing &mdash; but neither is MarqBot.
            </p>
            <div className="mt-3 rounded-lg bg-[rgba(0,31,63,0.35)] px-3 py-2.5 text-xs leading-relaxed">
              <p className="font-semibold text-gold-light">The logic</p>
              <ul className="mt-1.5 space-y-1 text-ink-secondary">
                <li><span className="text-gold-light">&bull;</span> <span className="font-medium text-ink-primary">Required prereqs</span> &mdash; auto-assumed. No questions asked.</li>
                <li><span className="text-gold-light">&bull;</span> <span className="font-medium text-ink-primary">Either/or prereqs</span> &mdash; skipped. MarqBot can&apos;t read your mind.</li>
                <li><span className="text-gold-light">&bull;</span> <span className="font-medium text-ink-primary">In-progress prereqs</span> &mdash; promoted to completed. Efficient. Respect.</li>
              </ul>
            </div>
          </div>

          <div className="onboarding-panel-soft rounded-xl px-4 py-3">
            <p className="font-semibold text-gold-light">What if I skip this?</p>
            <p className="mt-1">MarqBot still builds a plan, but it <span className="font-medium text-gold-light">starts from zero</span>. You&apos;ll see courses you already passed. Lowkey a waste of everyone&apos;s time.</p>
          </div>

          <p className="text-xs text-ink-muted">
            Your data stays in your browser. <span className="text-gold-light/70">Nothing leaves</span> until you hit generate.
          </p>
        </div>
      </Modal>

      <CourseHistoryImport />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.08 }}
          className="import-list-section rounded-[1.55rem] px-4 py-4 sm:px-5"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ec8ff]">Completed</p>
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-ink-primary">
              Courses you&apos;ve already finished
            </h3>
            <p className="text-sm text-ink-secondary">
              Import populates this first. Edit here after applying if anything needs cleanup.
            </p>
          </div>
          <div className="mt-4">
            <MultiSelect
              courses={state.courses}
              selected={state.completed}
              otherSet={state.inProgress}
              onAdd={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
              onRemove={(code) => dispatch({ type: "REMOVE_COMPLETED", payload: code })}
              placeholder="Search completed courses"
              resolveLabel={(code) => code}
              chipViewportClassName="min-h-[2.75rem]"
              dynamicChipViewport
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.16 }}
          className="import-list-section rounded-[1.55rem] border-[rgba(255,204,0,0.18)] px-4 py-4 sm:px-5"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light">In Progress</p>
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-ink-primary">
              Courses you&apos;re taking right now
            </h3>
            <p className="text-sm text-ink-secondary">
              Keep current enrollment here. Use it after import to fix anything that landed in the wrong bucket.
            </p>
          </div>
          <div className="mt-4">
            <MultiSelect
              courses={state.courses}
              selected={state.inProgress}
              otherSet={state.completed}
              onAdd={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
              onRemove={(code) => dispatch({ type: "REMOVE_IN_PROGRESS", payload: code })}
              placeholder="Search in-progress courses"
              resolveLabel={(code) => code}
              chipViewportClassName="min-h-[2.75rem]"
              dynamicChipViewport
            />
          </div>
        </motion.div>
      </div>
      {inconsistencies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="onboarding-panel-danger rounded-[1.45rem] px-4 py-4 text-[0.92rem] text-[#ffd5dc]"
        >
          <p className="mb-1 font-semibold">Prereq mismatch to clean up:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {inconsistencies.map((issue) => (
              <li key={issue.course_code}>
                <span className="font-medium">{issue.course_code}</span> still needs:{" "}
                {issue.prereqs_in_progress.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">
            Move the prereq to completed, or remove the dependent course. You can continue, but the plan
            will be cleaner if you fix it now.
          </p>
        </motion.div>
      )}
    </div>
  );
}
