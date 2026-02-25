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
    <div className="h-full min-h-0 rounded-2xl border border-border-subtle bg-gradient-to-br from-[#0f2a52]/70 to-[#10284a]/55 p-4 space-y-3">
      <p className="text-xs font-semibold text-white/95">
        Double-check this with your &ldquo;Graduation Checklist&rdquo; in Checkmarq
      </p>

      <h2 className="text-4xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
        Academic Progress
      </h2>

      <div className="rounded-xl border border-border-subtle bg-[#0b2143]/70 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-gold uppercase tracking-wide">
            Degree Progress
          </h3>
          {hasData && (
            <button
              type="button"
              onClick={onViewDetails}
              className="text-xs font-semibold text-ink-primary bg-navy/70 border border-border-medium rounded-xl px-3 py-1 hover:bg-navy-light transition-colors cursor-pointer"
            >
              View Full Progress
            </button>
          )}
        </div>

        <div className="flex justify-center py-1">
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
              size={96}
              stroke={9}
            />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <KpiTile value={metrics.completedCredits} label="Credits Completed" valueClass="text-ok" />
          <KpiTile value={metrics.inProgressCredits} label="Credits In Progress" valueClass="text-gold" />
          <KpiTile value={metrics.remainingCredits} label={`Credits Remaining\nto ${metrics.minGradCredits}`} valueClass="text-bad" />
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-card/40 p-5 text-center">
          <div className="text-5xl font-bold font-[family-name:var(--font-sora)] text-ink-primary leading-none">
            {metrics.standingLabel}
          </div>
          <p className="text-ink-muted mt-1 text-lg">Your Status</p>
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
  const [line1, line2] = label.split("\n");

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card/40 p-3 text-center min-h-[86px] flex flex-col items-center justify-center">
      <div className={`text-4xl font-bold font-[family-name:var(--font-sora)] leading-none ${valueClass}`}>
        {value}
      </div>
      <div className="text-base text-ink-secondary mt-1 leading-tight">
        <div>{line1}</div>
        {line2 && <div>{line2}</div>}
      </div>
    </div>
  );
}
