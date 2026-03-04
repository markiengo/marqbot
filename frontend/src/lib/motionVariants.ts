import type { Variants } from "motion/react";

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Spring pop — used for badges and status chips that need to feel tactile.
 * Falls back to a simple fade for reduced-motion users.
 */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.1 } },
};

/**
 * Reduced-motion safe version of fadeSlideUp — no translate, just opacity.
 * Prefer using Tailwind's motion-safe: / motion-reduce: variants directly in
 * className when possible. Use this variant set when you need JS-driven
 * AnimatePresence or whileHover that must respect the preference.
 */
export const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.25 },
  },
};
