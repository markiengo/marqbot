"use client";

import { AnimatePresence } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { Chip } from "@/components/shared/Chip";
import { MAX_MAJORS } from "@/lib/constants";

export function InputSidebar() {
  const { state, dispatch } = useAppContext();

  const majors = state.programs.majors;
  const tracks = state.programs.tracks;
  const selectedMajorIds = [...state.selectedMajors];
  const availableTracks = tracks.filter((t) =>
    selectedMajorIds.some((mId) => t.parent_major_id === mId || t.id.startsWith(mId)),
  );

  return (
    <div className="space-y-5 h-full overflow-y-auto overflow-x-hidden pr-1">
      <div>
        <p className="text-xs font-semibold text-gold leading-tight">
          Fill in exactly as your transcript for the most accurate results.
        </p>
        <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-sora)] text-white mt-2 leading-tight">
          Your Profile
        </h3>
      </div>

      {/* Majors */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          Majors
        </label>
        <div className="flex flex-wrap gap-1.5 min-h-[24px] min-w-0">
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
        {selectedMajorIds.length < MAX_MAJORS && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                dispatch({ type: "ADD_MAJOR", payload: e.target.value });
                e.target.value = "";
              }
            }}
            defaultValue=""
            className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            <option value="">Add major...</option>
            {majors
              .filter((m) => !state.selectedMajors.has(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Track */}
      {availableTracks.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
            Track
          </label>
          <select
            value={state.selectedTrack || ""}
            onChange={(e) =>
              dispatch({
                type: "SET_TRACK",
                payload: e.target.value || null,
              })
            }
            className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            <option value="">Default</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Completed */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          Completed ({state.completed.size})
        </label>
        <MultiSelect
          courses={state.courses}
          selected={state.completed}
          otherSet={state.inProgress}
          onAdd={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
          onRemove={(code) => dispatch({ type: "REMOVE_COMPLETED", payload: code })}
          placeholder="Add completed..."
          resolveLabel={(code) => code}
        />
      </div>

      {/* In Progress */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          In Progress ({state.inProgress.size})
        </label>
        <MultiSelect
          courses={state.courses}
          selected={state.inProgress}
          otherSet={state.completed}
          onAdd={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
          onRemove={(code) => dispatch({ type: "REMOVE_IN_PROGRESS", payload: code })}
          placeholder="Add in-progress..."
          resolveLabel={(code) => code}
        />
      </div>
    </div>
  );
}
