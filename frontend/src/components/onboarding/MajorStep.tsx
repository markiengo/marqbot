"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

  // Determine available tracks for selected majors
  const availableTracks = tracks.filter((t) =>
    selectedMajorIds.some((mId) => t.parent_major_id === mId || t.id.startsWith(mId)),
  );

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
                    <span className="text-xs text-ink-faint ml-2">(requires primary)</span>
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

      {/* Track selector */}
      {availableTracks.length > 0 && (
        <div className="space-y-2">
          <label className="text-base font-medium text-ink-secondary">
            Select a track (optional)
          </label>
          <select
            value={state.selectedTrack || ""}
            onChange={(e) =>
              dispatch({ type: "SET_TRACK", payload: e.target.value || null })
            }
            className="w-full px-4 py-3 bg-surface-input border border-border-medium rounded-xl text-base text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
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
