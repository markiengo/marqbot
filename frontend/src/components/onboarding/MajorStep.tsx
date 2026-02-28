"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAppContext } from "@/context/AppContext";
import { Chip } from "@/components/shared/Chip";
import {
  MAX_MAJORS,
  MAX_MINORS,
  AIM_CFA_TRACK_ID,
  AIM_CFA_FINANCE_RULE_MSG,
  FIN_MAJOR_ID,
} from "@/lib/constants";
import { AnimatePresence } from "motion/react";

const DISC_MAJOR_ID = "MCC_DISC";

const SectionLabel = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="flex items-baseline gap-2 mb-1.5">
    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</span>
    {sub && <span className="text-xs text-ink-faint">{sub}</span>}
  </div>
);

export function MajorStep() {
  const { state, dispatch } = useAppContext();
  const majors = state.programs.majors;
  const tracks = state.programs.tracks;
  const minors = state.programs.minors;

  const selectedMajorIds = useMemo(() => [...state.selectedMajors], [state.selectedMajors]);
  const hasFinanceMajor = state.selectedMajors.has(FIN_MAJOR_ID);
  const atLimit = selectedMajorIds.length >= MAX_MAJORS;
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

  const selectedMajorBaseCodes = useMemo(
    () => new Set(selectedMajorIds.map((id) => id.replace("_MAJOR", ""))),
    [selectedMajorIds],
  );
  const minorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    minors.forEach((m) => map.set(m.id, m.label));
    return map;
  }, [minors]);
  const atMinorLimit = state.selectedMinors.size >= MAX_MINORS;
  const minorsComingSoon = true;
  const discoveryThemeComingSoon = true;

  // Discovery tracks (MCC_DISC children)
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
    () => programTracks.filter((t) => !state.selectedTracks.includes(t.id)),
    [programTracks, state.selectedTracks],
  );

  // ── Major combobox state ─────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Minor combobox state ─────────────────────────────────────────────────────
  const [minorQuery, setMinorQuery] = useState("");
  const [minorIsOpen, setMinorIsOpen] = useState(false);
  const [minorHighlightIdx, setMinorHighlightIdx] = useState(0);
  const minorInputRef = useRef<HTMLInputElement>(null);
  const minorListRef = useRef<HTMLDivElement>(null);
  const [trackQuery, setTrackQuery] = useState<Record<string, string>>({});
  const [trackOpen, setTrackOpen] = useState<Record<string, boolean>>({});
  const trackInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const trackListRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const trackComboId = "legacy-track";
  const majorsWithTracks: string[] = [];
  const tracksForMajor = useCallback(
    (_majorId: string) => [] as (typeof tracks),
    [],
  );
  const currentTrackForMajor = useCallback((_majorId: string) => "", []);
  const selectedDiscoveryTrack = undefined as (typeof tracks)[number] | undefined;
  const selectTrack = useCallback((_majorId: string, _trackId: string) => {}, []);

  // ── Track combobox state (keyed by majorId, reused for DISC_MAJOR_ID) ───────
  const [trackRuleWarning, setTrackRuleWarning] = useState<string | null>(null);

  const majorById = useMemo(() => {
    const map = new Map<string, (typeof majors)[number]>();
    majors.forEach((m) => map.set(m.id, m));
    return map;
  }, [majors]);

  const allRequirePrimary =
    selectedMajorIds.length > 0 &&
    selectedMajorIds.every((id) => majorById.get(id)?.requires_primary_major === true);

  const filtered = majors.filter(
    (m) =>
      !state.selectedMajors.has(m.id) &&
      m.label.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredMinors = minors.filter(
    (m) =>
      !state.selectedMinors.has(m.id) &&
      !selectedMajorBaseCodes.has(m.id.replace("_MINOR", "")) &&
      m.label.toLowerCase().includes(minorQuery.toLowerCase()),
  );

  const selectMajor = useCallback(
    (id: string) => {
      if (!atLimit) {
        dispatch({ type: "ADD_MAJOR", payload: id });
        setQuery("");
        setIsOpen(false);
        inputRef.current?.focus();
      }
    },
    [atLimit, dispatch],
  );
  const selectMinor = useCallback(
    (id: string) => {
      if (!atMinorLimit) {
        dispatch({ type: "ADD_MINOR", payload: id });
        setMinorQuery("");
        setMinorIsOpen(false);
        minorInputRef.current?.focus();
      }
    },
    [atMinorLimit, dispatch],
  );
  const addStandaloneTrack = useCallback(
    (trackId: string) => {
      if (trackId === AIM_CFA_TRACK_ID && !hasFinanceMajor) {
        setTrackRuleWarning(AIM_CFA_FINANCE_RULE_MSG);
        return;
      }
      setTrackRuleWarning(null);
      dispatch({ type: "ADD_TRACK", payload: trackId });
    },
    [dispatch, hasFinanceMajor],
  );

  const aimCfaSelectedWithoutFinance = state.selectedTracks.includes(AIM_CFA_TRACK_ID) && !hasFinanceMajor;
  const effectiveTrackRuleWarning = !hasFinanceMajor
    ? (trackRuleWarning || (aimCfaSelectedWithoutFinance ? AIM_CFA_FINANCE_RULE_MSG : null))
    : null;

  // Outside-click handlers
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current && !inputRef.current.contains(t) && listRef.current && !listRef.current.parentElement?.contains(t))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (minorInputRef.current && !minorInputRef.current.contains(t) && minorListRef.current && !minorListRef.current.parentElement?.contains(t))
        setMinorIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll highlighted major item into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.children[highlightIdx] as HTMLElement;
    if (highlighted) highlighted.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  const inputCls = "w-full px-3 py-2.5 bg-surface-input border border-border-medium rounded-xl text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-gold/40";
  const dropdownCls = "absolute z-20 w-full mt-1 max-h-52 overflow-y-auto bg-surface-card border border-border-medium rounded-xl shadow-lg";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          What&apos;s your program?
        </h2>
        <p className="text-sm text-ink-muted mt-0.5">
          Select your major(s), any minors, and optional concentrations.
        </p>
      </div>

      {/* ── 1. Majors ─────────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel title="Major(s)" sub={`up to ${MAX_MAJORS}`} />
        <div className="flex flex-wrap gap-1.5 min-h-[26px] mb-1.5">
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
          <div className="rounded-lg bg-warn-light px-2.5 py-1.5 text-xs text-warn mb-1.5">
            All selected majors are secondary-only and require a primary major alongside them. Add a standalone major (e.g., Finance, Marketing) to complete your program.
          </div>
        )}
        {!atLimit && (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlightIdx(0); setIsOpen(true); }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (!isOpen || filtered.length === 0) {
                  if (e.key === "ArrowDown" || e.key === "Enter") { setIsOpen(true); e.preventDefault(); }
                  return;
                }
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlightIdx]) selectMajor(filtered[highlightIdx].id); }
                else if (e.key === "Escape") { e.preventDefault(); setIsOpen(false); }
              }}
              placeholder="Search majors..."
              className={inputCls}
              role="combobox"
              aria-expanded={isOpen}
              aria-autocomplete="list"
              aria-controls="major-listbox"
            />
            {isOpen && filtered.length > 0 && (
              <div ref={listRef} id="major-listbox" role="listbox" className={dropdownCls}>
                {filtered.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={idx === highlightIdx}
                    onClick={() => selectMajor(m.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm cursor-pointer transition-colors ${idx === highlightIdx ? "bg-gold/15 text-gold" : "text-ink-secondary hover:bg-surface-hover"}`}
                  >
                    {m.label}
                    {m.requires_primary_major && (
                      <span className="text-xs text-ink-faint ml-2">(requires primary)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {isOpen && query && filtered.length === 0 && (
              <div className="absolute z-20 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg px-3 py-2.5 text-xs text-ink-faint">
                No majors match &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Minors ─────────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel title="Track / Concentration" sub="optional separate program" />
        <div className="flex flex-wrap gap-1.5 min-h-[26px] mb-1.5">
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
          onChange={(e) => {
            if (e.target.value) {
              addStandaloneTrack(e.target.value);
              e.target.value = "";
            }
          }}
          defaultValue=""
          className={inputCls}
        >
          <option value="">Add track or concentration...</option>
          {availableProgramTracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.label}
            </option>
          ))}
        </select>
        {effectiveTrackRuleWarning && (
          <div className="bg-bad-light rounded-xl p-3 text-xs text-bad mt-2">
            {effectiveTrackRuleWarning}
          </div>
        )}
      </div>

      {minors.length > 0 && (
        <div>
          <SectionLabel title="Minor(s)" sub="optional" />
          {minorsComingSoon ? (
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="Search minors..."
                className={`${inputCls} pointer-events-none opacity-40`}
                aria-label="Minor search"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-card/60 backdrop-blur-[1px]">
                <span className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest">
                  Coming Soon
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 min-h-[26px] mb-1.5">
                <AnimatePresence mode="popLayout">
                  {[...state.selectedMinors].map((id) => (
                    <Chip
                      key={id}
                      label={minorLabelById.get(id) ?? id}
                      variant="gold"
                      onRemove={() => dispatch({ type: "REMOVE_MINOR", payload: id })}
                    />
                  ))}
                </AnimatePresence>
              </div>
              {!atMinorLimit && (
                <div className="relative">
                  <input
                    ref={minorInputRef}
                    type="text"
                    value={minorQuery}
                    onChange={(e) => { setMinorQuery(e.target.value); setMinorHighlightIdx(0); setMinorIsOpen(true); }}
                    onFocus={() => setMinorIsOpen(true)}
                    onKeyDown={(e) => {
                      if (!minorIsOpen || filteredMinors.length === 0) {
                        if (e.key === "ArrowDown" || e.key === "Enter") { setMinorIsOpen(true); e.preventDefault(); }
                        return;
                      }
                      if (e.key === "ArrowDown") { e.preventDefault(); setMinorHighlightIdx((i) => Math.min(i + 1, filteredMinors.length - 1)); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setMinorHighlightIdx((i) => Math.max(i - 1, 0)); }
                      else if (e.key === "Enter") { e.preventDefault(); if (filteredMinors[minorHighlightIdx]) selectMinor(filteredMinors[minorHighlightIdx].id); }
                      else if (e.key === "Escape") { e.preventDefault(); setMinorIsOpen(false); }
                    }}
                    placeholder="Search minors..."
                    className={inputCls}
                    role="combobox"
                    aria-expanded={minorIsOpen}
                    aria-autocomplete="list"
                    aria-controls="minor-listbox"
                  />
                  {minorIsOpen && filteredMinors.length > 0 && (
                    <div ref={minorListRef} id="minor-listbox" role="listbox" className={dropdownCls}>
                      {filteredMinors.map((m, idx) => (
                        <button
                          key={m.id}
                          type="button"
                          role="option"
                          aria-selected={idx === minorHighlightIdx}
                          onClick={() => selectMinor(m.id)}
                          className={`w-full text-left px-3 py-2.5 text-sm cursor-pointer transition-colors ${idx === minorHighlightIdx ? "bg-gold/15 text-gold" : "text-ink-secondary hover:bg-surface-hover"}`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {minorIsOpen && minorQuery && filteredMinors.length === 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg px-3 py-2.5 text-xs text-ink-faint">
                      No minors match &ldquo;{minorQuery}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 3. Concentration / Track ──────────────────────────────────────────── */}
      {false && (
        <div>
          <SectionLabel title="Concentration / Track" sub="optional" />
        {effectiveTrackRuleWarning && (
          <div className="bg-bad-light rounded-xl p-3 text-xs text-bad mb-2">
            {effectiveTrackRuleWarning}
          </div>
        )}
        {majorsWithTracks.length === 0 ? (
          <p className="text-xs text-ink-faint py-1">
            Select a major with a concentration to see options.
          </p>
        ) : (
          <div className="space-y-3">
            {majorsWithTracks.map((majorId) => {
              const mt = tracksForMajor(majorId);
              const majorLabel = majorLabelById.get(majorId) ?? majorId;
              const selectedTrackId = currentTrackForMajor(majorId);
              const selectedTrack = mt.find((t) => t.id === selectedTrackId);
              const q = (trackQuery[majorId] || "").toLowerCase();
              const filteredTracks = mt.filter(
                (t) => !selectedTrackId && t.label.toLowerCase().includes(q),
              );
              const listboxId = `${trackComboId}-${majorId}`;
              return (
                <div key={majorId}>
                  <p className="text-xs text-ink-faint mb-1">{majorLabel}</p>
                  <div className="flex flex-wrap gap-1.5 min-h-[26px] mb-1.5">
                    <AnimatePresence mode="popLayout">
                      {selectedTrack && (
                        <Chip
                          key={selectedTrack.id}
                          label={selectedTrack.label}
                          variant="navy"
                          onRemove={() => dispatch({ type: "SET_TRACK", payload: { majorId, trackId: null } })}
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
                        placeholder="Search concentrations..."
                        className={inputCls}
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
                          className={dropdownCls}
                        >
                          {filteredTracks.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              role="option"
                              aria-selected={false}
                              onClick={() => selectTrack(majorId, t.id)}
                              className="w-full text-left px-3 py-2.5 text-sm cursor-pointer transition-colors text-ink-secondary hover:bg-surface-hover"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {trackOpen[majorId] && trackQuery[majorId] && filteredTracks.length === 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg px-3 py-2.5 text-xs text-ink-faint">
                          No concentrations match &ldquo;{trackQuery[majorId]}&rdquo;
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}

      {/* ── 4. Discovery Theme ────────────────────────────────────────────────── */}
      {discoveryTracks.length > 0 && (
        <div>
          <SectionLabel title="Discovery Theme" sub="optional" />
          {discoveryThemeComingSoon ? (
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="Search discovery themes..."
                className={`${inputCls} pointer-events-none opacity-40`}
                aria-label="Discovery theme search"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-card/60 backdrop-blur-[1px]">
                <span className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest">
                  Coming Soon
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 min-h-[26px] mb-1.5">
                <AnimatePresence mode="popLayout">
                  {selectedDiscoveryTrack && (
                    <Chip
                      key={selectedDiscoveryTrack.id}
                      label={selectedDiscoveryTrack.label}
                      variant="navy"
                      onRemove={() =>
                        dispatch({ type: "SET_TRACK", payload: { majorId: DISC_MAJOR_ID, trackId: null } })
                      }
                    />
                  )}
                </AnimatePresence>
              </div>
              {!selectedDiscoveryTrack && (
                <div className="relative">
                  <input
                    ref={(el) => { trackInputRefs.current[DISC_MAJOR_ID] = el; }}
                    type="text"
                    value={trackQuery[DISC_MAJOR_ID] || ""}
                    onChange={(e) => {
                      setTrackQuery((prev) => ({ ...prev, [DISC_MAJOR_ID]: e.target.value }));
                      setTrackOpen((prev) => ({ ...prev, [DISC_MAJOR_ID]: true }));
                    }}
                    onFocus={() => setTrackOpen((prev) => ({ ...prev, [DISC_MAJOR_ID]: true }))}
                    placeholder="Search discovery themes..."
                    className={inputCls}
                    role="combobox"
                    aria-expanded={!!trackOpen[DISC_MAJOR_ID]}
                    aria-autocomplete="list"
                    aria-controls={`${trackComboId}-disc`}
                  />
                  {trackOpen[DISC_MAJOR_ID] && (
                    (() => {
                      const q = (trackQuery[DISC_MAJOR_ID] || "").toLowerCase();
                      const filteredDisc = discoveryTracks.filter((t) => t.label.toLowerCase().includes(q));
                      return filteredDisc.length > 0 ? (
                        <div
                          ref={(el) => { trackListRefs.current[DISC_MAJOR_ID] = el; }}
                          id={`${trackComboId}-disc`}
                          role="listbox"
                          className={dropdownCls}
                        >
                          {filteredDisc.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              role="option"
                              aria-selected={false}
                              onClick={() => selectTrack(DISC_MAJOR_ID, t.id)}
                              className="w-full text-left px-3 py-2.5 text-sm cursor-pointer transition-colors text-ink-secondary hover:bg-surface-hover"
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      ) : trackQuery[DISC_MAJOR_ID] ? (
                        <div className="absolute z-20 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg px-3 py-2.5 text-xs text-ink-faint">
                          No themes match &ldquo;{trackQuery[DISC_MAJOR_ID]}&rdquo;
                        </div>
                      ) : null;
                    })()
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
