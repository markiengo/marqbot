"use client";

import { AnimatePresence } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { PasteFallback } from "@/components/shared/PasteFallback";
import { Button } from "@/components/shared/Button";
import { Chip } from "@/components/shared/Chip";
import { MAX_MAJORS } from "@/lib/constants";

interface InputSidebarProps {
  onSubmit: () => void;
  loading: boolean;
}

export function InputSidebar({ onSubmit, loading }: InputSidebarProps) {
  const { state, dispatch } = useAppContext();

  const courseNameMap = new Map(
    state.courses.map((c) => [c.course_code, c.course_name]),
  );

  const majors = state.programs.majors;
  const tracks = state.programs.tracks;
  const selectedMajorIds = [...state.selectedMajors];
  const availableTracks = tracks.filter((t) =>
    selectedMajorIds.some((mId) => t.parent_major_id === mId || t.id.startsWith(mId)),
  );

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-1">
      <h3 className="text-sm font-semibold text-ink-secondary uppercase tracking-wider">
        Your Profile
      </h3>

      {/* Majors */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          Majors
        </label>
        <div className="flex flex-wrap gap-1.5 min-h-[24px]">
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
          resolveLabel={(code) => courseNameMap.get(code) || code}
        />
        <PasteFallback
          courses={state.courses}
          onAdd={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
          label="Paste list"
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
          resolveLabel={(code) => courseNameMap.get(code) || code}
        />
        <PasteFallback
          courses={state.courses}
          onAdd={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
          label="Paste list"
        />
      </div>

      {/* Submit */}
      <Button
        variant="gold"
        size="md"
        onClick={onSubmit}
        disabled={loading || selectedMajorIds.length === 0}
        className="w-full"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
            Loading...
          </span>
        ) : (
          "Get Recommendations"
        )}
      </Button>
      {selectedMajorIds.length === 0 && (
        <p className="text-xs text-ink-faint text-center">
          Select a major above to get started
        </p>
      )}
    </div>
  );
}
