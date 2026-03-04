"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";

interface ProgressRingProps {
  pct: number;
  size?: number;
  stroke?: number;
  inProgressPct?: number;
  displayPct?: number | null;
}

export function ProgressRing({
  pct,
  size = 120,
  stroke = 10,
  inProgressPct = 0,
  displayPct = null,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const donePct = Math.min(100, Math.max(0, Number(pct) || 0));
  const ipPctRaw = Math.min(100, Math.max(0, Number(inProgressPct) || 0));
  const ipPct = Math.max(0, Math.min(100 - donePct, ipPctRaw));
  const centerPctRaw = displayPct == null ? donePct : Number(displayPct);
  const centerPct = Math.min(
    100,
    Math.max(0, Number.isFinite(centerPctRaw) ? centerPctRaw : donePct),
  );
  const doneOffset = circ * (1 - donePct / 100);
  const ipOffset = circ * (1 - ipPct / 100);
  const ipRotation = -90 + donePct * 3.6;
  const cx = size / 2;

  // Animated stroke offsets via springs — guarded in useEffect so they
  // only fire when the target value actually changes, not on every render.
  const doneSpring = useSpring(circ, { stiffness: 60, damping: 20 });
  const ipSpring = useSpring(circ, { stiffness: 60, damping: 20 });
  useEffect(() => { doneSpring.set(doneOffset); }, [doneSpring, doneOffset]);
  useEffect(() => { ipSpring.set(ipOffset); }, [ipSpring, ipOffset]);
  const doneAnimated = useTransform(doneSpring, (v) => v.toFixed(3));
  const ipAnimated = useTransform(ipSpring, (v) => v.toFixed(3));

  const filterId = `glow-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="progress-ring"
      aria-label={`${Math.round(centerPct)}% progress${ipPct ? ` (${Math.round(donePct)}% complete, ${Math.round(ipPct)}% in progress)` : ""}`}
      role="img"
    >
      <defs>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Background track */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--line)"
        strokeWidth={stroke}
      />
      {/* Completed arc */}
      <motion.circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--ok)"
        strokeWidth={stroke}
        strokeDasharray={circ.toFixed(3)}
        strokeDashoffset={doneAnimated}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        filter={donePct > 0 ? `url(#${filterId})` : undefined}
      />
      {/* In-progress arc */}
      {ipPct > 0 && (
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--mu-gold)"
          strokeWidth={stroke}
          strokeDasharray={circ.toFixed(3)}
          strokeDashoffset={ipAnimated}
          strokeLinecap="round"
          transform={`rotate(${ipRotation.toFixed(3)} ${cx} ${cx})`}
        />
      )}
      {/* Center text */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="ring-pct"
      >
        {Math.round(centerPct)}%
      </text>
    </svg>
  );
}
