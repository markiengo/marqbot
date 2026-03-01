"use client";

import { useMemo } from "react";
import { useAppContext } from "@/context/AppContext";
import { ProgressRing } from "./ProgressRing";
import {
  buildCourseCreditMap,
  sumCreditsForCourseCodes,
  computeCreditKpiMetrics,
} from "@/lib/rendering";
import type { CreditKpiMetrics } from "@/lib/types";

interface ProgressDashboardProps {
  onViewDetails?: () => void;
}

export function useProgressMetrics(): CreditKpiMetrics {
  const { state } = useAppContext();
  return useMemo(() => {
    const creditMap = buildCourseCreditMap(state.courses);
    const completedCredits = sumCreditsForCourseCodes(state.completed, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(state.inProgress, creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [state.courses, state.completed, state.inProgress]);
}

export function ProgressDashboard({ onViewDetails }: ProgressDashboardProps) {
  const { state } = useAppContext();
  const metrics = useProgressMetrics();
  const hasData = state.completed.size > 0 || state.inProgress.size > 0;

  return (
    <div className="h-full min-h-0 rounded-2xl border border-border-subtle bg-[#0b2143]/70 p-3 flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-gold leading-tight">
        Always double-check with your advisor and Checkmarq.
      </p>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
          Degree Progress
        </h3>
        {hasData && (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-xs font-semibold text-ink-primary bg-navy/70 border border-border-medium rounded-lg px-2.5 py-1 hover:bg-navy-light transition-colors cursor-pointer"
          >
            View Full Progress
          </button>
        )}
      </div>

      <div className="flex justify-center py-0.5">
        <button
          type="button"
          onClick={onViewDetails}
          className="cursor-pointer"
          aria-label="View progress details"
        >
          <ProgressRing
            pct={metrics.donePercent}
            inProgressPct={metrics.inProgressPercent}
            displayPct={metrics.overallPercent}
            size={90}
            stroke={8}
          />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2.5 pb-1">
        <div className="grid grid-cols-3 gap-3 flex-[1.4] min-h-0">
          <KpiTile value={metrics.completedCredits} label="Credits Completed" valueClass="text-ok" />
          <KpiTile value={metrics.inProgressCredits} label="Credits In Progress" valueClass="text-gold" />
          <KpiTile value={metrics.remainingCredits} label="Credits Remaining" valueClass="text-bad" />
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-card/40 p-2 text-center flex-[0.6] min-h-[60px] max-h-[100px] flex flex-col justify-center accent-top-gold">
          <div className="text-xl md:text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary leading-none">
            {metrics.standingLabel}
          </div>
          <p className="text-ink-muted mt-0.5 text-xs">Your Status</p>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  value,
  label,
  valueClass,
}: {
  value: number;
  label: string;
  valueClass: string;
}) {
  return (
    <div className="h-full rounded-lg border border-border-subtle bg-surface-card/40 p-3 text-center min-h-0 flex flex-col items-center justify-center">
      <div className={`text-3xl font-bold font-[family-name:var(--font-sora)] leading-none ${valueClass}`}>
        {value}
      </div>
      <div className="text-xs text-ink-secondary mt-1 leading-tight">{label}</div>
    </div>
  );
}
