interface HashMarkProps {
  children: React.ReactNode;
  className?: string;
}

export function HashMark({ children, className = "" }: HashMarkProps) {
  return <span className={`hash-mark ${className}`}>{children}</span>;
}
