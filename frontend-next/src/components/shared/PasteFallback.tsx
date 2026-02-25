"use client";

import { useState } from "react";
import type { Course } from "@/lib/types";

interface PasteFallbackProps {
  courses: Course[];
  onAdd: (code: string) => void;
  label?: string;
}

export function PasteFallback({ courses, onAdd, label = "Paste courses" }: PasteFallbackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const catalogMap = new Map(
    courses.map((c) => [c.course_code.toUpperCase(), c.course_code]),
  );

  const handleApply = () => {
    const tokens = text
      .split(/[,\n;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const notFound: string[] = [];
    tokens.forEach((token) => {
      const norm = token
        .toUpperCase()
        .replace(/\s*-\s*/, " ")
        .replace(/([A-Z]+)\s*(\d{4})/, "$1 $2");
      const canonical = catalogMap.get(norm);
      if (canonical) {
        onAdd(canonical);
      } else {
        notFound.push(token);
      }
    });

    setText("");
    setIsOpen(false);
    setErrors(notFound);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gold hover:underline cursor-pointer"
      >
        {label}
      </button>

      {isOpen && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste course codes separated by commas, newlines, or semicolons..."
            className="w-full px-3 py-2 bg-surface-input border border-border-medium rounded-xl text-sm text-ink-primary placeholder:text-ink-faint h-20 resize-none focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <button
            type="button"
            onClick={handleApply}
            className="px-3 py-1.5 bg-navy text-white text-xs rounded-lg hover:bg-navy-light cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}

      {errors.length > 0 && (
        <p className="text-xs text-bad">
          Not found in catalog: {errors.join(", ")}
        </p>
      )}
    </div>
  );
}
