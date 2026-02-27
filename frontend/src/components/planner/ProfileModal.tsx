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
          <p className="text-xs font-semibold text-gold leading-tight mb-3">
            Edit your current profile or explore what-if scenarios with different majors.
          </p>
          <InputSidebar hideHeader />
        </div>

        {/* Right: Preferences + Get Recs */}
        <div className="md:w-[280px] shrink-0">
          <PreferencesPanel onSubmit={() => { fetchRecommendations(); onClose(); }} loading={loading} />
        </div>
      </div>
    </Modal>
  );
}
