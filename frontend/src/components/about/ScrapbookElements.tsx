import { type ReactNode } from "react";

/* ── Washi Tape ─────────────────────────────────────────────────── */
interface WashiTapeProps {
  color?: "gold" | "blue";
  className?: string;
}

export function WashiTape({ color = "gold", className = "" }: WashiTapeProps) {
  return (
    <div
      className={`washi-tape ${color === "blue" ? "washi-tape-blue" : ""} ${className}`}
    />
  );
}

/* ── Polaroid Frame ─────────────────────────────────────────────── */
interface PolaroidFrameProps {
  children: ReactNode;
  caption?: string;
  rotate?: number;
  className?: string;
}

export function PolaroidFrame({
  children,
  caption,
  rotate = 0,
  className = "",
}: PolaroidFrameProps) {
  return (
    <div
      className={`polaroid-frame inline-block ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
      {caption && (
        <p className="text-center text-xs text-ink-muted mt-2 font-[family-name:var(--font-sora)]">
          {caption}
        </p>
      )}
    </div>
  );
}

/* ── Sticky Note ────────────────────────────────────────────────── */
interface StickyNoteProps {
  children: ReactNode;
  rotation?: number;
  className?: string;
}

export function StickyNote({
  children,
  rotation = 0,
  className = "",
}: StickyNoteProps) {
  return (
    <div
      className={`sticky-note p-4 ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {children}
    </div>
  );
}

/* ── Stamp Badge ────────────────────────────────────────────────── */
interface StampBadgeProps {
  text: string;
  className?: string;
}

export function StampBadge({ text, className = "" }: StampBadgeProps) {
  return <span className={`stamp-badge ${className}`}>{text}</span>;
}

/* ── Doodle Label (hand-drawn text annotation with curly arrow) ── */
interface DoodleLabelProps {
  text: string;
  arrow?: "left" | "right" | "up" | "down" | "none";
  className?: string;
  rotate?: number;
}

export function DoodleLabel({
  text,
  arrow = "none",
  className = "",
  rotate = 0,
}: DoodleLabelProps) {
  return (
    <div
      className={`pointer-events-none absolute flex items-center gap-1 ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {arrow === "left" && (
        <svg width="36" height="28" viewBox="0 0 36 28" fill="none" className="shrink-0">
          <path d="M34 4C26 6 18 18 6 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M10 10L5 16L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
      )}
      <span className="text-sm sm:text-base font-semibold italic opacity-70 whitespace-nowrap" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {text}
      </span>
      {arrow === "right" && (
        <svg width="36" height="28" viewBox="0 0 36 28" fill="none" className="shrink-0">
          <path d="M2 4C10 6 18 18 30 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M26 10L31 16L24 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
      )}
      {arrow === "down" && (
        <svg width="24" height="32" viewBox="0 0 24 32" fill="none" className="shrink-0 -ml-1">
          <path d="M4 2C8 10 16 18 12 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M7 24L12 29L16 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
      )}
      {arrow === "up" && (
        <svg width="24" height="32" viewBox="0 0 24 32" fill="none" className="shrink-0 -ml-1">
          <path d="M12 30C16 22 8 14 12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <path d="M7 8L12 3L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
      )}
    </div>
  );
}

/* ── Doodle Star ────────────────────────────────────────────────── */
interface DoodleStarProps {
  className?: string;
  size?: number;
}

export function DoodleStar({ className = "", size = 32 }: DoodleStarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.65"
      />
    </svg>
  );
}

/* ── Doodle Arrow (curly) ───────────────────────────────────────── */
interface DoodleArrowProps {
  className?: string;
  direction?: "right" | "down";
}

export function DoodleArrow({
  className = "",
  direction = "right",
}: DoodleArrowProps) {
  const rotation = direction === "down" ? 90 : 0;
  return (
    <svg
      width="64"
      height="32"
      viewBox="0 0 64 32"
      fill="none"
      className={`pointer-events-none ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M4 18C14 6 30 24 48 12L56 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M50 4L57 10L50 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}

/* ── Doodle Heart ───────────────────────────────────────────────── */
interface DoodleHeartProps {
  className?: string;
  size?: number;
  filled?: boolean;
}

export function DoodleHeart({ className = "", size = 28, filled = false }: DoodleHeartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M12 21s-7-5.3-9-9c-1.3-2.4-.5-5.8 2.5-6.5 2-.5 3.8.5 4.5 1.5.3.4.8 1.2 2 2.5 1.2-1.3 1.7-2.1 2-2.5.7-1 2.5-2 4.5-1.5 3 .7 3.8 4.1 2.5 6.5-2 3.7-9 9-9 9z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={filled ? "0.5" : "0.6"}
      />
    </svg>
  );
}

/* ── Doodle Sparkle (4-point) ───────────────────────────────────── */
interface DoodleSparkleProps {
  className?: string;
  size?: number;
}

export function DoodleSparkle({ className = "", size = 28 }: DoodleSparkleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M12 1v6M12 17v6M1 12h6M17 12h6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

/* ── Doodle Squiggle ────────────────────────────────────────────── */
interface DoodleSquiggleProps {
  className?: string;
}

export function DoodleSquiggle({ className = "" }: DoodleSquiggleProps) {
  return (
    <svg
      width="100"
      height="20"
      viewBox="0 0 100 20"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M2 10C10 2 18 18 26 10C34 2 42 18 50 10C58 2 66 18 74 10C82 2 90 18 98 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/* ── Doodle Circle (hand-drawn ring) ────────────────────────────── */
interface DoodleCircleProps {
  className?: string;
  size?: number;
}

export function DoodleCircle({ className = "", size = 44 }: DoodleCircleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <ellipse
        cx="22"
        cy="22"
        rx="18"
        ry="16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
        transform="rotate(-5 22 22)"
      />
    </svg>
  );
}

/* ── Doodle Smiley ──────────────────────────────────────────────── */
interface DoodleSmileyProps {
  className?: string;
  size?: number;
}

export function DoodleSmiley({ className = "", size = 36 }: DoodleSmileyProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <circle cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.55" />
      <circle cx="24" cy="15" r="1.5" fill="currentColor" opacity="0.55" />
      <path d="M11 22c2 3 5 4.5 7 4.5s5-1.5 7-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/* ── Doodle Leaf / Branch ───────────────────────────────────────── */
interface DoodleLeafProps {
  className?: string;
  size?: number;
}

export function DoodleLeaf({ className = "", size = 32 }: DoodleLeafProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 40"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <path d="M16 38V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M16 28C12 26 8 22 10 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M16 22C20 20 24 16 22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M16 16C12 14 10 10 12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M16 12C19 10 22 7 20 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/* ── Doodle Underline Swoosh ────────────────────────────────────── */
interface DoodleUnderlineProps {
  className?: string;
  width?: number;
}

export function DoodleUnderline({ className = "", width = 120 }: DoodleUnderlineProps) {
  return (
    <svg
      width={width}
      height="8"
      viewBox="0 0 120 8"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M2 5C20 2 40 6 60 3C80 0 100 6 118 3"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/* ── Doodle X Mark ──────────────────────────────────────────────── */
interface DoodleXProps {
  className?: string;
  size?: number;
}

export function DoodleX({ className = "", size = 20 }: DoodleXProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      <path
        d="M4 4l12 12M16 4L4 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
