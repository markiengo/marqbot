"use client";

import { useAppContext } from "@/context/AppContext";
import { Chip } from "@/components/shared/Chip";
import { MAX_MAJORS } from "@/lib/constants";
import { AnimatePresence } from "motion/react";

export function MajorStep() {
  const { state, dispatch } = useAppContext();
  const majors = state.programs.majors;
  const tracks = state.programs.tracks;

  const selectedMajorIds = [...state.selectedMajors];
  const atLimit = selectedMajorIds.length >= MAX_MAJORS;

  // Determine available tracks for selected majors
  const availableTracks = tracks.filter((t) =>
    selectedMajorIds.some((mId) => t.parent_major_id === mId || t.id.startsWith(mId)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          What&apos;s your major?
        </h2>
        <p className="text-sm text-ink-muted mt-1">
          Select up to {MAX_MAJORS} majors. This determines which requirement
          buckets we track.
        </p>
      </div>

      {/* Selected chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        <AnimatePresence mode="popLayout">
          {selectedMajorIds.map((id) => {
            const label = majors.find((m) => m.id === id)?.label || id;
            return (
              <Chip
                key={id}
                label={label}
                variant="navy"
                onRemove={() => dispatch({ type: "REMOVE_MAJOR", payload: id })}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Major grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {majors.map((m) => {
          const isSelected = state.selectedMajors.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (isSelected) {
                  dispatch({ type: "REMOVE_MAJOR", payload: m.id });
                } else if (!atLimit) {
                  dispatch({ type: "ADD_MAJOR", payload: m.id });
                }
              }}
              disabled={!isSelected && atLimit}
              className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected
                  ? "bg-gold text-navy-dark shadow-sm"
                  : "bg-surface-card text-ink-secondary hover:bg-surface-hover border border-border-subtle"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Track selector */}
      {availableTracks.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-ink-secondary">
            Select a track (optional)
          </label>
          <select
            value={state.selectedTrack || ""}
            onChange={(e) =>
              dispatch({ type: "SET_TRACK", payload: e.target.value || null })
            }
            className="w-full px-3 py-2.5 bg-surface-input border border-border-medium rounded-xl text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            <option value="">Default track</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
