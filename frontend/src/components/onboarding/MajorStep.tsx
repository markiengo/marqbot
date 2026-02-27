"use client";

import { useState, useRef, useEffect, useCallback, useId, useMemo } from "react";
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

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter majors by search query
  const filtered = majors.filter(
    (m) =>
      !state.selectedMajors.has(m.id) &&
      m.label.toLowerCase().includes(query.toLowerCase()),
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filtered.length === 0) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIdx]) {
          selectMajor(filtered[highlightIdx].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.children[highlightIdx] as HTMLElement;
    if (highlighted) {
      highlighted.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.parentElement?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Track combobox state keyed by majorId
  const [trackQuery, setTrackQuery] = useState<Record<string, string>>({});
  const [trackOpen, setTrackOpen] = useState<Record<string, boolean>>({});
  const trackInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const trackListRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const trackComboId = useId();

  // Tracks grouped by parent major (fallback to legacy ID prefix matching)
  const tracksForMajor = useCallback(
    (majorId: string) => tracksByMajor.get(majorId) ?? tracks.filter((t) => t.id.startsWith(majorId)),
    [tracksByMajor, tracks],
  );

  const currentTrackForMajor = useCallback(
    (majorId: string) => selectedTrackByMajor.get(majorId) ?? "",
    [selectedTrackByMajor],
  );

  const selectTrack = useCallback(
    (majorId: string, trackId: string) => {
      dispatch({ type: "SET_TRACK", payload: { majorId, trackId } });
      setTrackOpen((o) => ({ ...o, [majorId]: false }));
      setTrackQuery((q) => ({ ...q, [majorId]: "" }));
    },
    [dispatch],
  );

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
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          What&apos;s your major?
        </h2>
        <p className="text-base text-ink-muted mt-1">
          Select up to {MAX_MAJORS} majors. This determines which requirement
          buckets we track.
        </p>
      </div>

      {/* Selected chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
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

      {/* Searchable combobox */}
      {!atLimit && (
        <div className="relative">
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
            onKeyDown={handleKeyDown}
            placeholder="Search majors..."
            className="w-full px-4 py-3 bg-surface-input border border-border-medium rounded-xl text-base text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="major-listbox"
          />

          {isOpen && filtered.length > 0 && (
            <div
              ref={listRef}
              id="major-listbox"
              role="listbox"
              className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto bg-surface-card border border-border-medium rounded-xl shadow-lg"
            >
              {filtered.map((m, idx) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={idx === highlightIdx}
                  onClick={() => selectMajor(m.id)}
                  className={`w-full text-left px-4 py-3 text-base cursor-pointer transition-colors ${
                    idx === highlightIdx
                      ? "bg-gold/15 text-gold"
                      : "text-ink-secondary hover:bg-surface-hover"
                  }`}
                >
                  {m.label}
                  {m.requires_primary_major && (
                    <span className="text-xs font-medium text-ink-faint ml-2">(requires primary)</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {isOpen && query && filtered.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg px-4 py-3 text-sm text-ink-faint">
              No majors match &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Per-major track selectors — chip + combobox, mirrors major selector */}
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
          <div key={majorId} className="space-y-2">
            <label className="text-base font-medium text-ink-secondary">
              {majorLabel} track (optional)
            </label>

            {/* Selected track chip */}
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
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

            {/* Combobox — only shown when no track selected */}
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
                  placeholder="Search tracks..."
                  className="w-full px-4 py-3 bg-surface-input border border-border-medium rounded-xl text-base text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
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
                    className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto bg-surface-card border border-border-medium rounded-xl shadow-lg"
                  >
                    {filteredTracks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => selectTrack(majorId, t.id)}
                        className="w-full text-left px-4 py-3 text-base cursor-pointer transition-colors text-ink-secondary hover:bg-surface-hover"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {trackOpen[majorId] && trackQuery[majorId] && filteredTracks.length === 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg px-4 py-3 text-sm text-ink-faint">
                    No tracks match &ldquo;{trackQuery[majorId]}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
