interface SkeletonProps {
  className?: string;
  label?: string;
}

export function Skeleton({ className = "", label = "Loading..." }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={`rounded-lg ${className}`}
      style={{
        background: "linear-gradient(90deg, var(--color-surface-raised) 25%, var(--color-surface-card) 50%, var(--color-surface-raised) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
      }}
    />
  );
}
