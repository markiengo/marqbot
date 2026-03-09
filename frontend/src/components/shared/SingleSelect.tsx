"use client";

import { useState, useRef, useCallback } from "react";
import { filterCourses } from "@/lib/utils";
import type { Course } from "@/lib/types";

interface SingleSelectProps {
  courses: Course[];
  value: string;
  onChange: (value: string) => void;
  onSelect?: (course: Course) => void;
  placeholder?: string;
}

export function SingleSelect({
  courses,
  value,
  onChange,
  onSelect,
  placeholder = "Search course...",
}: SingleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const matches =
    value.trim().length >= 2
      ? filterCourses(value, new Set(), courses)
      : [];

  const handleSelect = (course: Course) => {
    onChange(course.course_code);
    setIsOpen(false);
    onSelect?.(course);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      onChange("");
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && matches.length > 0 && activeIndex >= 0 && activeIndex < matches.length) {
        // Dropdown open — select highlighted item
        handleSelect(matches[activeIndex]);
      } else {
        // Dropdown closed — try exact match on typed value
        const exact = courses.find(
          (c) => c.course_code.toUpperCase() === value.trim().toUpperCase()
        );
        if (exact) handleSelect(exact);
      }
      return;
    }

    if (!isOpen || matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className={isOpen ? "relative z-50" : "relative"}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(0);
          setIsOpen(true);
          requestAnimationFrame(() => ensureInputVisible(true));
        }}
        onFocus={() => {
          requestAnimationFrame(() => ensureInputVisible(true));
          if (value.trim().length >= 2) setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-surface-input border border-border-medium rounded-xl text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
      />

      {isOpen && matches.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg max-h-48 overflow-y-auto">
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
              <span className="font-medium text-[#7ab3ff] shrink-0 w-24">{c.course_code}</span>
              <span className="text-ink-muted truncate">{c.course_name || ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
