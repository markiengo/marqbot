"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { useReducedEffects } from "@/hooks/useReducedEffects";

const storySteps = [
  {
    number: "01",
    eyebrow: "Load context",
    title: (
      <>
        <span className="text-white">Bring in your </span>
        <span className="text-[#b6dcff]">record</span>
        <span className="text-gold-light"> first.</span>
      </>
    ),
    explainer: "Start with your real history.",
  },
  {
    number: "02",
    eyebrow: "See progress",
    title: (
      <>
        <span className="text-white">See what is </span>
        <span className="text-[#b6dcff]">done</span>
        <span className="text-gold-light"> and open.</span>
      </>
    ),
    explainer: "See done. See open.",
  },
  {
    number: "03",
    eyebrow: "Edit draft",
    title: (
      <>
        <span className="text-white">Swap the </span>
        <span className="text-[#b6dcff]">mix</span>
        <span className="text-white"> before you</span>
        <span className="text-gold-light"> save.</span>
      </>
    ),
    explainer: "Swap before you save.",
  },
  {
    number: "04",
    eyebrow: "Save paths",
    title: (
      <>
        <span className="text-white">Keep the </span>
        <span className="text-[#b6dcff]">best</span>
        <span className="text-gold-light"> path.</span>
      </>
    ),
    explainer: "Save drafts. Compare later.",
  },
] as const;

const transcriptPreview = [
  { code: "ACCO 1030", title: "Principles of Financial Accounting", state: "Completed" },
  { code: "ECON 1103", title: "Principles of Microeconomics", state: "Completed" },
  { code: "MATH 1450", title: "Calculus", state: "In progress" },
  { code: "BULA 1001", title: "Principles of Law", state: "In progress" },
] as const;

const progressBuckets = [
  { label: "Business Core", done: 31, total: 33, inProgress: 0 },
  { label: "Accounting Track", done: 16, total: 18, inProgress: 0 },
  { label: "Finance Track", done: 12, total: 15, inProgress: 1 },
  { label: "MCC Requirements", done: 28, total: 30, inProgress: 0 },
  { label: "Free Electives", done: 6, total: 12, inProgress: 1 },
  { label: "Open Gaps", done: 2, total: 6, inProgress: 0 },
] as const;

const selectedCourses = [
  { code: "ACCO 3001", title: "Intermediate Accounting I", bucket: "Accounting", note: "In the draft." },
  { code: "FINA 3001", title: "Financial Management", bucket: "Finance", note: "Still fits." },
  { code: "MARK 3001", title: "Introduction to Marketing", bucket: "Business core", note: "Keeps the term balanced." },
] as const;

const swapOptions = [
  { code: "BULA 3001", title: "Legal and Ethical Environment of Business", tags: ["MCC", "3 credits", "Open"], note: "Fills a requirement without raising the load." },
  { code: "SCMM 3010", title: "Supply Chain Foundations", tags: ["Core", "3 credits", "Good swap"], note: "Cleaner fit if accounting is already doing enough." },
] as const;

const savedPaths = [
  { label: "Path A", note: "Balanced load", active: true },
  { label: "Path B", note: "Lighter spring", active: false },
  { label: "Path C", note: "Longer runway", active: false },
] as const;

const savedSemesterCards = [
  { term: "Fall 2027", courses: ["FINA 3001", "BULA 3001", "MARK 3001"] },
  { term: "Spring 2028", courses: ["ACCO 3101", "SCMM 3200", "BULA 4050"] },
] as const;

function previewItemMotion(_reduceEffects: boolean, _delay = 0) {
  return {};
}

function StoryBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] ${className ?? "border-white/10 bg-white/[0.04] text-slate-200"}`}>
      {label}
    </span>
  );
}

function StoryFrameShell({
  headline,
  chips,
  explainer,
  children,
}: {
  headline: string;
  chips: string[];
  explainer: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(8,22,42,0.94),rgba(7,18,34,0.92))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[0.9rem] font-semibold uppercase tracking-[0.22em] text-gold-light">{headline}</p>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, index) => (
            <StoryBadge
              key={chip}
              label={chip}
              className={index === 0 ? "border-gold/24 bg-gold/10 text-gold-light" : "border-white/10 bg-white/[0.04] text-slate-100"}
            />
          ))}
        </div>
      </div>
      <h3 className="mt-5 max-w-[46rem] text-[clamp(1.6rem,2.8vw,2.65rem)] font-semibold leading-[1.03] tracking-[-0.04em] text-[#9fd1ff]">
        {explainer}
      </h3>
      <div className="mt-6 min-h-0 flex-1">{children}</div>
    </div>
  );
}

function StepOnePreview({ reduceEffects }: { reduceEffects: boolean }) {
  return (
    <StoryFrameShell
      headline="Load the real record"
      chips={["Real record", "53 credits"]}
      explainer={storySteps[0].explainer}
    >
      <div className="grid h-full gap-4 lg:grid-cols-[0.74fr_1.26fr]">
        <div className="grid gap-3">
          {[
            ["Program", "Accounting + Finance"],
            ["History", "Completed and current classes stay attached."],
            ["Load", "6 credits in progress."],
          ].map(([label, value], index) => (
            <motion.div
              key={label}
              {...previewItemMotion(reduceEffects, 0.04 * index)}
              className={`rounded-[1.25rem] border px-4 py-4 ${
                index === 0
                  ? "border-gold/24 bg-[linear-gradient(145deg,rgba(255,204,0,0.10),rgba(10,23,43,0.92))]"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <p className="text-[0.81rem] font-semibold uppercase tracking-[0.18em] text-gold-light">
                {label}
              </p>
              <p className="mt-2 text-[1rem] leading-relaxed text-slate-200">{value}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          {...previewItemMotion(reduceEffects, 0.14)}
          className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-slate-300">
              Course history
            </p>
            <StoryBadge label="2 in progress" className="border-white/10 bg-white/[0.05] text-slate-200" />
          </div>
          <div className="mt-4 space-y-3">
            {transcriptPreview.map((course, index) => (
              <motion.div
                key={course.code}
                {...previewItemMotion(reduceEffects, 0.18 + index * 0.05)}
                className={`rounded-[1.05rem] border px-4 py-3 ${
                  index < 2 ? "border-gold/18 bg-gold/8" : "border-white/8 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#8ec8ff]">{course.code}</p>
                    <p className="mt-1 text-sm text-slate-100">{course.title}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] ${
                      course.state === "Completed"
                        ? "border-ok/25 bg-ok/10 text-ok"
                        : "border-gold/25 bg-gold/10 text-gold-light"
                    }`}
                  >
                    {course.state}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </StoryFrameShell>
  );
}

function StepTwoPreview({ reduceEffects }: { reduceEffects: boolean }) {
  const totalDone = progressBuckets.reduce((sum, bucket) => sum + bucket.done, 0);
  const totalTarget = progressBuckets.reduce((sum, bucket) => sum + bucket.total, 0);
  const overall = Math.round((totalDone / totalTarget) * 100);
  const completedCredits = 99;
  const inProgressCredits = 6;
  const openGroups = progressBuckets.filter((bucket) => bucket.done + bucket.inProgress < bucket.total).length;

  return (
    <StoryFrameShell
      headline="See what is still open"
      chips={[`${overall}% done`, `${openGroups} groups open`]}
      explainer={storySteps[1].explainer}
    >
      <div className="grid h-full gap-4 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:items-stretch">
        <div className="min-w-0">
          <motion.div
            {...previewItemMotion(reduceEffects, 0.04)}
            className="flex h-full flex-col gap-3 rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-5"
          >
            <motion.div
              {...previewItemMotion(reduceEffects, 0.08)}
              className="rounded-[1.2rem] border border-gold/18 bg-[linear-gradient(145deg,rgba(255,204,0,0.10),rgba(17,31,55,0.92))] px-4 py-5 text-center"
            >
              <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-gold-light">
                Degree progress
              </p>
              <p className="mt-3 text-[clamp(2.9rem,5vw,3.6rem)] font-bold leading-none tracking-[-0.06em] text-gold-light">
                {overall}%
              </p>
              <p className="mt-2 text-sm text-slate-300">Completed across the current program mix.</p>
            </motion.div>

            <div className="grid gap-3">
              {[
                ["Done", `${completedCredits} credits`, "text-ok"],
                ["Live", `${inProgressCredits} in progress`, "text-gold-light"],
                ["Open", `${openGroups} groups left`, "text-bad"],
              ].map(([label, value, tone], index) => (
                <motion.div
                  key={label}
                  {...previewItemMotion(reduceEffects, 0.12 + index * 0.05)}
                  className="rounded-[1.05rem] border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-gold-light">
                    {label}
                  </p>
                  <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          {...previewItemMotion(reduceEffects, 0.14)}
          className="min-w-0 rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))] p-4"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {progressBuckets.map((bucket, idx) => {
              const pct = Math.round((bucket.done / bucket.total) * 100);
              const totalPct = Math.min(100, Math.round(((bucket.done + bucket.inProgress) / bucket.total) * 100));
              const remaining = Math.max(bucket.total - bucket.done - bucket.inProgress, 0);
              const satisfied = bucket.done + bucket.inProgress >= bucket.total;

              return (
                <motion.div
                  key={bucket.label}
                  {...previewItemMotion(reduceEffects, 0.18 + idx * 0.04)}
                  className="flex h-full min-w-0 flex-col gap-2.5 rounded-xl border border-border-card bg-[linear-gradient(145deg,rgba(11,31,77,0.72),rgba(8,16,36,0.72))] px-4 py-4.5 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.94rem] font-medium leading-snug text-ink-primary">
                      {bucket.label}
                    </span>
                    <span className="shrink-0 text-[0.82rem] tabular-nums text-ink-faint">
                      {satisfied ? <span className="font-medium text-ok">Done</span> : `${totalPct}%`}
                    </span>
                  </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-hover">
                      <div className="flex h-full">
                      {pct > 0 ? (
                        <div
                          className={`h-full rounded-full bg-ok ${pct > 20 ? "bar-glow-ok" : ""}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      ) : null}
                      {bucket.inProgress > 0 ? (
                        <div
                          className={`h-full rounded-full bg-gold ${totalPct - pct > 10 ? "bar-glow-gold" : ""}`}
                          style={{ width: `${Math.max(0, Math.min(100 - pct, totalPct - pct))}%` }}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-1.5 text-[0.8rem] leading-tight">
                    <span className="tabular-nums text-ink-primary">
                      <span className="text-ok">{bucket.done}</span>
                      {bucket.inProgress > 0 ? <span className="text-gold-light">+{bucket.inProgress}</span> : null}
                      <span className="text-slate-300">/{bucket.total}</span>
                    </span>
                    <span className="text-ink-faint">
                      {bucket.inProgress > 0 ? "completed + in progress" : "completed"}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between text-[0.74rem]">
                    <span className="text-slate-400">
                      {idx < 2 ? "Priority bucket" : "Visible before registration"}
                    </span>
                    <span className={remaining > 0 ? "text-bad" : "text-ok"}>
                      {remaining > 0 ? `${remaining} open` : "On track"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </StoryFrameShell>
  );
}

function StepThreePreview({ reduceEffects }: { reduceEffects: boolean }) {
  return (
    <StoryFrameShell
      headline="Edit before you lock it"
      chips={["3 picked", "2 swaps"]}
      explainer={storySteps[2].explainer}
    >
      <div className="grid h-full gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <motion.section
          {...previewItemMotion(reduceEffects, 0.05)}
          className="flex flex-col rounded-[1.2rem] border border-border-subtle bg-[rgba(7,18,39,0.44)] p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light">Selected</p>
              <h3 className="mt-1 text-lg font-bold font-[family-name:var(--font-sora)] leading-tight text-white">
                Draft
              </h3>
            </div>
            <span className="text-sm font-semibold text-gold-light">{selectedCourses.length}</span>
          </div>

          <div className="space-y-2.5">
            {selectedCourses.map((course, index) => (
              <motion.div
                key={course.code}
                {...previewItemMotion(reduceEffects, 0.1 + index * 0.05)}
                className="glass-card flex items-center gap-3 rounded-xl border-l-2 border-l-ok/50 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="whitespace-nowrap text-sm font-semibold text-mu-blue">{course.code}</span>
                    <span className="truncate text-sm text-ink-primary">{course.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-100">
                      {course.bucket}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-bad transition-colors hover:bg-bad-light/30"
                  aria-label={`Remove ${course.code}`}
                >
                  x
                </button>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...previewItemMotion(reduceEffects, 0.26)}
            className="mt-auto rounded-[1rem] border border-ok/18 bg-ok/8 px-4 py-3"
          >
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ok">Same load - 9 credits</p>
          </motion.div>
        </motion.section>

        <motion.section
          {...previewItemMotion(reduceEffects, 0.1)}
          className="flex flex-col rounded-[1.2rem] border border-border-subtle bg-[rgba(7,18,39,0.44)] p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-accent-blue">Swaps</p>
              <h3 className="mt-1 text-lg font-bold font-[family-name:var(--font-sora)] leading-tight text-white">
                Options
              </h3>
            </div>
            <span className="text-sm font-semibold text-ink-accent-blue">{swapOptions.length}</span>
          </div>

          <div className="space-y-2.5">
            {swapOptions.map((course, index) => (
              <motion.div
                key={course.code}
                {...previewItemMotion(reduceEffects, 0.16 + index * 0.05)}
                className="flex items-center gap-3 rounded-xl border border-border-medium px-3 py-2.5 transition-colors hover:border-mu-blue/30 hover:bg-[rgba(0,114,206,0.04)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="whitespace-nowrap text-sm font-semibold text-mu-blue">{course.code}</span>
                    <span className="truncate text-sm text-ink-primary">{course.title}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {course.tags.map((tag, index) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] ${
                          index === 0 ? "border border-gold/24 bg-gold/10 text-gold-light" : "border border-white/10 bg-white/[0.05] text-slate-100"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-ok transition-colors hover:bg-ok/10"
                  aria-label={`Add ${course.code}`}
                >
                  +
                </button>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...previewItemMotion(reduceEffects, 0.28)}
            className="mt-auto flex items-center justify-between rounded-[1rem] border border-gold/20 bg-[linear-gradient(145deg,rgba(255,204,0,0.08),rgba(10,23,43,0.92))] px-4 py-3"
          >
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-gold-light">Swap result</p>
              <p className="mt-1 text-sm text-slate-100">
                ACCO 3001 <span className="text-gold-light">-&gt;</span> BULA 3001
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-200">
              Update draft
            </span>
          </motion.div>
        </motion.section>
      </div>
    </StoryFrameShell>
  );
}

function StepFourPreview({ reduceEffects }: { reduceEffects: boolean }) {
  return (
    <StoryFrameShell
      headline="Save the better path"
      chips={["3 saved paths", "Compare later"]}
      explainer={storySteps[3].explainer}
    >
      <div className="grid h-full gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <motion.div
          {...previewItemMotion(reduceEffects, 0.05)}
          className="flex flex-col rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-gold-light">Path in focus</p>
              <h3 className="mt-2 text-[clamp(2rem,4vw,3.3rem)] font-bold leading-[0.95] tracking-[-0.05em] text-white">
                Finance path A
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <StoryBadge label="Balanced load" className="border-gold/24 bg-gold/10 text-gold-light" />
              <StoryBadge label="Upper-division first" className="border-white/10 bg-white/[0.05] text-slate-100" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {savedSemesterCards.map((semester, index) => (
              <motion.div
                key={semester.term}
                {...previewItemMotion(reduceEffects, 0.1 + index * 0.06)}
                className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#9fd1ff]">{semester.term}</p>
                <div className="mt-3 space-y-2">
                  {semester.courses.map((course, index) => (
                    <div
                      key={course}
                      className={`rounded-[0.95rem] border px-3 py-2 text-sm font-semibold ${
                        index === 0
                          ? "border-gold/24 bg-[linear-gradient(145deg,rgba(255,204,0,0.10),rgba(10,23,43,0.92))] text-gold-light"
                          : "border-white/10 bg-white/[0.04] text-slate-200"
                      }`}
                    >
                      {course}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-auto grid gap-3 sm:grid-cols-3">
            {[
              ["Compare", "Keep another draft ready."],
              ["Saved", "Inputs stay attached."],
              ["Later", "Come back when you need it."],
            ].map(([label, value], index) => (
              <motion.div
                key={label}
                {...previewItemMotion(reduceEffects, 0.18 + index * 0.04)}
                className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-gold-light">{label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{value}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="flex flex-col gap-3">
          {savedPaths.map((path, index) => (
            <motion.div
              key={path.label}
              {...previewItemMotion(reduceEffects, 0.14 + index * 0.05)}
              className={`rounded-[1.2rem] border px-4 py-4 ${
                path.active
                  ? "border-gold/24 bg-[linear-gradient(135deg,rgba(255,204,0,0.12),rgba(10,23,43,0.94))]"
                  : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <p className={`text-[1.7rem] font-semibold leading-none ${path.active ? "text-gold-light" : "text-white"}`}>{path.label}</p>
              <p className="mt-3 text-base leading-relaxed text-slate-300">{path.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </StoryFrameShell>
  );
}

function StoryFrame({ activeIndex, reduceEffects }: { activeIndex: number; reduceEffects: boolean }) {
  if (activeIndex === 0) return <StepOnePreview reduceEffects={reduceEffects} />;
  if (activeIndex === 1) return <StepTwoPreview reduceEffects={reduceEffects} />;
  if (activeIndex === 2) return <StepThreePreview reduceEffects={reduceEffects} />;
  return <StepFourPreview reduceEffects={reduceEffects} />;
}

export function HowItWorksClear() {
  const reduceEffects = useReducedEffects();
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const setPreviewIndex = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(storySteps.length - 1, nextIndex));
    if (clamped === activeIndexRef.current) return;
    activeIndexRef.current = clamped;
    setActiveIndex(clamped);
  };

  useEffect(() => {
    if (reduceEffects) {
      activeIndexRef.current = 0;
      setActiveIndex(0);
    }
  }, [reduceEffects]);

  useEffect(() => {
    if (reduceEffects) return;
    const timer = window.setInterval(() => {
      const next = (activeIndexRef.current + 1) % storySteps.length;
      setPreviewIndex(next);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [reduceEffects]);

  return (
    <section
      id="story"
      data-testid="landing-story"
      data-tour-mode={reduceEffects ? "poster" : "auto"}
      data-active-step={String(activeIndex + 1)}
      className="relative overflow-hidden bg-[linear-gradient(180deg,#071221_0%,#08192f_100%)] py-14 sm:py-18 scroll-mt-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(255,204,0,0.12),transparent_28%),radial-gradient(circle_at_84%_16%,rgba(0,114,206,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]" />

      <div className="relative mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[46rem] text-center">
          <p className="text-[0.96rem] font-semibold uppercase tracking-[0.24em] text-gold-light">How it works</p>
          <h2 className="mt-4 text-[clamp(2.5rem,6vw,4.8rem)] font-bold leading-[0.94] tracking-[-0.05em] text-white">
            Four <span className="text-[#b6dcff]">fast</span> <span className="text-gold-light">moves.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[34rem] text-[1.08rem] leading-relaxed text-slate-300">
            Real planner views. No filler.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:min-h-[44rem] lg:grid-cols-[26rem_minmax(0,1fr)] lg:items-stretch lg:gap-6 xl:grid-cols-[28rem_minmax(0,1fr)] xl:gap-8">
          <div className="relative z-10 grid gap-4 lg:h-full lg:grid-rows-4 lg:pr-1">
            {storySteps.map((step, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => setPreviewIndex(index)}
                  aria-pressed={active}
                  className={`group flex h-full w-full items-center gap-4 rounded-[1.5rem] border px-5 py-5 text-left transition-all duration-300 ${
                    active
                      ? "border-gold/30 bg-[linear-gradient(135deg,rgba(255,204,0,0.12),rgba(10,23,43,0.96))] shadow-[0_24px_70px_rgba(0,0,0,0.32)]"
                      : "border-white/10 bg-[linear-gradient(165deg,rgba(8,24,46,0.88),rgba(8,21,39,0.92))] hover:border-white/18 hover:bg-[linear-gradient(165deg,rgba(9,28,53,0.92),rgba(9,22,41,0.94))]"
                  }`}
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-base font-bold ${
                    active ? "border-gold/30 bg-[linear-gradient(145deg,#fff3b5,#ffe48a)] text-slate-950" : "border-white/14 bg-white/[0.06] text-slate-300"
                  }`}>
                    {step.number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[1.17rem] font-semibold uppercase tracking-[0.16em] text-gold-light">{step.eyebrow}</p>
                    <p className="mt-2 text-[1.77rem] font-semibold leading-tight tracking-[-0.02em]">
                      <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5">{step.title}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-0 overflow-hidden rounded-[2rem] lg:ml-4 lg:min-h-[44rem] xl:ml-6">
            <div className="relative min-h-[34rem] overflow-hidden lg:h-full lg:min-h-[44rem]">
              <motion.div
                key={activeIndex}
                initial={reduceEffects ? false : { opacity: 0.9, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceEffects ? 0.12 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 min-w-0"
              >
                <StoryFrame activeIndex={activeIndex} reduceEffects={reduceEffects} />
              </motion.div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            asChild
            variant="gold"
            size="lg"
            className="min-w-[320px] rounded-[1.8rem] px-12 py-4 text-[1.15rem] shadow-[0_0_34px_rgba(255,204,0,0.18)]"
          >
            <Link href="/onboarding">
              Get My Plan
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
