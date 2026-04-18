"use client";

import { Modal } from "@/components/shared/Modal";
import { PlannerActionFrame } from "./PlannerActionFrame";
import { RankingLeaderboardExplainer } from "./RankingLeaderboardExplainer";
import type { SchedulingStyle } from "@/lib/schedulingStyle";

interface PlannerPrioritiesModalProps {
  open: boolean;
  onClose: () => void;
  currentStyle: SchedulingStyle;
  appliedStyle: SchedulingStyle;
  onStyleChange: (style: SchedulingStyle) => void;
  onApply: () => void;
  isApplying?: boolean;
}

export function PlannerPrioritiesModal({
  open,
  onClose,
  currentStyle,
  appliedStyle,
  onStyleChange,
  onApply,
  isApplying = false,
}: PlannerPrioritiesModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Your Priorities"
      titleClassName="!text-[clamp(1.1rem,2.2vw,1.5rem)] font-semibold font-[family-name:var(--font-sora)] text-gold"
      size="planner-detail"
    >
      <PlannerActionFrame>
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-8 py-5">
            <RankingLeaderboardExplainer
              currentStyle={currentStyle}
              onStyleChange={onStyleChange}
              appliedStyle={appliedStyle}
              onApply={() => onApply()}
              isApplying={isApplying}
            />
          </div>
        </div>
      </PlannerActionFrame>
    </Modal>
  );
}
