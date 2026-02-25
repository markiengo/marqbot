"use client";

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

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="progress-ring"
      aria-label={`${Math.round(centerPct)}% progress${ipPct ? ` (${Math.round(donePct)}% complete, ${Math.round(ipPct)}% in progress)` : ""}`}
      role="img"
    >
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
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--ok)"
        strokeWidth={stroke}
        strokeDasharray={circ.toFixed(3)}
        strokeDashoffset={doneOffset.toFixed(3)}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        className="transition-all duration-700"
      />
      {/* In-progress arc */}
      {ipPct > 0 && (
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--mu-gold)"
          strokeWidth={stroke}
          strokeDasharray={circ.toFixed(3)}
          strokeDashoffset={ipOffset.toFixed(3)}
          strokeLinecap="round"
          transform={`rotate(${ipRotation.toFixed(3)} ${cx} ${cx})`}
          className="transition-all duration-700"
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
