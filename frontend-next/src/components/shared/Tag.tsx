interface TagProps {
  children: React.ReactNode;
  variant?: "bucket" | "secondary" | "gold" | "warn" | "bcc";
}

const tagVariants = {
  bucket: "bg-[#143e74] text-[#d6e8ff] border border-[#3d6ca4]",
  secondary: "bg-[rgba(141,170,224,0.16)] text-ink-primary border border-border-subtle",
  gold: "bg-gold/22 text-gold border border-gold/50",
  warn: "bg-warn-light text-warn",
  bcc: "bg-gold text-navy-dark font-semibold border border-gold-light",
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
