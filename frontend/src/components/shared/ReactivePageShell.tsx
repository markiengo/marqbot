"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useReducedEffects } from "@/hooks/useReducedEffects";

type ReactivePageShellProps = {
  children: ReactNode;
  className?: string;
};

export function ReactivePageShell({ children, className = "" }: ReactivePageShellProps) {
  const reduceEffects = useReducedEffects();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0, opacity: 0 });
  const currentRef = useRef({ x: 0, y: 0, opacity: 0 });

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || reduceEffects) return;

    const tick = () => {
      const current = currentRef.current;
      const target = targetRef.current;

      current.x += (target.x - current.x) * 0.14;
      current.y += (target.y - current.y) * 0.14;
      current.opacity += (target.opacity - current.opacity) * 0.12;

      shell.style.setProperty("--page-trace-x", `${current.x}px`);
      shell.style.setProperty("--page-trace-y", `${current.y}px`);
      shell.style.setProperty("--page-trace-opacity", `${current.opacity}`);

      frameRef.current = window.requestAnimationFrame(tick);
    };

    const rect = shell.getBoundingClientRect();
    targetRef.current = {
      x: rect.width * 0.5,
      y: Math.min(320, rect.height * 0.16),
      opacity: 0.45,
    };
    currentRef.current = { ...targetRef.current };

    shell.style.setProperty("--page-trace-x", `${currentRef.current.x}px`);
    shell.style.setProperty("--page-trace-y", `${currentRef.current.y}px`);
    shell.style.setProperty("--page-trace-opacity", `${currentRef.current.opacity}`);

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [reduceEffects]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceEffects) return;
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    targetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      opacity: 1,
    };
  };

  const handlePointerLeave = () => {
    if (reduceEffects) return;
    targetRef.current.opacity = 0.3;
  };

  return (
    <div
      ref={shellRef}
      data-cta-reactive="true"
      className={`page-cta-reactive ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  );
}
