"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { Chip } from "@/components/shared/Chip";
import { MAX_MAJORS } from "@/lib/constants";
import { majorMatchesQuery } from "@/lib/programSearch";

const DISC_MAJOR_ID = "MCC_DISC";

const SectionLabel = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-1.5 flex items-baseline gap-2">
    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-light">{title}</span>
    {sub && <span className="text-xs text-ink-muted">{sub}</span>}
  </div>
);

export function ProfileProgramTab() {
  const { state, dispatch } = useAppContext();
  const majors = state.programs.majors;
  const tracks = state.programs.tracks;
  const minors = state.programs.minors;

  const selectedMajorIds = useMemo(() => [...state.selectedMajors], [state.selectedMajors]);
  const atLimit = selectedMajorIds.length >= MAX_MAJORS;

  const majorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    majors.forEach((m) => map.set(m.id, m.label));
    return map;
  }, [majors]);

  const majorById = useMemo(() => {
    const map = new Map<string, (typeof majors)[number]>();
    majors.forEach((m) => map.set(m.id, m));
    return map;
  }, [majors]);

  const allRequirePrimary =
    selectedMajorIds.length > 0 &&
    selectedMajorIds.every((id) => majorById.get(id)?.requires_primary_major === true);

  const trackById = useMemo(() => {
    const map = new Map<string, (typeof tracks)[number]>();
    tracks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tracks]);

  const discoveryTracks = useMemo(
    () => tracks.filter((t) => String(t.parent_major_id || "").trim().toUpperCase() === DISC_MAJOR_ID),
    [tracks],
  );

  const programTracks = useMemo(
    () => tracks.filter((t) => String(t.parent_major_id || "").trim().toUpperCase() !== DISC_MAJOR_ID),
    [tracks],
  );

  const selectedProgramTracks = useMemo(
    () =>
      state.selectedTracks
        .map((id) => trackById.get(id))
        .filter(
          (t): t is NonNullable<typeof t> =>
            t != null && String(t.parent_major_id || "").trim().toUpperCase() !== DISC_MAJOR_ID,
        ),
    [state.selectedTracks, trackById],
  );

  const availableProgramTracks = useMemo(
    () =>
      programTracks.filter(
        (t) =>
          !state.selectedTracks.includes(t.id) &&
          state.selectedMajors.has(String(t.parent_major_id || "")),
      ),
    [programTracks, state.selectedTracks, state.selectedMajors],
  );

  // Combobox state
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [trackRuleWarning, setTrackRuleWarning] = useState<string | null>(null);

  const filtered = majors.filter(
    (m) => !state.selectedMajors.has(m.id) && majorMatchesQuery(m, query),
  );

  const selectMajor = useCallback(
    (id: string) => {
      if (atLimit) return;
      dispatch({ type: "ADD_MAJOR", payload: id });
      setQuery("");
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [atLimit, dispatch],
  );

  const trackRequirementMessage = useCallback(
    (trackId: string) => {
      const track = trackById.get(trackId);
      const requiredMajorId = String(track?.required_major_id || "").trim();
      if (!requiredMajorId || state.selectedMajors.has(requiredMajorId)) return null;
      const trackLabel = String(track?.label || trackId).trim();
      const majorLabel = majorLabelById.get(requiredMajorId) ?? requiredMajorId;
      return `${trackLabel} requires a declared major in ${majorLabel}.`;
    },
    [majorLabelById, state.selectedMajors, trackById],
  );

  const addStandaloneTrack = useCallback(
    (trackId: string) => {
      const warning = trackRequirementMessage(trackId);
      if (warning) {
        setTrackRuleWarning(warning);
        return;
      }
      setTrackRuleWarning(null);
      dispatch({ type: "ADD_TRACK", payload: trackId });
    },
    [dispatch, trackRequirementMessage],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!inputRef.current?.contains(target) && !listRef.current?.parentElement?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  const inputCls = "onboarding-input w-full rounded-xl px-4 py-3 text-[0.95rem]";
  const selectCls = `${inputCls} onboarding-select`;
  const dropdownCls =
    "onboarding-panel absolute left-0 top-full z-[60] mt-2 max-h-[min(18rem,34vh)] w-full overflow-y-auto rounded-xl border-t border-border-subtle shadow-[0_24px_48px_rgba(0,0,0,0.3)]";

  return (
    <div className="space-y-4">
      {/* Majors */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="onboarding-panel relative z-10 flex flex-col overflow-visible rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]"
      >
        <SectionLabel title="Major(s)" sub={`up to ${MAX_MAJORS}`} />
        <div className="mb-2.5 flex min-h-[2.35rem] flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {selectedMajorIds.map((id) => (
              <Chip
                key={id}
                label={majorLabelById.get(id) ?? id}
                variant="navy"
                onRemove={() => dispatch({ type: "REMOVE_MAJOR", payload: id })}
              />
            ))}
          </AnimatePresence>
        </div>

        {allRequirePrimary && (
          <div className="onboarding-panel-gold mb-3 rounded-xl px-3 py-2 text-xs leading-relaxed text-ink-primary">
            This selection still needs a primary major. Add one to complete the setup.
          </div>
        )}

        {!atLimit && (
          <div className="relative z-20 mt-auto">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIdx(0);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (!isOpen || filtered.length === 0) {
                  if (e.key === "ArrowDown" || e.key === "Enter") {
                    setIsOpen(true);
                    e.preventDefault();
                  }
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[highlightIdx]) selectMajor(filtered[highlightIdx].id);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
              placeholder="Search majors"
              className={inputCls}
              role="combobox"
              aria-expanded={isOpen}
              aria-autocomplete="list"
              aria-controls="profile-major-listbox"
            />
            {isOpen && filtered.length > 0 && (
              <div ref={listRef} id="profile-major-listbox" role="listbox" className={dropdownCls}>
                {filtered.map((major, idx) => (
                  <button
                    key={major.id}
                    type="button"
                    role="option"
                    aria-selected={idx === highlightIdx}
                    onClick={() => selectMajor(major.id)}
                    className={`w-full cursor-pointer px-4 py-3 text-left text-sm transition-colors ${
                      idx === highlightIdx
                        ? "bg-[rgba(255,204,0,0.12)] text-gold-light"
                        : "text-ink-primary hover:bg-[rgba(141,170,224,0.12)]"
                    }`}
                  >
                    {major.label}
                    {major.requires_primary_major && (
                      <span className={`ml-2 text-xs ${idx === highlightIdx ? "text-gold-light/80" : "text-ink-muted"}`}>
                        (needs a primary major)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {isOpen && query && filtered.length === 0 && (
              <div className="onboarding-panel absolute left-0 top-full z-[60] mt-2 w-full rounded-xl border-t border-border-subtle px-3 py-2.5 text-xs text-ink-muted shadow-[0_24px_48px_rgba(0,0,0,0.3)]">
                No majors found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Track + Discovery side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.08 }}
          className="onboarding-panel-soft flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]"
        >
          <SectionLabel title="Track / Concentration" sub="optional" />
          {selectedProgramTracks.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              <AnimatePresence mode="popLayout">
                {selectedProgramTracks.map((track) => (
                  <Chip
                    key={track.id}
                    label={track.label}
                    variant="navy"
                    onRemove={() => dispatch({ type: "REMOVE_TRACK", payload: track.id })}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
          <select
            onChange={(e) => {
              if (!e.target.value) return;
              addStandaloneTrack(e.target.value);
              e.target.value = "";
            }}
            defaultValue=""
            className={selectCls}
          >
            <option value="">Add track or concentration</option>
            {availableProgramTracks.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          {trackRuleWarning && (
            <div className="onboarding-panel-danger mt-2 rounded-xl p-3 text-xs leading-relaxed text-[#ffd5dc]">
              {trackRuleWarning}
            </div>
          )}
        </motion.div>

        {discoveryTracks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.16 }}
            className="onboarding-panel-soft flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]"
          >
            <SectionLabel title="Discovery Theme" sub="optional" />
            <select
              value={state.discoveryTheme || ""}
              onChange={(e) => dispatch({ type: "SET_DISCOVERY_THEME", payload: e.target.value })}
              className={selectCls}
            >
              <option value="">No theme selected</option>
              {discoveryTracks.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </motion.div>
        )}
      </div>

      {/* Minors — coming soon */}
      {minors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.24 }}
          className="onboarding-panel-soft relative flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]"
        >
          <SectionLabel title="Minors" />
          <div className="relative">
            <select disabled className={`${selectCls} pointer-events-none opacity-40`}>
              <option value="">Add minor...</option>
            </select>
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-card/80">
              <span className="text-xs font-semibold uppercase tracking-widest text-gold/70">Coming Soon</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
