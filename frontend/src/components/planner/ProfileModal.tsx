"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { PlannerActionFrame } from "./PlannerActionFrame";
import { ProfileProgramTab } from "./ProfileProgramTab";
import { ProfileCoursesTab } from "./ProfileCoursesTab";
import { ProfilePreferencesTab } from "./ProfilePreferencesTab";
import type { RecommendationResponse } from "@/lib/types";

const TABS = [
  { key: "program" as const, label: "Program" },
  { key: "courses" as const, label: "Courses" },
  { key: "preferences" as const, label: "Preferences" },
];

type TabKey = (typeof TABS)[number]["key"];

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
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabKey>("program");
  const [direction, setDirection] = useState<1 | -1>(1);
  const hasProgram = state.selectedMajors.size > 0 || state.selectedTracks.length > 0;

  const activeIdx = TABS.findIndex((t) => t.key === activeTab);

  const handleTabChange = (key: TabKey) => {
    const nextIdx = TABS.findIndex((t) => t.key === key);
    setDirection(nextIdx >= activeIdx ? 1 : -1);
    setActiveTab(key);
  };

  const handleSubmit = async () => {
    const result = await onSubmitRecommendations();
    if (result) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="planner-detail"
      title="Edit Profile"
      titleClassName="!text-[clamp(1.4rem,2.8vw,1.9rem)] font-semibold font-[family-name:var(--font-sora)] text-ink-primary"
    >
      <PlannerActionFrame>
        {/* Tab bar */}
        <LayoutGroup>
          <div className="flex gap-1 border-b border-border-subtle px-8">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`relative cursor-pointer px-4 py-3 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "text-gold"
                    : "text-ink-muted hover:text-ink-secondary"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="profile-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </LayoutGroup>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          {/* Courses tab stays mounted (hidden when inactive) to preserve import state */}
          <ProfileCoursesTab active={activeTab === "courses"} />

          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "program" && (
              <motion.div
                key="program"
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
              >
                <ProfileProgramTab />
              </motion.div>
            )}
            {activeTab === "preferences" && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
              >
                <ProfilePreferencesTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-border-subtle bg-surface-card px-8 py-4">
          {error && (
            <div className="mb-3 rounded-xl border border-bad/25 bg-bad-light px-3 py-2 text-sm text-bad">
              {error}
            </div>
          )}
          <Button
            variant="gold"
            size="md"
            onClick={handleSubmit}
            disabled={loading || !hasProgram}
            className="w-full shadow-[0_0_24px_rgba(255,204,0,0.35),0_0_48px_rgba(255,204,0,0.15)]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                Running...
              </span>
            ) : (
              "Get My Plan"
            )}
          </Button>
          {!hasProgram && (
            <p className="mt-2 text-center text-sm text-ink-faint">
              Add a major or track above to get started.
            </p>
          )}
        </div>
      </PlannerActionFrame>
    </Modal>
  );
}
