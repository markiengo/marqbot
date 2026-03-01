interface AnchorLineProps {
  variant?: "gold" | "blue" | "fade";
  className?: string;
}

export function AnchorLine({ variant = "gold", className = "" }: AnchorLineProps) {
  const cls =
    variant === "gold"
      ? "anchor-gold"
      : variant === "blue"
        ? "anchor-blue"
        : "anchor-fade";
  return <div className={`w-full max-w-xs mx-auto ${cls} ${className}`} />;
}
