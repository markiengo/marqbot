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
  chipViewportClassName?: string;
  dynamicChipViewport?: boolean;
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
  chipViewportClassName = "h-[3rem]",
  dynamicChipViewport = false,
}: MultiSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chipContentHeight, setChipContentHeight] = useState(0);
  const chipContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getScrollableAncestor = useCallback((start: HTMLElement | null): HTMLElement | null => {
    let node = start?.parentElement ?? null;
    while (node) {
      const style = window.getComputedStyle(node);
      const canScrollY = /(auto|scroll)/.test(style.overflowY);
      if (canScrollY && node.scrollHeight > node.clientHeight) return node;
      node = node.parentElement;
    }
    return null;
  }, []);

  const ensureInputVisible = useCallback((preferDropdownRoom: boolean) => {
    const anchor = inputRef.current;
    if (!anchor) return;
    const scroller = getScrollableAncestor(anchor);
    if (!scroller) return;

    const margin = 12;
    const inputRect = anchor.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();

    if (inputRect.top < scrollerRect.top + margin) {
      scroller.scrollTop -= (scrollerRect.top + margin) - inputRect.top;
      return;
    }

    let desiredBottom = inputRect.bottom + margin;
    if (preferDropdownRoom) {
      desiredBottom += Math.min(220, scroller.clientHeight * 0.35);
    }
    if (desiredBottom > scrollerRect.bottom) {
      scroller.scrollTop += desiredBottom - scrollerRect.bottom;
    }
  }, [getScrollableAncestor]);

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
      const anchor = inputRef.current;
      const scroller = getScrollableAncestor(anchor);
      const anchorTopBefore = anchor?.getBoundingClientRect().top ?? null;
      onAdd(course.course_code);
      setQuery("");
      const reachedLimit = maxSelections ? selected.size + 1 >= maxSelections : false;
      setIsOpen(!reachedLimit);
      if (scroller && anchorTopBefore !== null) {
        requestAnimationFrame(() => {
          const anchorTopAfter = inputRef.current?.getBoundingClientRect().top;
          if (anchorTopAfter == null) return;
          const delta = anchorTopAfter - anchorTopBefore;
          if (Math.abs(delta) > 0.5) {
            scroller.scrollTop += delta;
          }
        });
      }
    },
    [getScrollableAncestor, maxSelections, onAdd, selected.size],
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
    const dropdown = dropdownRef.current;
    if (!dropdown) return;
    const active = dropdown.children[activeIndex] as HTMLElement | undefined;
    if (!active) return;

    const optionTop = active.offsetTop;
    const optionBottom = optionTop + active.offsetHeight;
    const viewportTop = dropdown.scrollTop;
    const viewportBottom = viewportTop + dropdown.clientHeight;

    if (optionTop < viewportTop) {
      dropdown.scrollTop = optionTop;
    } else if (optionBottom > viewportBottom) {
      dropdown.scrollTop = optionBottom - dropdown.clientHeight;
    }
  }, [activeIndex, isOpen, matches.length]);

  // Track chip content height for smooth auto-resize
  useEffect(() => {
    const el = chipContentRef.current;
    if (!el || !dynamicChipViewport) return;
    const ro = new ResizeObserver(() => {
      setChipContentHeight(el.scrollHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [dynamicChipViewport]);

  const atLimit = maxSelections ? selected.size >= maxSelections : false;
  const chipViewportStyle = dynamicChipViewport
    ? { height: chipContentHeight > 0 ? `${chipContentHeight}px` : undefined }
    : undefined;

  return (
    <div
      className={`relative flex flex-col gap-3 overflow-visible ${isOpen ? "z-40" : ""}`}
    >
      {/* Chips */}
      <div
        className={`${chipViewportClassName} pr-1 transition-[height] duration-200 ease-out`}
        style={chipViewportStyle}
      >
        <div ref={chipContentRef} className="flex flex-wrap gap-1.5">
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
            requestAnimationFrame(() => ensureInputVisible(true));
          }}
          onFocus={() => {
            setIsOpen(true);
            requestAnimationFrame(() => ensureInputVisible(true));
          }}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={atLimit ? `Maximum ${maxSelections} selected` : placeholder}
          disabled={atLimit}
          className="w-full rounded-xl border border-border-medium bg-surface-input px-4 py-3 text-[0.95rem] text-ink-primary placeholder:text-ink-faint focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Dropdown */}
        {isOpen && matches.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 max-h-[min(18rem,36vh)] w-full overflow-y-auto rounded-xl border border-border-medium bg-surface-card shadow-lg"
          >
            {matches.map((c, idx) => (
              <div
                key={c.course_code}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(c);
                }}
                className={`flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm ${
                  idx === activeIndex
                    ? "bg-gold/10 text-gold"
                    : "hover:bg-surface-hover"
                }`}
              >
                <span className="w-28 shrink-0 font-medium text-[#7ab3ff]">{c.course_code}</span>
                <span className="text-ink-muted truncate">{c.course_name || ""}</span>
              </div>
            ))}
          </div>
        )}
        {isOpen && query.trim() && matches.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border-medium bg-surface-card p-3 text-sm text-ink-faint shadow-lg">
            No results
          </div>
        )}
      </div>
    </div>
  );
}
