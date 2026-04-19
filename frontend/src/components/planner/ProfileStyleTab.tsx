"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { RankingLeaderboardExplainer } from "./RankingLeaderboardExplainer";
import type { SchedulingStyle } from "@/lib/schedulingStyle";

export function ProfileStyleTab() {
  const { state, dispatch } = useAppContext();
  const [localStyle, setLocalStyle] = useState<SchedulingStyle>(state.schedulingStyle);
  const syncLocalStyle = useEffectEvent((style: SchedulingStyle) => {
    setLocalStyle(style);
  });

  useEffect(() => {
    syncLocalStyle(state.schedulingStyle);
  }, [state.schedulingStyle]);

  const handleStyleChange = (style: SchedulingStyle) => {
    setLocalStyle(style);
  };

  const handleStyleApply = (style: SchedulingStyle) => {
    if (style === state.schedulingStyle) return;
    dispatch({ type: "SET_SCHEDULING_STYLE", payload: style });
  };

  return (
    <div className="space-y-4">
      <p className="text-[0.95rem] leading-relaxed text-ink-secondary">
        Pick a build style, preview it here, then click <strong className="text-ink-secondary font-semibold">Apply</strong> when you want the planner to use it.
      </p>
      <RankingLeaderboardExplainer
        currentStyle={localStyle}
        onStyleChange={handleStyleChange}
        onApply={handleStyleApply}
        appliedStyle={state.schedulingStyle}
      />
    </div>
  );
}
