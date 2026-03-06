"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  titleClassName?: string;
  titleExtra?: React.ReactNode;
  size?: "default" | "large" | "planner-detail" | "xl";
  children: React.ReactNode;
}

const sizeClasses = {
  default: "max-w-[56rem] w-full max-h-[90vh] scale-[1.15] origin-center",
  large: "w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-w-none",
  "planner-detail": "w-full max-w-[98vw] max-h-[94vh] md:max-w-[77vw] md:max-h-[77vh]",
  xl: "w-full max-w-[1056px] max-h-[94vh]",
};

export function Modal({ open, onClose, title, titleClassName, titleExtra, size = "default", children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const handleClose = useEffectEvent(() => {
    onClose();
  });

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) {
      // Return focus to the element that triggered the modal
      triggerRef.current?.focus();
      triggerRef.current = null;
      return;
    }

    // Remember what had focus before opening
    triggerRef.current = document.activeElement as HTMLElement;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);

    // Focus trap — move focus into dialog
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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[16px]"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={`relative modal-aurora backdrop-blur-[20px] rounded-2xl border border-border-card shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(141,170,224,0.06),0_0_60px_rgba(255,204,0,0.04),0_0_120px_rgba(0,114,206,0.03)] ${sizeClasses[size]} overflow-y-auto z-10`}
          >
            {title && (
              <div className="relative flex items-center justify-between px-8 pt-7 pb-4 border-b border-border-subtle">
                <div className="absolute top-0 left-[5%] right-[5%] h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
                <div className="flex items-center gap-4">
                  <h3
                    id={titleId}
                    className={titleClassName || "text-2xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary"}
                  >
                    {title}
                  </h3>
                  {titleExtra}
                </div>
                {/* 44×44px touch target wraps the × glyph */}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center w-11 h-11 -mr-2 rounded-xl text-ink-faint hover:text-ink-secondary hover:bg-surface-hover transition-colors cursor-pointer"
                  aria-label="Close dialog"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="p-8">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
