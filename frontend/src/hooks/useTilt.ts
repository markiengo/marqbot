"use client";

import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useMotionValue, useSpring } from "motion/react";

interface UseTiltOptions {
  maxDeg?: number;
  stiffness?: number;
  damping?: number;
}

export function useTilt(options: UseTiltOptions = {}) {
  const { maxDeg = 6, stiffness = 220, damping = 24 } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, { stiffness, damping });
  const rotateY = useSpring(rawRotateY, { stiffness, damping });

  const onMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const node = containerRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const normalizedY = ((event.clientY - rect.top) / rect.height) * 2 - 1;

    rawRotateX.set(-normalizedY * maxDeg);
    rawRotateY.set(normalizedX * maxDeg);
  };

  const onMouseLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  return { containerRef, rotateX, rotateY, onMouseMove, onMouseLeave };
}
