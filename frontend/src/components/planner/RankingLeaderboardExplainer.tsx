"use client";

import { SCHEDULING_STYLE_OPTIONS, type SchedulingStyle } from "@/lib/schedulingStyle";

type RankingRow = {
  title: string;
  detail: string;
};

type RankingContent = {
  summary: string;
  rows: RankingRow[];
};

const styleAccent = {
  grinder: {
    badge: "border-gold/30 bg-gold/12 text-gold",
    panel: "border-gold/16 bg-[linear-gradient(180deg,rgba(33,29,15,0.96),rgba(20,18,11,0.96))]",
    number: "border-gold/20 bg-gold/14 text-gold",
    bar: "bg-[linear-gradient(90deg,#ffcc00,#ffe48a)]",
    active: "border-gold/30 shadow-[0_0_28px_rgba(255,204,0,0.14)]",
    dot: "border-gold bg-gold shadow-[0_0_8px_rgba(255,204,0,0.35)]",
  },
  explorer: {
    badge: "border-[#5B9BD5]/35 bg-[#5B9BD5]/12 text-[#8ec8ff]",
    panel: "border-[#5B9BD5]/18 bg-[linear-gradient(180deg,rgba(12,28,54,0.96),rgba(9,21,40,0.96))]",
    number: "border-[#5B9BD5]/20 bg-[#5B9BD5]/14 text-[#8ec8ff]",
    bar: "bg-[linear-gradient(90deg,#5B9BD5,#8ec8ff)]",
    active: "border-[#5B9BD5]/30 shadow-[0_0_28px_rgba(91,155,213,0.14)]",
    dot: "border-[#8ec8ff] bg-[#8ec8ff] shadow-[0_0_8px_rgba(91,155,213,0.35)]",
  },
  mixer: {
    badge: "border-[#9b7edb]/35 bg-[#9b7edb]/12 text-[#c8b7ff]",
    panel: "border-[#9b7edb]/18 bg-[linear-gradient(180deg,rgba(23,20,41,0.96),rgba(16,14,30,0.96))]",
    number: "border-[#9b7edb]/20 bg-[#9b7edb]/14 text-[#c8b7ff]",
    bar: "bg-[linear-gradient(90deg,#9b7edb,#c8b7ff)]",
    active: "border-[#9b7edb]/30 shadow-[0_0_28px_rgba(155,126,219,0.14)]",
    dot: "border-[#c8b7ff] bg-[#c8b7ff] shadow-[0_0_8px_rgba(155,126,219,0.35)]",
  },
} satisfies Record<SchedulingStyle, { badge: string; panel: string; number: string; bar: string; active: string; dot: string }>;

const rankingContent = {
  grinder: {
    summary: "Major path first. Cleanup later.",
    rows: [
      { title: "Must-take prereq bridges", detail: "If one course unlocks the rest, it jumps to the top." },
      { title: "Urgent BCC gateways", detail: "Shared blockers like accounting and math stay early." },
      { title: "Major requirements", detail: "Declared major work comes before cleanup." },
      { title: "Track and minor requirements", detail: "Support programs come after the main major path." },
      { title: "Other BCC work", detail: "The rest of the business core follows." },
      { title: "MCC and discovery cleanup", detail: "CORE and discovery courses usually wait." },
    ],
  },
  explorer: {
    summary: "Discovery and gen-eds move up.",
    rows: [
      { title: "Must-take prereq bridges", detail: "Critical unlockers still stay first." },
      { title: "MCC foundation", detail: "Core classes stay near the front." },
      { title: "Discovery and late MCC", detail: "Exploration, writing, and culminating work rise earlier." },
      { title: "BCC work", detail: "Shared business core still gets handled on time." },
      { title: "Major requirements", detail: "Major classes stay important, but not always first." },
      { title: "Track and minor requirements", detail: "Support programs follow after the main priorities." },
    ],
  },
  mixer: {
    summary: "Keep each term balanced.",
    rows: [
      { title: "Must-take prereq bridges", detail: "Critical unlockers still jump the line." },
      { title: "MCC foundation", detail: "Core classes stay protected near the top." },
      { title: "BCC and discovery mix", detail: "MarqBot tries to keep some core and some exploration together." },
      { title: "Major requirements", detail: "Major classes stay high without taking over every slot." },
      { title: "Track and minor requirements", detail: "Support programs come next." },
      { title: "Remaining cleanup", detail: "Late core and flexible cleanup land last." },
    ],
  },
} satisfies Record<SchedulingStyle, RankingContent>;

function getStyleLabel(currentStyle: SchedulingStyle): string {
  return (
    SCHEDULING_STYLE_OPTIONS.find((option) => option.value === currentStyle)?.label
    || currentStyle
  );
}

interface RankingLeaderboardExplainerProps {
  currentStyle: SchedulingStyle;
  appliedStyle?: SchedulingStyle;
  onStyleChange?: (style: SchedulingStyle) => void;
  onApply?: (style: SchedulingStyle) => void;
  isApplying?: boolean;
}

export function RankingLeaderboardExplainer({
  currentStyle,
  appliedStyle,
  onStyleChange,
  onApply,
  isApplying = false,
}: RankingLeaderboardExplainerProps) {
  const accent = styleAccent[currentStyle];
  const content = rankingContent[currentStyle];
  const canApply = Boolean(onApply);
  const isApplied = appliedStyle === currentStyle;

  return (
    <div className="space-y-3 text-base text-ink-secondary">
      {onStyleChange && (
        <div className="space-y-3">
          <div>
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-gold-light">
              Compare builds
            </p>
            <p className="mt-1 text-[0.96rem] leading-relaxed text-slate-300">
              {canApply
                ? "Preview another build, then apply it to rerun this plan."
                : "View another build without changing your plan settings."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {SCHEDULING_STYLE_OPTIONS.map((option) => {
              const optionAccent = styleAccent[option.value];
              const isActive = option.value === currentStyle;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStyleChange(option.value)}
                  className={[
                    "relative overflow-hidden rounded-[1.05rem] border bg-[linear-gradient(180deg,rgba(18,24,39,0.94),rgba(12,17,29,0.96))] px-3 py-2.5 text-left transition-all",
                    isActive ? optionAccent.active : "border-white/10 hover:border-white/20",
                  ].join(" ")}
                >
                  <div className={`h-1 w-8 rounded-full ${optionAccent.bar}`} />
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
                        isActive
                          ? optionAccent.dot
                          : "border-white/25 bg-transparent"
                      }`}
                    />
                    <span className={`text-[1rem] font-semibold ${isActive ? "text-white" : "text-slate-200"}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[0.84rem] leading-snug text-slate-400">
                    {option.helper}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`relative overflow-hidden rounded-[1.35rem] border px-3.5 py-3 shadow-[0_16px_44px_rgba(0,0,0,0.22)] sm:px-4 ${accent.panel}`}
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 18% 18%, rgba(255,204,0,0.08), transparent 28%), radial-gradient(circle at 82% 16%, rgba(0,114,206,0.08), transparent 32%), radial-gradient(circle at 62% 100%, rgba(155,126,219,0.08), transparent 36%)",
          }}
        />

        <p className="relative text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-gold-light">
          Current build
        </p>

        <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${accent.badge}`}
          >
            {getStyleLabel(currentStyle)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-200">
            Rules-based
          </span>
        </div>

        <p className="relative mt-2.5 text-[clamp(1.28rem,2.3vw,1.85rem)] font-bold leading-[1] tracking-[-0.03em] text-white">
          {content.summary}
        </p>

        <p className="relative mt-1.5 max-w-[24rem] text-[0.95rem] leading-relaxed text-slate-300">
          First, MarqBot hides anything you cannot take yet.
        </p>

        <div className="relative mt-3 flex justify-start">
          <div className="h-px w-24 bg-[linear-gradient(90deg,rgba(255,204,0,0.92),transparent)]" />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {content.rows.map((row, idx) => (
          <article
            key={row.title}
            className="rounded-[1.05rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,39,0.94),rgba(12,17,29,0.96))] p-3 shadow-[0_14px_38px_rgba(0,0,0,0.18)]"
          >
            <div className={`h-1 w-9 rounded-full ${accent.bar}`} />
            <div className="mt-2.5 flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[0.82rem] font-bold ${accent.number}`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[1.02rem] font-semibold leading-[1.12] tracking-[-0.02em] text-white">
                  {row.title}
                </p>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-slate-300">
                  {row.detail}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-[1.15rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,28,54,0.94),rgba(10,25,47,0.96))] px-3.5 py-3 shadow-[0_14px_38px_rgba(0,0,0,0.18)] sm:px-4">
        <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[#8ec8ff]">
          Still true
        </p>
        <p className="mt-1.5 text-[0.94rem] leading-relaxed text-slate-300">
          Bridge courses and hard prereqs can jump higher when they unlock the next step.
        </p>
      </div>

      <div className="rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3.5 py-2.5 sm:px-4">
        <p className="text-[0.9rem] leading-relaxed text-slate-300">
          Want the full logic?{" "}
          <a
            href="https://github.com/markiengo/marqbot/blob/main/docs/memos/algorithm.md"
            target="_blank"
            rel="noreferrer"
            className="text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
          >
            Read the technical breakdown
          </a>
          .
        </p>
      </div>

      {onApply && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => onApply(currentStyle)}
            disabled={isApplying || isApplied}
            className={[
              "inline-flex min-w-[8rem] items-center justify-center rounded-xl border px-4 py-2.5 text-[0.92rem] font-semibold transition-all",
              isApplied
                ? "cursor-not-allowed border-white/12 bg-white/[0.05] text-slate-400"
                : `cursor-pointer ${accent.badge} shadow-[0_0_20px_rgba(255,204,0,0.10)] hover:brightness-110`,
            ].join(" ")}
          >
            {isApplying ? "Applying..." : isApplied ? "Applied" : "Apply"}
          </button>
        </div>
      )}
    </div>
  );
}
