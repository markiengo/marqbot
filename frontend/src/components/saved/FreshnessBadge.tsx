"use client";

import type { SavedPlanFreshness } from "@/lib/types";

const badgeClasses: Record<SavedPlanFreshness, string> = {
  fresh: "bg-ok-light/70 text-ok border border-ok/25",
  stale: "bg-warn-light/70 text-warn border border-warn/25",
  missing: "bg-surface-card text-ink-faint border border-border-subtle",
};

const badgeLabels: Record<SavedPlanFreshness, string> = {
  fresh: "Current",
  stale: "Inputs changed",
  missing: "Snapshot missing",
};

export function FreshnessBadge({ freshness }: { freshness: SavedPlanFreshness }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses[freshness]}`}>
      {badgeLabels[freshness]}
    </span>
  );
}
