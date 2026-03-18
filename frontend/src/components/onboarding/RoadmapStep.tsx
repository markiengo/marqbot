"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { loadProgramBuckets } from "@/lib/api";
import type { ProgramBucketTree, BucketSlot } from "@/lib/types";

const UNIVERSAL_PROGRAM_IDS = [
  "BCC_CORE", "MCC_CULM", "MCC_DISC", "MCC_ESSV2", "MCC_FOUNDATION", "MCC_WRIT",
];

/* ── Mode tokens (matches MajorGuideModal) ────────────────────────── */
const modeTokens = {
  required: { border: "border-l-gold", badgeColor: "text-gold", bgAccent: "rgba(255,204,0,0.05)", dotClass: "bg-gold" },
  choose_n: { border: "border-l-[#5B9BD5]", badgeColor: "text-[#8ec8ff]", bgAccent: "rgba(91,155,213,0.05)", dotClass: "bg-[#5B9BD5]" },
  credits_pool: { border: "border-l-ink-faint/40", badgeColor: "text-ink-muted", bgAccent: "rgba(141,170,224,0.03)", dotClass: "bg-ink-faint/60" },
};

const typeLabels: Record<string, string> = { major: "Major", track: "Track", minor: "Minor", universal: "Core" };

function bucketBadge(b: BucketSlot): string {
  if (b.requirement_mode === "required") return `All ${b.courses_required ?? b.course_count} courses`;
  if (b.requirement_mode === "choose_n") return `Pick ${b.courses_required ?? "?"} from ${b.course_count}`;
  return `Earn ${b.credits_required ?? "?"} credits`;
}

/* ── Compact bucket card with expand ──────────────────────────────── */
function BucketCard({ bucket, index }: { bucket: BucketSlot; index: number }) {
  const [open, setOpen] = useState(false);
  const tokens = modeTokens[bucket.requirement_mode];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left rounded-lg border border-border-card ${tokens.border} border-l-[3px] px-2.5 py-2 hover:bg-surface-hover/40 transition-colors cursor-pointer`}
        style={{ background: open ? tokens.bgAccent : undefined }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[0.92rem] font-semibold text-ink-primary leading-snug truncate">{bucket.label}</p>
          <svg className={`w-3 h-3 text-ink-faint shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        <p className={`text-[0.8rem] font-semibold mt-0.5 ${tokens.badgeColor}`}>{bucketBadge(bucket)}</p>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pt-1 pb-2 space-y-1 border-l-[3px] border-border-subtle">
              <p className="text-[0.83rem] text-ink-faint leading-relaxed">
                {bucket.requirement_mode === "required" && "Every course here is mandatory. No substitutions."}
                {bucket.requirement_mode === "choose_n" && `Pick ${bucket.courses_required ?? "a few"} from ${bucket.course_count} options. This is where you shape your degree.`}
                {bucket.requirement_mode === "credits_pool" && `Accumulate ${bucket.credits_required ?? "enough"} credits from any eligible course.`}
              </p>
              {bucket.min_level != null && (
                <span className="inline-block text-[0.72rem] font-semibold uppercase tracking-wider text-ink-faint bg-surface-hover/70 rounded-full px-1.5 py-0.5 border border-border-subtle/60">
                  upper-div (3000+)
                </span>
              )}
              {bucket.sample_courses.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {bucket.sample_courses.map((code) => (
                    <span key={code} className="text-[0.78rem] text-ink-secondary bg-surface-hover/80 border border-border-subtle rounded px-1.5 py-0.5 tabular-nums">{code}</span>
                  ))}
                  {bucket.course_count > bucket.sample_courses.length && (
                    <span className="text-[0.78rem] text-ink-faint">+{bucket.course_count - bucket.sample_courses.length} more</span>
                  )}
                </div>
              )}
              {bucket.requirement_mode === "credits_pool" && bucket.sample_courses.length === 0 && (
                <p className="text-[0.83rem] text-ink-faint">from eligible biz courses</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Program column ───────────────────────────────────────────────── */
function ProgramColumn({ program, index }: { program: ProgramBucketTree; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="flex flex-col min-w-[180px] max-w-[240px] w-full shrink-0"
    >
      <div className="rounded-t-lg border border-border-card border-b-0 px-2.5 py-2 bg-[linear-gradient(180deg,rgba(22,43,80,0.7),rgba(12,29,56,0.7))]">
        <span className="text-[0.67rem] font-semibold uppercase tracking-[0.18em] text-gold/60">{typeLabels[program.type] || program.type}</span>
        <h4 className="text-[1.01rem] font-bold font-[family-name:var(--font-sora)] text-white leading-snug">{program.program_label}</h4>
        <p className="text-[0.74rem] text-ink-faint">{program.buckets.length} bucket{program.buckets.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="rounded-b-lg border border-border-card border-t border-border-subtle/40 bg-surface-card/30 px-1.5 py-1.5 space-y-1 flex-1">
        {program.buckets.length === 0 ? (
          <p className="text-xs text-ink-faint text-center py-2">No requirements mapped.</p>
        ) : (
          program.buckets.map((b, i) => <BucketCard key={b.bucket_id} bucket={b} index={i} />)
        )}
      </div>
    </motion.div>
  );
}

/* ── Main step ────────────────────────────────────────────────────── */
export function RoadmapStep() {
  const { state } = useAppContext();
  const [trees, setTrees] = useState<ProgramBucketTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const programIds = [
      ...state.selectedMajors,
      ...state.selectedTracks,
      ...state.selectedMinors,
      ...UNIVERSAL_PROGRAM_IDS,
    ];
    if (programIds.length === 0) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadProgramBuckets(programIds)
      .then((data) => { if (!cancelled) setTrees(data); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Could not load program data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [state.selectedMajors, state.selectedTracks, state.selectedMinors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-bad-light px-3 py-2.5 text-sm text-bad">{error}</div>;
  }

  if (trees.length === 0) {
    return <p className="text-sm text-ink-faint text-center py-6">No programs selected. Go back and pick a major.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Tutorial explainer — compact */}
      <div className="space-y-2">
        <p className="text-[0.98rem] text-ink-secondary leading-relaxed">
          Your degree is split into <strong className="text-ink-primary">buckets</strong> &mdash; groups of classes you need to clear.
          Each column below is a program (your major, tracks, and the cores everyone shares).
        </p>

        {/* Color key */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[1.01rem]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            <span className="text-gold font-semibold">Required</span>
            <span className="text-ink-faint">&mdash; take all</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B9BD5]" />
            <span className="text-[#8ec8ff] font-semibold">Choose N</span>
            <span className="text-ink-faint">&mdash; pick from a list</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-faint/60" />
            <span className="text-ink-muted font-semibold">Pool</span>
            <span className="text-ink-faint">&mdash; earn credits</span>
          </span>
        </div>

        <p className="text-[1.01rem] text-ink-faint">
          Some courses fill more than one bucket. MarqBot handles the double-count rules for you.
        </p>
      </div>

      {/* Columns board — horizontal scroll */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-2.5 items-start" style={{ minWidth: "min-content" }}>
          {trees.map((program, i) => (
            <ProgramColumn key={program.program_id} program={program} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
