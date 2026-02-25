import type { CreditKpiMetrics } from "@/lib/types";

interface KpiCardsProps {
  metrics: CreditKpiMetrics;
}

export function KpiCards({ metrics }: KpiCardsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-ok-light rounded-xl p-3 text-center">
          <div className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ok">
            {metrics.completedCredits}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">Completed</div>
        </div>
        <div className="bg-warn-light rounded-xl p-3 text-center">
          <div className="text-2xl font-bold font-[family-name:var(--font-sora)] text-warn">
            {metrics.inProgressCredits}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">In Progress</div>
        </div>
        <div className="bg-surface-hover rounded-xl p-3 text-center">
          <div className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-secondary">
            {metrics.remainingCredits}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">Remaining</div>
        </div>
      </div>
      <div className="bg-gold/10 rounded-xl p-3 text-center">
        <div className="text-sm font-semibold text-gold">
          {metrics.standingLabel}
        </div>
      </div>
    </div>
  );
}
