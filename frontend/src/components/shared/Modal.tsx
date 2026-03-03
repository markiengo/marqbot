"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  titleClassName?: string;
  size?: "default" | "large" | "planner-detail" | "xl";
  children: React.ReactNode;
}

const sizeClasses = {
  default: "max-w-2xl w-full max-h-[85vh]",
  large: "w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-w-none",
  "planner-detail": "w-full max-w-[95vw] max-h-[90vh] md:max-w-[70vw] md:max-h-[70vh]",
  xl: "w-full max-w-[960px] max-h-[90vh]",
};

export function Modal({ open, onClose, title, titleClassName, size = "default", children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const handleClose = useEffectEvent(() => {
    onClose();
  });

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);

    // Focus trap
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length) {
        try {
          focusable[0].focus({ preventScroll: true });
        } catch {
          focusable[0].focus();
        }
      }
    }

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative bg-surface-card rounded-2xl shadow-2xl border border-border-subtle ${sizeClasses[size]} overflow-y-auto z-10`}
          >
            {title && (
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border-subtle">
                <h3 className={titleClassName || "text-lg font-semibold font-[family-name:var(--font-sora)] text-ink-primary"}>
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-ink-faint hover:text-ink-secondary text-xl leading-none p-1 cursor-pointer"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
