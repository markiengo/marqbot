"use client";

import { useState, useRef } from "react";
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

  const matches =
    value.trim().length >= 2
      ? filterCourses(value, new Set(), courses)
      : [];

  const handleSelect = (course: Course) => {
    onChange(course.course_code);
    setIsOpen(false);
    onSelect?.(course);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      onChange("");
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

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length >= 2) setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-surface-input border border-border-medium rounded-xl text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
      />

      {isOpen && matches.length > 0 && (
        <div className="absolute z-40 w-full mt-1 bg-surface-card border border-border-medium rounded-xl shadow-lg max-h-48 overflow-y-auto">
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
    </div>
  );
}
