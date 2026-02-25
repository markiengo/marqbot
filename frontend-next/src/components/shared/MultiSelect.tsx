"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { filterCourses } from "@/lib/utils";
import type { Course } from "@/lib/types";
import { Chip } from "./Chip";

interface MultiSelectProps {
  courses: Course[];
  selected: Set<string>;
  otherSet?: Set<string>;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  placeholder?: string;
  maxSelections?: number;
  resolveLabel?: (code: string) => string;
}

export function MultiSelect({
  courses,
  selected,
  otherSet = new Set(),
  onAdd,
  onRemove,
  placeholder = "Search courses...",
  maxSelections,
  resolveLabel = (code) => code,
}: MultiSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const excludeSet = useMemo(
    () => new Set([...selected, ...otherSet]),
    [selected, otherSet],
  );

  const defaultMatches = useMemo(() => {
    return courses
      .filter((c) => !excludeSet.has(c.course_code))
      .sort((a, b) => {
        const aLevel = Number(a?.level ?? a?.prereq_level);
        const bLevel = Number(b?.level ?? b?.prereq_level);
        const aRank = Number.isFinite(aLevel) ? aLevel : Number.POSITIVE_INFINITY;
        const bRank = Number.isFinite(bLevel) ? bLevel : Number.POSITIVE_INFINITY;
        if (aRank !== bRank) return aRank - bRank;
        return String(a?.course_code || "").localeCompare(String(b?.course_code || ""));
      })
      .slice(0, 24);
  }, [courses, excludeSet]);

  const matches = query.trim()
    ? filterCourses(query, excludeSet, courses)
    : isOpen
      ? defaultMatches
      : [];

  const handleSelect = useCallback(
    (course: Course) => {
      if (maxSelections && selected.size >= maxSelections) return;
      onAdd(course.course_code);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [onAdd, maxSelections, selected.size],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      return;
    }
    if (!isOpen || matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < matches.length) {
        handleSelect(matches[activeIndex]);
      }
    }
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active option into view
  useEffect(() => {
    if (!dropdownRef.current) return;
    const active = dropdownRef.current.children[activeIndex] as HTMLElement;
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const atLimit = maxSelections ? selected.size >= maxSelections : false;

  return (
    <div className="space-y-2">
      {/* Chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        <AnimatePresence mode="popLayout">
          {[...selected].map((code) => (
            <Chip
              key={code}
              label={resolveLabel(code)}
              onRemove={() => onRemove(code)}
              variant="navy"
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={atLimit ? `Maximum ${maxSelections} selected` : placeholder}
          disabled={atLimit}
          className="w-full px-3 py-2 bg-surface-input border border-border-medium rounded-xl text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Dropdown */}
        {isOpen && matches.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-40 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {matches.map((c, idx) => (
              <div
                key={c.course_code}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(c);
                }}
                className={`px-3 py-2 cursor-pointer text-sm flex items-center gap-2 ${
                  idx === activeIndex
                    ? "bg-gold/10 text-gold"
                    : "hover:bg-surface-hover"
                }`}
              >
                <span className="font-medium text-[#7ab3ff]">{c.course_code}</span>
                <span className="text-ink-muted truncate">{c.course_name || ""}</span>
              </div>
            ))}
          </div>
        )}
        {isOpen && query.trim() && matches.length === 0 && (
          <div className="absolute z-40 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg p-3 text-sm text-ink-faint">
            No results
          </div>
        )}
      </div>
    </div>
  );
}
