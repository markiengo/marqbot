"use client";

import { useState, useRef, useEffect, useId, useMemo, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { Chip } from "@/components/shared/Chip";
import {
  MAX_MAJORS,
  MAX_MINORS,
  AIM_CFA_TRACK_ID,
  AIM_CFA_FINANCE_RULE_MSG,
  FIN_MAJOR_ID,
} from "@/lib/constants";

interface InputSidebarProps {
  hideHeader?: boolean;
}

export function InputSidebar({ hideHeader }: InputSidebarProps = {}) {
  const { state, dispatch } = useAppContext();

  const majors = state.programs.majors;
  const tracks = state.programs.tracks;
  const minors = state.programs.minors;
  const selectedMajorIds = useMemo(() => [...state.selectedMajors], [state.selectedMajors]);
  const hasFinanceMajor = state.selectedMajors.has(FIN_MAJOR_ID);
  const selectedMajorBaseCodes = useMemo(
    () => new Set(selectedMajorIds.map((id) => id.replace("_MAJOR", ""))),
    [selectedMajorIds],
  );
  const minorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    minors.forEach((m) => map.set(m.id, m.label));
    return map;
  }, [minors]);
  const discoveryThemeTracks = useMemo(
    () => tracks.filter((t) => String(t.parent_major_id || "").trim().toUpperCase() === "MCC_DISC"),
    [tracks],
  );
  const majorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    majors.forEach((m) => map.set(m.id, m.label));
    return map;
  }, [majors]);
  const trackById = useMemo(() => {
    const map = new Map<string, (typeof tracks)[number]>();
    tracks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tracks]);
  const tracksByMajor = useMemo(() => {
    const map = new Map<string, (typeof tracks)>();
    tracks.forEach((t) => {
      const parent = String(t.parent_major_id || "").trim().toUpperCase();
      if (!parent) return;
      const existing = map.get(parent);
      if (existing) existing.push(t);
      else map.set(parent, [t]);
    });
    return map;
  }, [tracks]);
  const selectedTrackByMajor = useMemo(() => {
    const map = new Map<string, string>();
    state.selectedTracks.forEach((trackId) => {
      const track = trackById.get(trackId);
      const parent = String(track?.parent_major_id || "").trim().toUpperCase();
      if (parent) map.set(parent, trackId);
    });
    return map;
  }, [state.selectedTracks, trackById]);
  const tracksForMajor = useCallback(
    (majorId: string) => tracksByMajor.get(majorId) ?? tracks.filter((t) => t.id.startsWith(majorId)),
    [tracksByMajor, tracks],
  );
  const currentTrackForMajor = useCallback(
    (majorId: string) => selectedTrackByMajor.get(majorId) ?? "",
    [selectedTrackByMajor],
  );

  const [trackQuery, setTrackQuery] = useState<Record<string, string>>({});
  const [trackOpen, setTrackOpen] = useState<Record<string, boolean>>({});
  const [trackRuleWarning, setTrackRuleWarning] = useState<string | null>(null);
  const trackInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const trackListRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const trackComboId = useId();
  const aimCfaSelectedWithoutFinance =
    state.selectedTracks.includes(AIM_CFA_TRACK_ID) && !hasFinanceMajor;
  const effectiveTrackRuleWarning = !hasFinanceMajor
    ? (trackRuleWarning || (aimCfaSelectedWithoutFinance ? AIM_CFA_FINANCE_RULE_MSG : null))
    : null;

  const selectTrack = useCallback((majorId: string, trackId: string) => {
    if (trackId === AIM_CFA_TRACK_ID && !hasFinanceMajor) {
      setTrackRuleWarning(AIM_CFA_FINANCE_RULE_MSG);
      return;
    }
    setTrackRuleWarning(null);
    dispatch({ type: "SET_TRACK", payload: { majorId, trackId } });
    setTrackOpen((prev) => ({ ...prev, [majorId]: false }));
    setTrackQuery((prev) => ({ ...prev, [majorId]: "" }));
  }, [dispatch, hasFinanceMajor]);

  // Close track dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      Object.keys(trackOpen).forEach((mid) => {
        if (!trackOpen[mid]) return;
        const inputEl = trackInputRefs.current[mid];
        const listEl = trackListRefs.current[mid];
        if (
          inputEl && !inputEl.contains(target) &&
          listEl && !listEl.parentElement?.contains(target)
        ) {
          setTrackOpen((o) => ({ ...o, [mid]: false }));
        }
      });
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [trackOpen]);

  return (
    <div className="space-y-5 overflow-y-auto overflow-x-hidden pr-1">
      {!hideHeader && (
        <div>
          <p className="text-xs font-semibold text-gold leading-tight">
            Fill in exactly as your transcript for the most accurate results.
          </p>
          <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-sora)] text-white mt-2 leading-tight">
            Your Profile
          </h3>
        </div>
      )}

      {/* Majors */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          Majors
        </label>
        <div className="flex flex-wrap gap-1.5 min-h-[24px] min-w-0">
          <AnimatePresence mode="popLayout">
            {selectedMajorIds.map((id) => {
              const label = majorLabelById.get(id) ?? id;
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

      {/* Per-major track selectors - chip + combobox */}
      {effectiveTrackRuleWarning && (
        <div className="bg-bad-light rounded-lg px-2 py-1.5 text-xs text-bad">
          {effectiveTrackRuleWarning}
        </div>
      )}

      {selectedMajorIds.map((majorId) => {
        const mt = tracksForMajor(majorId);
        if (mt.length === 0) return null;
        const majorLabel = majorLabelById.get(majorId) ?? majorId;
        const selectedTrackId = currentTrackForMajor(majorId);
        const selectedTrack = mt.find((t) => t.id === selectedTrackId);
        const q = (trackQuery[majorId] || "").toLowerCase();
        const filteredTracks = mt.filter(
          (t) => !selectedTrackId && t.label.toLowerCase().includes(q),
        );
        const listboxId = `${trackComboId}-${majorId}`;

        return (
          <div key={majorId} className="space-y-1.5">
            <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
              {majorLabel} Track
            </label>

            <div className="flex flex-wrap gap-1.5 min-h-[24px] min-w-0">
              <AnimatePresence mode="popLayout">
                {selectedTrack && (
                  <Chip
                    key={selectedTrack.id}
                    label={selectedTrack.label}
                    variant="navy"
                    onRemove={() =>
                      dispatch({ type: "SET_TRACK", payload: { majorId, trackId: null } })
                    }
                  />
                )}
              </AnimatePresence>
            </div>

            {!selectedTrack && (
              <div className="relative">
                <input
                  ref={(el) => { trackInputRefs.current[majorId] = el; }}
                  type="text"
                  value={trackQuery[majorId] || ""}
                  onChange={(e) => {
                    setTrackQuery((prev) => ({ ...prev, [majorId]: e.target.value }));
                    setTrackOpen((prev) => ({ ...prev, [majorId]: true }));
                  }}
                  onFocus={() => setTrackOpen((prev) => ({ ...prev, [majorId]: true }))}
                  placeholder="Add track..."
                  className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-gold/40"
                  role="combobox"
                  aria-expanded={!!trackOpen[majorId]}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                />

                {trackOpen[majorId] && filteredTracks.length > 0 && (
                  <div
                    ref={(el) => { trackListRefs.current[majorId] = el; }}
                    id={listboxId}
                    role="listbox"
                    className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-surface-card border border-border-medium rounded-lg shadow-lg"
                  >
                    {filteredTracks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => selectTrack(majorId, t.id)}
                        className="w-full text-left px-2 py-1.5 text-xs cursor-pointer transition-colors text-ink-secondary hover:bg-surface-hover"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Minors */}
      {minors.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
            Minors
          </label>
          <div className="flex flex-wrap gap-1.5 min-h-[24px] min-w-0">
            <AnimatePresence mode="popLayout">
              {[...state.selectedMinors].map((id) => {
                const label = minorLabelById.get(id) ?? id;
                return (
                  <Chip
                    key={id}
                    label={label}
                    variant="gold"
                    onRemove={() => dispatch({ type: "REMOVE_MINOR", payload: id })}
                  />
                );
              })}
            </AnimatePresence>
          </div>
          {state.selectedMinors.size < MAX_MINORS && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  dispatch({ type: "ADD_MINOR", payload: e.target.value });
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40"
            >
              <option value="">Add minor...</option>
              {minors
                .filter(
                  (m) =>
                    !state.selectedMinors.has(m.id) &&
                    !selectedMajorBaseCodes.has(m.id.replace("_MINOR", "")),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}

      {/* Discovery Theme */}
      {discoveryThemeTracks.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
            Discovery Theme
          </label>
          <select
            value={state.discoveryTheme}
            onChange={(e) => dispatch({ type: "SET_DISCOVERY_THEME", payload: e.target.value })}
            className="w-full px-2 py-1.5 bg-surface-input border border-border-medium rounded-lg text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-gold/40"
          >
            <option value="">Select theme...</option>
            {discoveryThemeTracks.map((t) => (
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

      {/* Planning Settings */}
      <div className="pt-1 border-t border-border-subtle/40 space-y-2">
        <label className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          Planning Settings
        </label>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-secondary leading-tight">Include Summer Semesters</p>
            <p className="text-[10px] text-ink-faint leading-tight mt-0.5">Max 4 courses · Summer-only offerings</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.includeSummer}
            onClick={() => dispatch({ type: "SET_INCLUDE_SUMMER", payload: !state.includeSummer })}
            className={[
              "relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/40",
              state.includeSummer ? "bg-gold" : "bg-white/20",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                state.includeSummer ? "translate-x-4" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
