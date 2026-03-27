"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import type { ProgramBucketTree, BucketSlot } from "@/lib/types";

/* ── Ranking rules (shared with PlannerLayout) ────────────────────── */
export const rankingExplainerItems = [
  { id: "1", title: "Filter first", detail: "If you can\u2019t take it yet, it\u2019s out. Prereqs, standing, and already-finished courses get filtered first." },
  { id: "2", title: "Rank by requirement tier", detail: "Every eligible course lands in a priority tier. MCC foundation and business core beat electives and discovery." },
  { id: "3", title: "Respect bucket rules", detail: "Required buckets beat elective pools when the rules collide. If two courses cover the same slot, MarqBot keeps one there and can slide the extra one into electives when allowed." },
  { id: "4", title: "Reward what unlocks more", detail: "After the bucket rules are settled, courses that unlock more later or still help more than one allowed bucket move up." },
  { id: "5", title: "Adjust for your build", detail: "Your scheduling style shifts the balance. Grinder front-loads core, explorer mixes in discovery earlier, and mixer splits the difference." },
] as const;

/* ── Types ────────────────────────────────────────────────────────── */
interface MajorGuideModalProps {
  open: boolean;
  onClose: () => void;
  programs: ProgramBucketTree[];
  onFinish: () => void;
}

/* ── Mode tokens ──────────────────────────────────────────────────── */
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
  border: string; badgeColor: string; bgAccent: string; dotClass: string;
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

/* ── Expandable Bucket Card ───────────────────────────────────────── */
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
        onClick={() => setOpen((v) => !v)}
        className={[
          "w-full text-left rounded-lg border border-border-card",
          tokens.border,
          "border-l-[3px]",
          "px-3 py-2.5",
          "hover:bg-surface-hover/40 transition-colors",
          "cursor-pointer",
          "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card",
        ].join(" ")}
        style={{ background: open ? tokens.bgAccent : undefined }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.85rem] font-semibold text-ink-primary leading-snug truncate">
            {bucket.label}
          </p>
          <svg
            className={`w-3.5 h-3.5 text-ink-faint shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        <p className={`text-[0.75rem] font-semibold mt-0.5 ${tokens.badgeColor}`}>{badge}</p>
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
            <div className="px-3 pt-1.5 pb-2.5 space-y-1.5 border-l-[3px] border-border-subtle ml-0">
              {/* Mode explanation */}
              <p className="text-[0.74rem] text-ink-faint leading-relaxed">
                {bucket.requirement_mode === "required" && (
                  <>Every course in this bucket is mandatory. No substitutions, no skipping.</>
                )}
                {bucket.requirement_mode === "choose_n" && (
                  <>You pick {bucket.courses_required ?? "a few"} from a list of {bucket.course_count} options. This is where you shape your degree.</>
                )}
                {bucket.requirement_mode === "credits_pool" && (
                  <>Accumulate {bucket.credits_required ?? "enough"} credits from any eligible course in the pool. Flexible by design.</>
                )}
              </p>

              {bucket.min_level != null && (
                <span className="inline-block text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint bg-surface-hover/70 rounded-full px-2 py-0.5 border border-border-subtle/60">
                  upper-div (3000+ level)
                </span>
              )}

              {samples.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {samples.map((code) => (
                    <span
                      key={code}
                      className="text-[0.7rem] text-ink-secondary bg-surface-hover/80 border border-border-subtle rounded px-1.5 py-0.5 tabular-nums"
                    >
                      {code}
                    </span>
                  ))}
                  {hasMore && (
                    <span className="text-[0.7rem] text-ink-faint self-center">
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

/* ── Program Column ───────────────────────────────────────────────── */
function ProgramColumn({ program, index }: { program: ProgramBucketTree; index: number }) {
  const typeLabel = typeLabels[program.type] || program.type;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col min-w-[200px] max-w-[260px] w-full shrink-0"
    >
      {/* Column header */}
      <div className="rounded-t-xl border border-border-card border-b-0 px-3 py-3 bg-[linear-gradient(180deg,rgba(22,43,80,0.7),rgba(12,29,56,0.7))]">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold/65">
          {typeLabel}
        </span>
        <h4 className="text-[0.95rem] font-bold font-[family-name:var(--font-sora)] text-white leading-snug mt-0.5">
          {program.program_label}
        </h4>
        <p className="text-[0.68rem] text-ink-faint mt-0.5">
          {program.buckets.length} bucket{program.buckets.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Bucket cards */}
      <div className="rounded-b-xl border border-border-card border-t border-border-subtle/40 bg-surface-card/30 px-2 py-2 space-y-1.5 flex-1">
        {program.buckets.length === 0 ? (
          <p className="text-xs text-ink-faint text-center py-3">No requirements mapped yet.</p>
        ) : (
          program.buckets.map((bucket, i) => (
            <BucketCard key={bucket.bucket_id} bucket={bucket} index={i} />
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ── Legend ────────────────────────────────────────────────────────── */
function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {([
        { mode: "required" as const, label: "Required" },
        { mode: "choose_n" as const, label: "Choose N" },
        { mode: "credits_pool" as const, label: "Credit pool" },
      ]).map(({ mode, label }) => (
        <span key={mode} className={`inline-flex items-center gap-1.5 text-[0.68rem] font-medium px-2 py-0.5 rounded-full border border-border-subtle/50 bg-surface-hover/40 ${modeTokens[mode].badgeColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${modeTokens[mode].dotClass} shrink-0`} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

/* ── All-Programs Board (single screen) ───────────────────────────── */
export function ProgramStep({ program }: { program: ProgramBucketTree }) {
  // This signature is kept for backward compat with onboarding RoadmapStep
  // which renders one ProgramStep per program. See AllProgramsBoard for the full view.
  return <ProgramColumn program={program} index={0} />;
}

function AllProgramsBoard({ programs }: { programs: ProgramBucketTree[] }) {
  return (
    <div className="space-y-4">
      {/* Tutorial intro */}
      <div className="space-y-2">
        <p className="text-[0.97rem] text-ink-secondary leading-relaxed">
          Your degree is split into <strong className="text-ink-primary">programs</strong> (your major, any tracks, plus the business core and Marquette core that everyone shares).
          Each program has <strong className="text-ink-primary">buckets</strong> &mdash; groups of classes you need to check off before graduation.
        </p>
      </div>

      {/* How to read the colors */}
      <div className="rounded-xl border border-border-card bg-surface-card/40 px-4 py-3.5 space-y-2.5">
        <p className="text-[0.8rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">How to read this</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[0.9rem] leading-snug">
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-gold mt-1.5 shrink-0" />
            <div>
              <span className="font-semibold text-gold">Required</span>
              <span className="text-ink-faint"> &mdash; you take all of these. No choosing.</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-[#5B9BD5] mt-1.5 shrink-0" />
            <div>
              <span className="font-semibold text-[#8ec8ff]">Choose N</span>
              <span className="text-ink-faint"> &mdash; pick a set number from a larger list.</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-ink-faint/60 mt-1.5 shrink-0" />
            <div>
              <span className="font-semibold text-ink-muted">Credit pool</span>
              <span className="text-ink-faint"> &mdash; earn enough credits from eligible courses.</span>
            </div>
          </div>
        </div>
        <p className="text-[0.86rem] text-ink-faint leading-relaxed">
          Some courses can help more than one bucket, but not every overlap is allowed. MarqBot handles the counting rules automatically.
        </p>
      </div>

      {/* Horizontal scrolling board of program columns */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2">
        <div className="flex gap-3 items-start" style={{ minWidth: "min-content" }}>
          {programs.map((program, i) => (
            <ProgramColumn key={program.program_id} program={program} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Tier ladder data ─────────────────────────────────────────────── */
export const tierLadder = [
  { tier: 1, label: "MCC Foundation", desc: "Core curriculum that gates everything else" },
  { tier: 2, label: "Business Core (BCC)", desc: "Shared prereqs that unlock major courses" },
  { tier: 3, label: "Major", desc: "Direct degree requirements" },
  { tier: 4, label: "Track / Minor", desc: "Supplementary program requirements" },
  { tier: 5, label: "MCC Late", desc: "Upper-division core (writing, culminating)" },
  { tier: 6, label: "Discovery", desc: "Exploratory themes with wide course pools" },
] as const;

/* ── Ranking Step ─────────────────────────────────────────────────── */
function RankingStep() {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-sora)] text-gradient-gold">
          How MarqBot Ranks Courses
        </h3>
        <p className="text-[0.88rem] text-ink-faint">Five steps, applied in order. Here&rsquo;s how it works.</p>
      </div>

      <div className="rounded-2xl border border-gold/20 bg-[linear-gradient(135deg,rgba(255,204,0,0.09),rgba(255,204,0,0.03))] px-4 py-3 sm:px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 90% 50%, rgba(255,204,0,0.06), transparent)" }} aria-hidden />
        <p className="relative text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-gold/80 mb-1">Fast Read</p>
        <p className="relative text-[0.96rem] leading-relaxed text-ink-primary">
          MarqBot filters out what you can&rsquo;t take, respects the bucket-counting rules, then ranks the rest by priority and unlock potential.
        </p>
      </div>

      <ol className="grid list-none grid-cols-1 gap-2.5">
        {rankingExplainerItems.map((item, idx) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border-card bg-[linear-gradient(160deg,rgba(12,29,56,0.82),rgba(18,33,63,0.72))] px-4 py-3 hover:border-gold/15 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/14 border border-gold/20 text-xs font-bold text-gold shadow-[0_0_10px_rgba(255,204,0,0.12)]">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-ink-primary text-[0.95rem] leading-snug">{item.title}</p>
                <p className="mt-0.5 text-[0.88rem] leading-relaxed text-ink-faint">{item.detail}</p>
              </div>
            </div>
          </motion.li>
        ))}
      </ol>

      {/* Tier ladder */}
      <div className="rounded-xl border border-border-card bg-surface-card/40 px-4 py-3.5 space-y-2.5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-ink-faint">Priority tiers (highest first)</p>
        <div className="space-y-1">
          {tierLadder.map((t, i) => (
            <div key={t.tier} className="flex items-center gap-2.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[0.7rem] font-bold tabular-nums"
                style={{
                  background: `rgba(255,204,0,${0.18 - i * 0.025})`,
                  color: i < 2 ? "rgba(255,204,0,1)" : "rgba(255,204,0,0.7)",
                  border: `1px solid rgba(255,204,0,${0.25 - i * 0.035})`,
                }}
              >
                {t.tier}
              </span>
              <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[0.88rem] font-semibold text-ink-primary leading-snug">{t.label}</span>
                <span className="text-[0.78rem] text-ink-faint leading-snug">&mdash; {t.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[0.8rem] text-ink-faint leading-relaxed pt-1">
          Within a tier, courses that unblock deeper prereq chains, still help more than one allowed bucket, or sit at a lower course level are picked first.
        </p>
      </div>

      <div className="rounded-xl border border-border-subtle/50 bg-surface-card/35 px-4 py-2.5">
        <p className="text-[0.9rem] leading-relaxed text-ink-faint">
          Deterministic rules, not guesswork.{" "}
          <a
            href="https://github.com/markiengo/marqbot/blob/main/docs/algorithm.md"
            target="_blank"
            rel="noreferrer"
            className="text-gold underline underline-offset-2 hover:text-gold-light transition-colors"
          >
            Full technical breakdown here
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/* ── Step dots ────────────────────────────────────────────────────── */
function StepDots({ total, current, onJump }: { total: number; current: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="Guide steps">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === current}
          aria-label={`Go to step ${i + 1}`}
          onClick={() => onJump(i)}
          className={[
            "rounded-full transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-gold",
            i === current
              ? "w-5 h-2.5 bg-gold shadow-[0_0_10px_rgba(255,204,0,0.5)]"
              : i < current
              ? "w-2.5 h-2.5 bg-gold/45 hover:bg-gold/60"
              : "w-2.5 h-2.5 bg-ink-faint/25 hover:bg-ink-faint/45",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

/* ── Main Modal (2 steps: board + ranking) ────────────────────────── */
export function MajorGuideModal({ open, onClose, programs, onFinish }: MajorGuideModalProps) {
  const [step, setStep] = useState(0);
  const totalSteps = 2; // board + ranking
  const isLastStep = step === 1;
  const directionRef = useRef<1 | -1>(1);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setStep(0);
      onFinish();
      return;
    }
    directionRef.current = 1;
    setStep(1);
  }, [isLastStep, onFinish]);

  const handleBack = useCallback(() => {
    directionRef.current = -1;
    setStep(0);
  }, []);

  const handleClose = useCallback(() => {
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
      <div className="flex flex-col gap-4 min-h-[40vh]">
        <div className="flex items-center justify-between">
          <StepDots total={totalSteps} current={step} onJump={(i) => { directionRef.current = i > step ? 1 : -1; setStep(i); }} />
          <span className="text-[0.75rem] text-ink-faint tabular-nums">
            {step + 1} / {totalSteps}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: directionRef.current * 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: directionRef.current * -36 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {isLastStep ? <RankingStep /> : <AllProgramsBoard programs={programs} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
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
