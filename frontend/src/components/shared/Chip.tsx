"use client";

import { motion } from "motion/react";

interface ChipProps {
  label: string;
  onRemove?: () => void;
  variant?: "default" | "navy" | "gold";
}

const chipVariants = {
  default: "bg-[rgba(141,170,224,0.12)] text-ink-secondary",
  navy: "bg-navy/20 text-[#7ab3ff]",
  gold: "bg-gold/20 text-gold",
};

export function Chip({ label, onRemove, variant = "default" }: ChipProps) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium max-w-full overflow-hidden text-ellipsis whitespace-nowrap ${chipVariants[variant]}`}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 hover:bg-black/10 rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none cursor-pointer"
          aria-label={`Remove ${label}`}
        >
          &times;
        </button>
      )}
    </motion.span>
  );
}
