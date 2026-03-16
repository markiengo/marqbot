"use client";

import { motion } from "motion/react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "gold" | "ink";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "bg-navy text-white hover:bg-navy-light shadow-sm",
  secondary:
    "bg-surface-card text-ink-primary border border-border-medium hover:bg-surface-hover shadow-sm",
  ghost:
    "text-ink-secondary hover:bg-surface-hover",
  gold:
    "bg-gradient-to-r from-gold via-gold-light to-gold text-navy-dark font-semibold hover:from-gold-light hover:via-gold hover:to-gold-light shadow-sm shadow-gold/20",
  ink:
    "bg-[linear-gradient(180deg,rgba(0,51,102,0.96),rgba(0,31,63,0.96))] text-white border border-gold/25 hover:bg-[linear-gradient(180deg,rgba(0,74,153,0.96),rgba(0,51,102,0.96))] shadow-sm shadow-black/20",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-7 py-3.5 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 15 } }}
      whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 400, damping: 15 } }}
      className={`inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
