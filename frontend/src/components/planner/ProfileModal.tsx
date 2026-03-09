"use client";

import { Modal } from "@/components/shared/Modal";
import { InputSidebar } from "./InputSidebar";
import { PreferencesPanel } from "./PreferencesPanel";
import type { RecommendationResponse } from "@/lib/types";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  onSubmitRecommendations: () => Promise<RecommendationResponse | null>;
}

export function ProfileModal({
  open,
  onClose,
  loading,
  error,
  onSubmitRecommendations,
}: ProfileModalProps) {
  const handleSubmit = async () => {
    const result = await onSubmitRecommendations();
    if (result) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="planner-detail" title="Profile and Planner Settings">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Profile */}
        <div className="flex-1 min-w-0">
          <p className="section-kicker mb-3">
            Edit your current profile or test a different program mix without leaving the planner.
          </p>
          <InputSidebar hideHeader />
        </div>

        {/* Vertical divider (desktop) / horizontal (mobile) */}
        <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-transparent via-gold/20 to-transparent" />
        <div className="md:hidden divider-fade" />

        {/* Right: Preferences + Get Recs */}
        <div className="md:w-[280px] shrink-0">
          <PreferencesPanel onSubmit={handleSubmit} loading={loading} error={error} />
        </div>
      </div>
    </Modal>
  );
}
