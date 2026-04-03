"use client";

import { Modal } from "@/components/shared/Modal";
import { RoadmapStep } from "@/components/onboarding/RoadmapStep";

interface BucketMapModalProps {
  open: boolean;
  onClose: () => void;
}

export function BucketMapModal({ open, onClose }: BucketMapModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bucket Map"
      titleClassName="!text-[clamp(1.2rem,2.6vw,1.65rem)] font-bold font-[family-name:var(--font-sora)] text-gold"
      size="planner-detail"
    >
      <RoadmapStep />
    </Modal>
  );
}
