"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { Chip } from "@/components/shared/Chip";
import { OnboardingStepHeader } from "./OnboardingStepHeader";
import { MAX_MAJORS } from "@/lib/constants";

const DISC_MAJOR_ID = "MCC_DISC";

const SectionLabel = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-1.5 flex items-baseline gap-2">
    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d6a42]">{title}</span>
    {sub && <span className="text-xs text-[var(--ink-warm-muted)]">{sub}</span>}
  </div>
);

export function MajorStep() {
  const { state, dispatch } = useAppContext();
  const majors = state.programs.majors;
  const tracks = state.programs.tracks;
  const minors = state.programs.minors;

  const selectedMajorIds = useMemo(() => [...state.selectedMajors], [state.selectedMajors]);
  const atLimit = selectedMajorIds.length >= MAX_MAJORS;

  const majorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    majors.forEach((major) => map.set(major.id, major.label));
    return map;
  }, [majors]);

  const trackById = useMemo(() => {
    const map = new Map<string, (typeof tracks)[number]>();
    tracks.forEach((track) => map.set(track.id, track));
    return map;
  }, [tracks]);

  const discoveryTracks = useMemo(
    () =>
      tracks.filter(
        (track) => String(track.parent_major_id || "").trim().toUpperCase() === DISC_MAJOR_ID,
      ),
    [tracks],
  );

  const programTracks = useMemo(
    () =>
      tracks.filter(
        (track) => String(track.parent_major_id || "").trim().toUpperCase() !== DISC_MAJOR_ID,
      ),
    [tracks],
  );

  const selectedProgramTracks = useMemo(
    () =>
      state.selectedTracks
        .map((trackId) => trackById.get(trackId))
        .filter(
          (track): track is NonNullable<typeof track> =>
            track !== undefined &&
            track !== null &&
            String(track.parent_major_id || "").trim().toUpperCase() !== DISC_MAJOR_ID,
        ),
    [state.selectedTracks, trackById],
  );

  const availableProgramTracks = useMemo(
    () =>
      programTracks.filter(
        (track) =>
          !state.selectedTracks.includes(track.id) &&
          state.selectedMajors.has(String(track.parent_major_id || "")),
      ),
    [programTracks, state.selectedTracks, state.selectedMajors],
  );

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [trackRuleWarning, setTrackRuleWarning] = useState<string | null>(null);

  const majorById = useMemo(() => {
    const map = new Map<string, (typeof majors)[number]>();
    majors.forEach((major) => map.set(major.id, major));
    return map;
  }, [majors]);

  const allRequirePrimary =
    selectedMajorIds.length > 0 &&
    selectedMajorIds.every((id) => majorById.get(id)?.requires_primary_major === true);

  const filtered = majors.filter(
    (major) =>
      !state.selectedMajors.has(major.id) &&
      major.label.toLowerCase().includes(query.toLowerCase()),
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

  const effectiveTrackRuleWarning = trackRuleWarning;

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideInput = inputRef.current?.contains(target);
      const clickedInsideList = listRef.current?.parentElement?.contains(target);

      if (!clickedInsideInput && !clickedInsideList) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  const inputCls =
    "w-full rounded-xl border border-[#dbcab8] bg-[#fffaf4] px-4 py-3 text-[0.95rem] text-[var(--ink-warm)] placeholder:text-[var(--ink-warm-muted)] focus:outline-none focus:ring-2 focus:ring-[#c89f5e]/35";
  const dropdownCls =
    "absolute left-0 top-full z-[60] mt-1 max-h-[min(18rem,34vh)] w-full overflow-y-auto rounded-xl border border-[#dbcab8] bg-[#fffdf9] shadow-[0_16px_36px_rgba(82,56,29,0.10)]";
  return (
    <div className="space-y-5">
      <OnboardingStepHeader
        eyebrow="Pick your program"
        helper="Required first"
        title={
          <>
            Start with your <span className="text-[#b07b2b]">major</span>.
          </>
        }
        description="Major first, then track if it is already part of your plan. This keeps the roadmap anchored to the right requirement set."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
        <div className="relative z-10 flex flex-col overflow-visible rounded-[1.8rem] border border-[#ddd0c1] bg-[#fffdf9] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
          <SectionLabel title="Major(s)" sub={`up to ${MAX_MAJORS}`} />
          <p className="mb-2 text-[0.95rem] leading-relaxed text-[var(--ink-warm-soft)]">
            Select the programs you have actually declared.
          </p>
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
            <div className="mb-3 rounded-xl border border-[#e5c79c] bg-[#fff4df] px-3 py-2 text-xs leading-relaxed text-[#8f5e1e]">
              This selection still needs a primary major. Add one before you continue.
            </div>
          )}

          {!atLimit && (
            <div className="relative z-20 mt-auto">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlightIdx(0);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={(event) => {
                  if (!isOpen || filtered.length === 0) {
                    if (event.key === "ArrowDown" || event.key === "Enter") {
                      setIsOpen(true);
                      event.preventDefault();
                    }
                    return;
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightIdx((index) => Math.min(index + 1, filtered.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightIdx((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (filtered[highlightIdx]) {
                      selectMajor(filtered[highlightIdx].id);
                    }
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setIsOpen(false);
                  }
                }}
                placeholder="Search majors"
                className={inputCls}
                role="combobox"
                aria-expanded={isOpen}
                aria-autocomplete="list"
                aria-controls="major-listbox"
              />

              {isOpen && filtered.length > 0 && (
                <div ref={listRef} id="major-listbox" role="listbox" className={dropdownCls}>
                  {filtered.map((major, index) => (
                    <button
                      key={major.id}
                      type="button"
                      role="option"
                      aria-selected={index === highlightIdx}
                      onClick={() => selectMajor(major.id)}
                      className={`w-full cursor-pointer px-4 py-3 text-left text-sm transition-colors ${
                        index === highlightIdx
                          ? "bg-[#fff1dc] text-[#8f5e1e]"
                          : "text-[var(--ink-warm-soft)] hover:bg-[#f7eee2]"
                      }`}
                    >
                      {major.label}
                      {major.requires_primary_major && (
                        <span className="ml-2 text-xs text-[var(--ink-warm-muted)]">(needs a primary major)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {isOpen && query && filtered.length === 0 && (
                <div className="absolute left-0 top-full z-[60] mt-1 w-full rounded-xl border border-[#dbcab8] bg-[#fffdf9] px-3 py-2.5 text-xs text-[var(--ink-warm-muted)] shadow-[0_16px_36px_rgba(82,56,29,0.10)]">
                  No majors found for &ldquo;{query}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className="flex flex-col rounded-[1.8rem] border border-[#ddd0c1] bg-[#f8efe2] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
            <SectionLabel title="Track / Concentration" sub="optional" />
            <p className="mb-2.5 text-[0.95rem] leading-relaxed text-[var(--ink-warm-soft)]">
              Only add this if it is already real on your side too.
            </p>

            <div className="mb-2.5 flex min-h-[2.35rem] flex-wrap gap-1.5">
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

            <select
              onChange={(event) => {
                if (!event.target.value) return;
                addStandaloneTrack(event.target.value);
                event.target.value = "";
              }}
              defaultValue=""
              className={inputCls}
            >
              <option value="">Add track or concentration</option>
              {availableProgramTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.label}
                </option>
              ))}
            </select>

            {effectiveTrackRuleWarning && (
              <div className="mt-2 rounded-xl border border-[#e7c8ba] bg-[#fff3ee] p-3 text-xs leading-relaxed text-[#95513c]">
                {effectiveTrackRuleWarning}
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16 }}
            className="flex items-center rounded-[1.6rem] border border-[#d9c4ac] bg-[#fff7eb] px-4 py-3.5 text-[0.95rem] leading-relaxed text-[var(--ink-warm-soft)]"
          >
            Pick the spine of the plan now. You can still refine details later inside the planner.
          </motion.div>
        </div>
      </div>

      {discoveryTracks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          className="rounded-[1.45rem] border border-[#ddd0c1] bg-[#fffaf4] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]"
        >
          <SectionLabel title="Discovery Theme" sub="optional" />
          <p className="mb-2.5 text-[0.95rem] leading-relaxed text-[var(--ink-warm-soft)]">
            Pick this only if you already know it. You can change it later.
          </p>
          <select
            value={state.discoveryTheme || ""}
            onChange={(e) => dispatch({ type: "SET_DISCOVERY_THEME", payload: e.target.value })}
            className={inputCls}
          >
            <option value="">No theme selected</option>
            {discoveryTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>
        </motion.div>
      )}
    </div>
  );
}
