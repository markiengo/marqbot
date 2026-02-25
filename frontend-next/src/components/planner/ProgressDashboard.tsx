"use client";

import { useMemo } from "react";
import { useAppContext } from "@/context/AppContext";
import { ProgressRing } from "./ProgressRing";
import { KpiCards } from "./KpiCards";
import {
  buildCourseCreditMap,
  sumCreditsForCourseCodes,
  computeCreditKpiMetrics,
} from "@/lib/rendering";

export function ProgressDashboard() {
  const { state } = useAppContext();

  const metrics = useMemo(() => {
    const creditMap = buildCourseCreditMap(state.courses);
    const completedCredits = sumCreditsForCourseCodes(state.completed, creditMap);
    const inProgressCredits = sumCreditsForCourseCodes(state.inProgress, creditMap);
    return computeCreditKpiMetrics(completedCredits, inProgressCredits);
  }, [state.courses, state.completed, state.inProgress]);

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-ink-secondary uppercase tracking-wider">
        Your Progress
      </h3>

      <div className="flex justify-center">
        <ProgressRing
          pct={metrics.donePercent}
          inProgressPct={metrics.inProgressPercent}
          displayPct={metrics.overallPercent}
          size={130}
          stroke={12}
        />
      </div>

      <KpiCards metrics={metrics} />
    </div>
  );
}
