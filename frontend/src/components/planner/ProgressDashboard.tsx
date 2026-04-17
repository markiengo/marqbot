"use client";

import { memo, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  useCatalogContext,
  useCourseHistoryContext,
  useRecommendationContext,
} from "@/context/AppContext";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { Modal } from "@/components/shared/Modal";
import {
  buildCourseCreditMap,
  sumCreditsForCourseCodes,
  computeCreditKpiMetrics,
} from "@/lib/rendering";
import { getCurrentCourseLists } from "@/lib/progressSources";
import type { CreditKpiMetrics } from "@/lib/types";

interface ProgressDashboardProps {
  compact?: boolean;
  showAssumptions?: boolean;
  onViewDetails?: () => void;
  onCompletedClick?: () => void;
  onInProgressClick?: () => void;
}

export function useProgressMetrics(showAssumptions = false): CreditKpiMetrics {
  const { courses } = useCatalogContext();
  const { completed, inProgress } = useCourseHistoryContext();
  const { lastRecommendationData } = useRecommendationContext();
  const creditMap = useMemo(() => buildCourseCreditMap(courses), [courses]);

  return useMemo(() => {
    const { completed: completedSource, inProgress: inProgressSource } = getCurrentCourseLists(
      lastRecommendationData,
      completed,
      inProgress,
    );

    const completedCredits = sumCreditsForCourseCodes(showAssumptions ? completedSource : completed, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(showAssumptions ? inProgressSource : inProgress, creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [creditMap, completed, inProgress, lastRecommendationData, showAssumptions]);
}

function standingTone(standingLabel: string): {
  valueClass: string;
  borderClass: string;
  glowClass: string;
} {
  const normalized = String(standingLabel || "").toLowerCase();
  if (normalized.includes("senior")) {
    return {
      valueClass: "text-[#ff9f7a]",
      borderClass: "border-l-[#ff9f7a]/55",
      glowClass: "shadow-[0_0_18px_rgba(255,159,122,0.12)]",
    };
  }
  if (normalized.includes("junior")) {
    return {
      valueClass: "text-gold",
      borderClass: "border-l-gold/50",
      glowClass: "kpi-glow-gold",
    };
  }
  if (normalized.includes("sophomore")) {
    return {
      valueClass: "text-ok",
      borderClass: "border-l-ok/50",
      glowClass: "kpi-glow-ok",
    };
  }
  return {
    valueClass: "text-[#8ec8ff]",
    borderClass: "border-l-[#8ec8ff]/55",
    glowClass: "shadow-[0_0_18px_rgba(142,200,255,0.12)]",
  };
}

function ProgressDashboardInner({
  compact = false,
  showAssumptions = false,
  onViewDetails,
  onCompletedClick,
  onInProgressClick,
}: ProgressDashboardProps) {
  const { completed, inProgress } = useCourseHistoryContext();
  const metrics = useProgressMetrics(showAssumptions);
  const hasData = completed.size > 0 || inProgress.size > 0;
  const standingStyle = standingTone(metrics.standingLabel);
  const [standingGuideOpen, setStandingGuideOpen] = useState(false);

  if (compact) {
    return (
      <>
        <div className="grid grid-cols-4 gap-3">
          <KpiTile
            value={metrics.completedCredits}
            label="Credits Completed"
            accentColor="border-l-ok"
            valueClass="text-ok"
            glowClass="kpi-glow-ok"
            delay={0.05}
            onClick={onCompletedClick}
            tileClassName="min-h-[110px]"
          />
          <KpiTile
            value={metrics.inProgressCredits}
            label="Credits In Progress"
            accentColor="border-l-gold"
            valueClass="text-gold"
            glowClass="kpi-glow-gold"
            delay={0.1}
            onClick={onInProgressClick}
            tileClassName="min-h-[110px]"
          />
          <StandingTile
            label={metrics.standingLabel}
            valueClass={standingStyle.valueClass}
            borderClass={standingStyle.borderClass}
            glowClass={standingStyle.glowClass}
            onOpenGuide={() => setStandingGuideOpen(true)}
            tileClassName="min-h-[110px]"
          />
          <KpiTile
            value={metrics.remainingCredits}
            label="Credits Remaining"
            accentColor="border-l-bad"
            valueClass="text-bad"
            glowClass="kpi-glow-bad"
            delay={0.2}
            tileClassName="min-h-[110px]"
          />
        </div>
        <Modal
          open={standingGuideOpen}
          onClose={() => setStandingGuideOpen(false)}
          title="Standing by Credits"
        >
          <div className="space-y-3">
            <p className="text-sm text-ink-faint">Based on completed credits.</p>
            <div className="space-y-2">
              <StandingGuideRow range="0-23" label="Freshman" valueClass="text-[#8ec8ff]" />
              <StandingGuideRow range="24-59" label="Sophomore" valueClass="text-ok" />
              <StandingGuideRow range="60-89" label="Junior" valueClass="text-gold" />
              <StandingGuideRow range="90+" label="Senior" valueClass="text-[#ff9f7a]" />
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="lg:h-full lg:min-h-0 min-h-[17.25rem] rounded-2xl glass-card gradient-border p-2.5 sm:p-3 flex flex-col gap-1.5 relative overflow-hidden">
      {/* Atmospheric glow overlay */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 50% at 80% 15%, rgba(30, 159, 97, 0.06), transparent), radial-gradient(ellipse 50% 40% at 15% 85%, rgba(255, 204, 0, 0.05), transparent)"
      }} />

      <div className="relative z-[1] flex flex-1 min-h-0 flex-col gap-2">
        <p className="section-kicker !text-[0.55rem] !tracking-[0.12em] gap-1.5 before:w-3">
          Planning tool. Not official advising. Check with your advisor and CheckMarq.
        </p>

        <div className="flex items-start justify-between gap-3">
          <h3 className="pr-2 text-[0.95rem] md:text-[1.05rem] font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
            Current Degree Progress
          </h3>
          {hasData && (
            <button
              type="button"
              onClick={onViewDetails}
              className="text-xs font-semibold text-gold bg-gold/8 border border-gold/20 rounded-lg px-2.5 py-1 hover:bg-gold/15 hover:border-gold/35 transition-all cursor-pointer"
            >
                  View details
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5 auto-rows-fr">
          <KpiTile
            value={metrics.completedCredits}
            label="Credits Completed"
            accentColor="border-l-ok"
            valueClass="text-ok"
            glowClass="kpi-glow-ok"
            delay={0.05}
            onClick={onCompletedClick}
          />
          <KpiTile
            value={metrics.inProgressCredits}
            label="Credits In Progress"
            accentColor="border-l-gold"
            valueClass="text-gold"
            glowClass="kpi-glow-gold"
            delay={0.1}
            onClick={onInProgressClick}
          />

          <StandingTile
            label={metrics.standingLabel}
            valueClass={standingStyle.valueClass}
            borderClass={standingStyle.borderClass}
            glowClass={standingStyle.glowClass}
            onOpenGuide={() => setStandingGuideOpen(true)}
          />

          <KpiTile
            value={metrics.remainingCredits}
            label="Credits Remaining"
            accentColor="border-l-bad"
            valueClass="text-bad"
            glowClass="kpi-glow-bad"
            delay={0.2}
          />
        </div>
      </div>

      <Modal
        open={standingGuideOpen}
        onClose={() => setStandingGuideOpen(false)}
        title="Standing by Credits"
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-faint">Based on completed credits.</p>
          <div className="space-y-2">
            <StandingGuideRow range="0-23" label="Freshman" valueClass="text-[#8ec8ff]" />
            <StandingGuideRow range="24-59" label="Sophomore" valueClass="text-ok" />
            <StandingGuideRow range="60-89" label="Junior" valueClass="text-gold" />
            <StandingGuideRow range="90+" label="Senior" valueClass="text-[#ff9f7a]" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export const ProgressDashboard = memo(ProgressDashboardInner);
ProgressDashboard.displayName = "ProgressDashboard";

function KpiTile({
  value,
  label,
  accentColor,
  valueClass,
  glowClass = "",
  delay = 0,
  onClick,
  tileClassName = "",
}: {
  value: number;
  label: string;
  accentColor: string;
  valueClass: string;
  glowClass?: string;
  delay?: number;
  onClick?: () => void;
  tileClassName?: string;
}) {
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.03 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.3, delay }}
      className={`rounded-xl glass-card stat-card-decor ${glowClass} p-3 sm:p-4 text-center min-h-0 flex flex-col items-center justify-center border-l-2 ${accentColor} ${onClick ? "cursor-pointer" : ""} ${tileClassName}`}
      aria-label={onClick ? `View ${label} courses` : undefined}
    >
      <div
        className={`text-2xl sm:text-3xl font-bold font-[family-name:var(--font-sora)] leading-none tabular-nums ${valueClass}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <AnimatedNumber value={value} />
      </div>
      <div className="text-[11px] text-ink-secondary mt-1.5 leading-tight">{label}</div>
    </Tag>
  );
}

function StandingTile({
  label,
  valueClass,
  borderClass,
  glowClass,
  onOpenGuide,
  tileClassName = "",
}: {
  label: string;
  valueClass: string;
  borderClass: string;
  glowClass: string;
  onOpenGuide: () => void;
  tileClassName?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpenGuide}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className={`rounded-xl glass-card stat-card-decor p-3 sm:p-4 flex flex-col items-center justify-center border-l-2 ${borderClass} ${glowClass} cursor-pointer ${tileClassName}`}
      aria-label="View standing scale"
    >
      <div className={`text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] leading-none text-center ${valueClass}`}>
        {label}
      </div>
      <p className="text-ink-muted mt-1 text-[11px]">Standing</p>
    </motion.button>
  );
}

function StandingGuideRow({
  range,
  label,
  valueClass,
}: {
  range: string;
  label: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2">
      <span className={`font-semibold ${valueClass}`}>{label}</span>
      <span className="text-sm text-ink-faint">{range} credits</span>
    </div>
  );
}
