"use client";

import { Modal } from "@/components/shared/Modal";
import { InputSidebar } from "./InputSidebar";
import { PreferencesPanel } from "./PreferencesPanel";
import { useRecommendations } from "@/hooks/useRecommendations";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { loading, fetchRecommendations } = useRecommendations();

  return (
    <Modal open={open} onClose={onClose} size="planner-detail" title="Your Profile & Preferences">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Profile */}
        <div className="flex-1 min-w-0">
          <p className="section-kicker mb-3">
            Edit your current profile or explore what-if scenarios with different majors.
          </p>
          <InputSidebar hideHeader />
        </div>

        {/* Vertical divider (desktop) / horizontal (mobile) */}
        <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-transparent via-gold/20 to-transparent" />
        <div className="md:hidden divider-fade" />

        {/* Right: Preferences + Get Recs */}
        <div className="md:w-[280px] shrink-0">
          <PreferencesPanel onSubmit={async () => { await fetchRecommendations(); onClose(); }} loading={loading} />
        </div>
      </div>
    </Modal>
  );
}
