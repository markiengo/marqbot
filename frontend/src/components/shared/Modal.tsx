"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
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
  default: "max-w-[56rem] w-full max-h-[90vh]",
  large: "w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-w-none",
  "planner-detail": "w-full max-w-[98vw] max-h-[94vh] md:max-w-[77vw] md:max-h-[77vh]",
  xl: "w-full max-w-[1056px] max-h-[94vh]",
};

const openModalStack: string[] = [];

function addModalToStack(modalId: string): number {
  if (!openModalStack.includes(modalId)) {
    openModalStack.push(modalId);
  }
  return openModalStack.indexOf(modalId);
}

function removeModalFromStack(modalId: string) {
  const index = openModalStack.indexOf(modalId);
  if (index >= 0) {
    openModalStack.splice(index, 1);
  }
}

function isTopmostModal(modalId: string): boolean {
  return openModalStack[openModalStack.length - 1] === modalId;
}

export function Modal({ open, onClose, title, titleClassName, titleExtra, size = "default", children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const simplifyMotion = prefersReducedMotion;
  const titleId = useId();
  const modalId = useId();
  const handleClose = useEffectEvent(() => {
    onClose();
  });

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
      triggerRef.current = null;
      return;
    }

    triggerRef.current = document.activeElement as HTMLElement;
    addModalToStack(modalId);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTopmostModal(modalId)) handleClose();
    };
    document.addEventListener("keydown", handleKey);

    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      try {
        focusable[0].focus({ preventScroll: true });
      } catch {
        focusable[0].focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKey);
      removeModalFromStack(modalId);
      document.body.style.overflow = openModalStack.length > 0 ? "hidden" : "";
    };
  }, [open, modalId]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: simplifyMotion ? 0.16 : 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4"
          style={{ willChange: "opacity" }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: simplifyMotion ? 0.16 : 0.25 }}
            className="absolute inset-0 bg-[rgba(4,9,20,0.82)]"
            onClick={onClose}
            style={{ willChange: "opacity" }}
          />

          <motion.div
            ref={dialogRef}
            initial={simplifyMotion ? { opacity: 0, y: 8 } : { opacity: 0, scale: 0.97, y: 12 }}
            animate={simplifyMotion ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={simplifyMotion ? { opacity: 0, y: 8 } : { opacity: 0, scale: 0.97, y: 12 }}
            transition={simplifyMotion ? { duration: 0.18 } : { type: "spring", stiffness: 240, damping: 26 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={`relative modal-aurora ${!simplifyMotion ? "transform-gpu" : ""} rounded-2xl border border-border-card shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(141,170,224,0.06)] ${sizeClasses[size]} overflow-y-auto z-10`}
            style={{ willChange: "transform, opacity", contain: "layout paint style" }}
          >
            {title && (
              <div className="relative flex items-center justify-between border-b border-border-subtle px-4 pb-3 pt-5 sm:px-8 sm:pb-4 sm:pt-7">
                <div className="absolute left-[5%] right-[5%] top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
                <div className="flex items-center gap-4">
                  <h3
                    id={titleId}
                    className={titleClassName || "text-2xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary"}
                  >
                    {title}
                  </h3>
                  {titleExtra}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 -mr-2 cursor-pointer items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink-secondary"
                  aria-label="Close dialog"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className="p-4 sm:p-8">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
