interface TagProps {
  children: React.ReactNode;
  variant?: "bucket" | "secondary" | "gold" | "warn";
}

const tagVariants = {
  bucket: "bg-navy/20 text-[#7ab3ff]",
  secondary: "bg-[rgba(141,170,224,0.12)] text-ink-secondary",
  gold: "bg-gold/20 text-gold",
  warn: "bg-warn-light text-warn",
};

export function Tag({ children, variant = "bucket" }: TagProps) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${tagVariants[variant]}`}
    >
      {children}
    </span>
  );
}
