"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { sortProgramsForBucketMap } from "@/lib/programBucketMapOrder";
import type { ProgramBucketTree, BucketSlot } from "@/lib/types";
import type { SchedulingStyle } from "@/lib/schedulingStyle";
import { RankingLeaderboardExplainer } from "./RankingLeaderboardExplainer";

interface MajorGuideModalProps {
  open: boolean;
  onClose: () => void;
  programs: ProgramBucketTree[];
  currentStyle: SchedulingStyle;
  onFinish: () => void;
}

const modeTokens = {
  required: {
    border: "border-l-gold",
    badgeColor: "text-gold",
    bgAccent: "rgba(255,204,0,0.05)",
    dotClass: "bg-gold",
  },
  choose_n: {
    border: "border-l-[#5B9BD5]",
    badgeColor: "text-[#8ec8ff]",
    bgAccent: "rgba(91,155,213,0.05)",
    dotClass: "bg-[#5B9BD5]",
  },
  credits_pool: {
    border: "border-l-ink-faint/40",
    badgeColor: "text-ink-muted",
    bgAccent: "rgba(141,170,224,0.03)",
    dotClass: "bg-ink-faint/60",
  },
} satisfies Record<BucketSlot["requirement_mode"], {
  border: string;
  badgeColor: string;
  bgAccent: string;
  dotClass: string;
}>;

const typeLabels: Record<string, string> = {
  major: "Major",
  track: "Track",
  minor: "Minor",
  universal: "Core",
};

function bucketBadge(bucket: BucketSlot): string {
  if (bucket.requirement_mode === "required") {
    return `All ${bucket.courses_required ?? bucket.course_count} courses`;
  }
  if (bucket.requirement_mode === "choose_n") {
    return `Pick ${bucket.courses_required ?? "?"} from ${bucket.course_count}`;
  }
  return `Earn ${bucket.credits_required ?? "?"} credits`;
}

function BucketCard({ bucket, index }: { bucket: BucketSlot; index: number }) {
  const [open, setOpen] = useState(false);
  const tokens = modeTokens[bucket.requirement_mode];
  const badge = bucketBadge(bucket);
  const samples = bucket.sample_courses;
  const hasMore = bucket.course_count > samples.length;
  const isPool = bucket.requirement_mode === "credits_pool";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={[
          "w-full cursor-pointer rounded-lg border border-border-card border-l-[3px] px-3 py-2.5 text-left transition-colors hover:bg-surface-hover/40",
          "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card",
          tokens.border,
        ].join(" ")}
        style={{ background: open ? tokens.bgAccent : undefined }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[0.85rem] font-semibold leading-snug text-ink-primary">
            {bucket.label}
          </p>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        <p className={`mt-0.5 text-[0.75rem] font-semibold ${tokens.badgeColor}`}>{badge}</p>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-0 space-y-1.5 border-l-[3px] border-border-subtle px-3 pb-2.5 pt-1.5">
              <p className="text-[0.74rem] leading-relaxed text-ink-faint">
                {bucket.requirement_mode === "required" && (
                  <>Every course in this bucket is mandatory. No substitutions, no skipping.</>
                )}
                {bucket.requirement_mode === "choose_n" && (
                  <>You pick {bucket.courses_required ?? "a few"} from a list of {bucket.course_count} options.</>
                )}
                {bucket.requirement_mode === "credits_pool" && (
                  <>Accumulate {bucket.credits_required ?? "enough"} credits from any eligible course in the pool.</>
                )}
              </p>

              {bucket.min_level != null && (
                <span className="inline-block rounded-full border border-border-subtle/60 bg-surface-hover/70 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
                  upper-div (3000+ level)
                </span>
              )}

              {samples.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {samples.map((code) => (
                    <span
                      key={code}
                      className="rounded border border-border-subtle bg-surface-hover/80 px-1.5 py-0.5 text-[0.7rem] tabular-nums text-ink-secondary"
                    >
                      {code}
                    </span>
                  ))}
                  {hasMore && (
                    <span className="self-center text-[0.7rem] text-ink-faint">
                      +{bucket.course_count - samples.length} more
                    </span>
                  )}
                </div>
              )}

              {isPool && samples.length === 0 && (
                <p className="text-[0.75rem] text-ink-faint">from eligible biz courses</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProgramColumn({ program, index }: { program: ProgramBucketTree; index: number }) {
  const typeLabel = typeLabels[program.type] || program.type;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full min-w-[200px] max-w-[260px] shrink-0 flex-col"
    >
      <div className="rounded-t-xl border border-border-card border-b-0 bg-[linear-gradient(180deg,rgba(22,43,80,0.7),rgba(12,29,56,0.7))] px-3 py-3">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold/65">
          {typeLabel}
        </span>
        <h4 className="mt-0.5 font-[family-name:var(--font-sora)] text-[0.95rem] font-bold leading-snug text-white">
          {program.program_label}
        </h4>
        <p className="mt-0.5 text-[0.68rem] text-ink-faint">
          {program.buckets.length} bucket{program.buckets.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 space-y-1.5 rounded-b-xl border border-border-card border-t border-border-subtle/40 bg-surface-card/30 px-2 py-2">
        {program.buckets.length === 0 ? (
          <p className="py-3 text-center text-xs text-ink-faint">No requirements mapped yet.</p>
        ) : (
          program.buckets.map((bucket, bucketIndex) => (
            <BucketCard key={bucket.bucket_id} bucket={bucket} index={bucketIndex} />
          ))
        )}
      </div>
    </motion.div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {([
        { mode: "required" as const, label: "Required" },
        { mode: "choose_n" as const, label: "Choose N" },
        { mode: "credits_pool" as const, label: "Credit pool" },
      ]).map(({ mode, label }) => (
        <span
          key={mode}
          className={`inline-flex items-center gap-1.5 rounded-full border border-border-subtle/50 bg-surface-hover/40 px-2 py-0.5 text-[0.68rem] font-medium ${modeTokens[mode].badgeColor}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${modeTokens[mode].dotClass}`} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

export function ProgramStep({ program }: { program: ProgramBucketTree }) {
  return <ProgramColumn program={program} index={0} />;
}

function AllProgramsBoard({ programs }: { programs: ProgramBucketTree[] }) {
  const orderedPrograms = sortProgramsForBucketMap(programs);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[0.97rem] leading-relaxed text-ink-secondary">
          Your degree is split into <strong className="text-ink-primary">programs</strong> and{" "}
          <strong className="text-ink-primary">buckets</strong>. Each bucket is a group of classes
          you still need before graduation.
        </p>
      </div>

      <div className="space-y-2.5 rounded-xl border border-border-card bg-surface-card/40 px-4 py-3.5">
        <p className="text-[0.8rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          How to read this
        </p>
        <Legend />
        <p className="text-[0.86rem] leading-relaxed text-ink-faint">
          Some courses can help more than one bucket, but not every overlap is allowed. MarqBot
          handles that counting for you.
        </p>
      </div>

      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <div className="flex items-start gap-3" style={{ minWidth: "min-content" }}>
          {orderedPrograms.map((program, index) => (
            <ProgramColumn key={program.program_id} program={program} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RankingStep({ currentStyle }: { currentStyle: SchedulingStyle }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-gold-light">
          Course order
        </p>
        <h3 className="text-[clamp(2.2rem,4vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.045em] text-white">
          Same rules. <span className="text-gradient-gold">Different order.</span>
        </h3>
        <p className="mx-auto max-w-[34rem] text-[0.96rem] leading-relaxed text-slate-300">
          Your build changes what rises first after MarqBot filters out locked courses.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="h-px w-44 bg-[linear-gradient(90deg,transparent,rgba(255,204,0,0.92),transparent)]" />
      </div>

      <RankingLeaderboardExplainer currentStyle={currentStyle} />
    </div>
  );
}

function StepDots({ total, current, onJump }: { total: number; current: number; onJump: (index: number) => void }) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="Guide steps">
      {Array.from({ length: total }, (_, index) => (
        <button
          key={index}
          type="button"
          role="tab"
          aria-selected={index === current}
          aria-label={`Go to step ${index + 1}`}
          onClick={() => onJump(index)}
          className={[
            "cursor-pointer rounded-full transition-all duration-200 focus-visible:ring-2 focus-visible:ring-gold",
            index === current
              ? "h-2.5 w-5 bg-gold shadow-[0_0_10px_rgba(255,204,0,0.5)]"
              : index < current
                ? "h-2.5 w-2.5 bg-gold/45 hover:bg-gold/60"
                : "h-2.5 w-2.5 bg-ink-faint/25 hover:bg-ink-faint/45",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export function MajorGuideModal({
  open,
  onClose,
  programs,
  currentStyle,
  onFinish,
}: MajorGuideModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const totalSteps = 2;
  const isLastStep = step === 1;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setStep(0);
      setDirection(1);
      onFinish();
      return;
    }
    setDirection(1);
    setStep(1);
  }, [isLastStep, onFinish]);

  const handleBack = useCallback(() => {
    setDirection(-1);
    setStep(0);
  }, []);

  const handleClose = useCallback(() => {
    setDirection(1);
    setStep(0);
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isLastStep ? "How MarqBot Ranks" : "Your degree at a glance"}
      titleClassName="!text-[clamp(1.2rem,2.6vw,1.65rem)] font-bold font-[family-name:var(--font-sora)] text-gold"
      size="planner-detail"
    >
      <div className="flex min-h-[40vh] flex-col gap-4">
        <div className="flex items-center justify-between">
          <StepDots
            total={totalSteps}
            current={step}
            onJump={(index) => {
              setDirection(index > step ? 1 : -1);
              setStep(index);
            }}
          />
          <span className="tabular-nums text-[0.75rem] text-ink-faint">
            {step + 1} / {totalSteps}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: direction * 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -36 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {isLastStep ? (
                <RankingStep currentStyle={currentStyle} />
              ) : (
                <AllProgramsBoard programs={programs} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle pt-2">
          <div className="min-w-[80px]">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                &larr; Back
              </Button>
            )}
          </div>
          <Button
            variant={isLastStep ? "gold" : "ink"}
            size="md"
            onClick={handleNext}
            className={isLastStep ? "cta-shimmer shadow-[0_0_24px_rgba(255,204,0,0.35),0_0_48px_rgba(255,204,0,0.15)]" : ""}
          >
            {isLastStep ? "Show My Plan \u2192" : "Next \u2192"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
