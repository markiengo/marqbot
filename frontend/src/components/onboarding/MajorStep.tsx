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
    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-light">{title}</span>
    {sub && <span className="text-xs text-ink-muted">{sub}</span>}
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
    "onboarding-input w-full rounded-xl px-4 py-3 text-[0.95rem]";
  const selectCls = `${inputCls} onboarding-select`;
  const dropdownCls =
    "onboarding-panel absolute left-0 top-full z-[60] mt-1 max-h-[min(18rem,34vh)] w-full overflow-y-auto rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.22)]";
  return (
    <div className="space-y-5">
      <OnboardingStepHeader
        eyebrow="Pick your program"
        title={
          <>
            Start with your <span className="text-gold">major</span>.
          </>
        }
        description="Add your declared major, then any official tracks or concentrations."
      />

      {/* Major — full width on top */}
      <div className="onboarding-panel relative z-10 flex flex-col overflow-visible rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]">
        <SectionLabel title="Major(s)" sub={`up to ${MAX_MAJORS}`} />
        <p className="mb-2 text-[0.95rem] leading-relaxed text-ink-secondary">
          Add what you&apos;ve declared or been admitted to.
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
          <div className="onboarding-panel-gold mb-3 rounded-xl px-3 py-2 text-xs leading-relaxed text-ink-primary">
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
                        ? "bg-[rgba(255,204,0,0.12)] text-gold-light"
                        : "text-ink-primary hover:bg-[rgba(141,170,224,0.12)]"
                    }`}
                  >
                    {major.label}
                    {major.requires_primary_major && (
                      <span
                        className={`ml-2 text-xs ${
                          index === highlightIdx ? "text-gold-light/80" : "text-ink-muted"
                        }`}
                      >
                        (needs a primary major)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {isOpen && query && filtered.length === 0 && (
              <div className="onboarding-panel absolute left-0 top-full z-[60] mt-1 w-full rounded-xl px-3 py-2.5 text-xs text-ink-muted shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
                No majors found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Track + Discovery — side by side below */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="onboarding-panel-soft flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]">
          <SectionLabel title="Track / Concentration" sub="optional" />
          <p className="mb-2.5 text-[0.95rem] leading-relaxed text-ink-secondary">
            Only add tracks you&apos;ve officially declared.
          </p>

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
            onChange={(event) => {
              if (!event.target.value) return;
              addStandaloneTrack(event.target.value);
              event.target.value = "";
            }}
            defaultValue=""
            className={selectCls}
          >
            <option value="">Add track or concentration</option>
            {availableProgramTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>

          {effectiveTrackRuleWarning && (
            <div className="onboarding-panel-danger mt-2 rounded-xl p-3 text-xs leading-relaxed text-[#ffd5dc]">
              {effectiveTrackRuleWarning}
            </div>
          )}
        </div>

        {discoveryTracks.length > 0 && (
          <div className="onboarding-panel-soft flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]">
            <SectionLabel title="Discovery Theme" sub="optional" />
            <p className="mb-2.5 text-[0.95rem] leading-relaxed text-ink-secondary">
              Optional. Skip this if you haven&apos;t picked one yet.
            </p>
            <select
              value={state.discoveryTheme || ""}
              onChange={(e) => dispatch({ type: "SET_DISCOVERY_THEME", payload: e.target.value })}
              className={selectCls}
            >
              <option value="">No theme selected</option>
              {discoveryTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
