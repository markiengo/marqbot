"use client";

import { motion } from "motion/react";
import { SCHEDULING_STYLE_OPTIONS } from "@/lib/schedulingStyle";
import type { SchedulingStyle } from "@/lib/schedulingStyle";

interface BuildExplainerContentProps {
  currentStyle: SchedulingStyle;
  onSelect: (style: SchedulingStyle) => void;
}

const styleAccents: Record<SchedulingStyle, { gradient: string; glow: string }> = {
  grinder: {
    gradient: "from-gold/20 via-gold/6 to-transparent",
    glow: "shadow-[0_0_28px_rgba(255,204,0,0.18)]",
  },
  explorer: {
    gradient: "from-[#5B9BD5]/20 via-[#5B9BD5]/6 to-transparent",
    glow: "shadow-[0_0_28px_rgba(91,155,213,0.18)]",
  },
  mixer: {
    gradient: "from-[#9b7edb]/20 via-[#9b7edb]/6 to-transparent",
    glow: "shadow-[0_0_28px_rgba(155,126,219,0.18)]",
  },
};

export function BuildExplainerContent({ currentStyle, onSelect }: BuildExplainerContentProps) {
  return (
    <div className="space-y-5">
      {/* How it works callout */}
      <div className="rounded-2xl border border-gold/20 bg-[linear-gradient(135deg,rgba(255,204,0,0.10),rgba(255,204,0,0.02))] px-5 py-4">
        <p className="text-[0.97rem] leading-relaxed text-ink-primary">
          Your build controls what MarqBot recommends first. Prerequisites still run the show &mdash; no build can skip them.
          This is a <strong className="text-gold">priority setting</strong>, not a difficulty setting.
        </p>
      </div>

      {/* Style cards */}
      <div className="grid gap-3">
        {SCHEDULING_STYLE_OPTIONS.map((style, idx) => {
          const isActive = currentStyle === style.value;
          const accent = styleAccents[style.value];

          return (
            <motion.button
              key={style.value}
              type="button"
              onClick={() => onSelect(style.value)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className={[
                "w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 cursor-pointer",
                "relative overflow-hidden",
                isActive
                  ? `border-gold/50 ${accent.glow}`
                  : "border-border-card hover:border-gold/25",
              ].join(" ")}
            >
              {/* Background gradient wash */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${accent.gradient} pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
                style={{ opacity: isActive ? 1 : 0, transition: "opacity 0.2s" }}
                aria-hidden
              />

              <div className="relative flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    {/* Radio dot */}
                    <div className={`h-3 w-3 shrink-0 rounded-full border-2 transition-all ${
                      isActive
                        ? "border-gold bg-gold shadow-[0_0_8px_rgba(255,204,0,0.5)]"
                        : "border-ink-muted/40 bg-transparent"
                    }`} />
                    <h4 className={`text-[1.15rem] font-bold font-[family-name:var(--font-sora)] ${
                      isActive ? "text-gold" : "text-white"
                    }`}>
                      {style.label}
                    </h4>
                    {style.isDefault && (
                      <span className="rounded-full border border-gold/30 bg-gold/8 px-2 py-0.5 text-[0.68rem] font-semibold text-gold/80">
                        default
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[0.92rem] leading-relaxed text-ink-secondary">
                    {style.detail}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-[0.88rem] text-ink-muted leading-relaxed">
        Switch anytime. Your transcript stays the same &mdash; only the recommendation order changes.
      </p>
    </div>
  );
}
