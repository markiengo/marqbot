"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { BucketProgress } from "@/lib/types";
import type { ProgressSectionWithGroups } from "@/lib/rendering";
import { BucketProgressGrid } from "./BucketProgressGrid";

interface BucketSectionTabsProps {
  sections: ProgressSectionWithGroups[];
  programLabelMap?: Map<string, string>;
  animate?: boolean;
  onBucketClick?: (bucket: {
    bucketId: string;
    bucketLabel: string;
    progress: BucketProgress;
    triggerEl: HTMLButtonElement;
  }) => void;
  /** Unique layout group id to avoid conflicts when multiple instances exist */
  layoutId?: string;
}

export function BucketSectionTabs({
  sections,
  programLabelMap,
  animate = true,
  onBucketClick,
  layoutId = "bucket-section-tabs",
}: BucketSectionTabsProps) {
  const [activeKey, setActiveKey] = useState(sections[0]?.sectionKey ?? "");

  const activeSection = sections.find((s) => s.sectionKey === activeKey) ?? sections[0];
  if (!activeSection || sections.length === 0) return null;

  // Single section — skip tabs entirely
  if (sections.length === 1) {
    return (
      <SectionContent
        section={sections[0]}
        programLabelMap={programLabelMap}
        animate={animate}
        onBucketClick={onBucketClick}
      />
    );
  }

  return (
    <div className="space-y-3">
      <LayoutGroup id={layoutId}>
        <div className="flex gap-0.5 overflow-x-auto border-b border-border-subtle/50 scrollbar-none">
          {sections.map((section) => (
            <button
              key={section.sectionKey}
              type="button"
              onClick={() => setActiveKey(section.sectionKey)}
              className={`relative shrink-0 cursor-pointer px-3 py-2 text-[0.78rem] font-semibold transition-colors ${
                activeSection.sectionKey === section.sectionKey
                  ? "text-gold"
                  : "text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {section.label}
              {activeSection.sectionKey === section.sectionKey && (
                <motion.div
                  layoutId={`${layoutId}-indicator`}
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </LayoutGroup>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeSection.sectionKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          <SectionContent
            section={activeSection}
            programLabelMap={programLabelMap}
            animate={animate}
            onBucketClick={onBucketClick}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SectionContent({
  section,
  programLabelMap,
  animate,
  onBucketClick,
}: {
  section: ProgressSectionWithGroups;
  programLabelMap?: Map<string, string>;
  animate?: boolean;
  onBucketClick?: BucketSectionTabsProps["onBucketClick"];
}) {
  if (section.subGroups) {
    return (
      <div className="space-y-3">
        {section.subGroups.map((group) => (
          <div key={group.parentId} className="space-y-1.5">
            <p className="pl-0.5 text-[0.72rem] font-semibold uppercase tracking-wider text-ink-secondary">
              {group.label}
            </p>
            <BucketProgressGrid
              entries={group.entries}
              programLabelMap={programLabelMap}
              animate={animate}
              stripParentPrefix
              onBucketClick={onBucketClick}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <BucketProgressGrid
      entries={section.entries}
      programLabelMap={programLabelMap}
      animate={animate}
      onBucketClick={onBucketClick}
    />
  );
}
