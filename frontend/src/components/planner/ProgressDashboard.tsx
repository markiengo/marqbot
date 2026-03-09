"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { ProgressRing } from "./ProgressRing";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import {
  buildCourseCreditMap,
  sumCreditsForCourseCodes,
  computeCreditKpiMetrics,
} from "@/lib/rendering";
import { getCurrentCourseLists } from "@/lib/progressSources";
import type { CreditKpiMetrics } from "@/lib/types";

interface ProgressDashboardProps {
  onViewDetails?: () => void;
  onCompletedClick?: () => void;
  onInProgressClick?: () => void;
}

export function useProgressMetrics(): CreditKpiMetrics {
  const { state } = useAppContext();
  return useMemo(() => {
    const creditMap = buildCourseCreditMap(state.courses);
    const response = state.lastRecommendationData;
    const { completed: completedSource, inProgress: inProgressSource } = getCurrentCourseLists(
      response,
      state.completed,
      state.inProgress,
    );

    const completedCredits = sumCreditsForCourseCodes(completedSource, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(inProgressSource, creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [state.courses, state.completed, state.inProgress, state.lastRecommendationData]);
}

export function ProgressDashboard({ onViewDetails, onCompletedClick, onInProgressClick }: ProgressDashboardProps) {
  const { state } = useAppContext();
  const metrics = useProgressMetrics();
  const hasData = state.completed.size > 0 || state.inProgress.size > 0;

  return (
    <div className="lg:h-full lg:min-h-0 rounded-2xl glass-card p-3 flex flex-col gap-1.5 relative overflow-hidden">
      {/* Atmospheric glow overlay */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 50% at 80% 15%, rgba(30, 159, 97, 0.06), transparent), radial-gradient(ellipse 50% 40% at 15% 85%, rgba(255, 204, 0, 0.05), transparent)"
      }} />

      <div className="relative z-[1] flex flex-col gap-1.5 flex-1 min-h-0">
        <p className="section-kicker">
          Planning tool. Not official advising. Check with your advisor and CheckMarq.
        </p>

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
            Degree Progress
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

        {/* Bento grid: ring left, KPIs right, standing + remaining bottom */}
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5 auto-rows-fr">
          {/* Ring - spans left column, 2 rows */}
          <motion.button
            type="button"
            className="row-span-2 flex items-center justify-center cursor-pointer rounded-xl ring-glow focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
            onClick={onViewDetails}
            aria-label="View full degree progress breakdown"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <ProgressRing
              pct={metrics.donePercent}
              inProgressPct={metrics.inProgressPercent}
              displayPct={metrics.overallPercent}
              size={100}
              stroke={9}
            />
          </motion.button>

          {/* Right column: Completed + In Progress stacked */}
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

          {/* Bottom row: Standing + Remaining */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-xl glass-card stat-card-decor kpi-glow-gold p-2 flex flex-col items-center justify-center border-l-2 border-l-gold/50"
          >
            <div className="text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-ink-primary leading-none">
              {metrics.standingLabel}
            </div>
            <p className="text-ink-muted mt-0.5 text-[11px]">Standing</p>
          </motion.div>

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
    </div>
  );
}

function KpiTile({
  value,
  label,
  accentColor,
  valueClass,
  glowClass = "",
  delay = 0,
  onClick,
}: {
  value: number;
  label: string;
  accentColor: string;
  valueClass: string;
  glowClass?: string;
  delay?: number;
  onClick?: () => void;
}) {
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.04 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.3, delay }}
      className={`rounded-xl glass-card stat-card-decor ${glowClass} p-2 sm:p-3 text-center min-h-0 flex flex-col items-center justify-center border-l-2 ${accentColor} ${onClick ? "cursor-pointer" : ""}`}
      aria-label={onClick ? `View ${label} courses` : undefined}
    >
      <div
        className={`text-xl sm:text-3xl font-bold font-[family-name:var(--font-sora)] leading-none tabular-nums ${valueClass}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <AnimatedNumber value={value} />
      </div>
      <div className="text-[11px] text-ink-secondary mt-1 leading-tight">{label}</div>
    </Tag>
  );
}
