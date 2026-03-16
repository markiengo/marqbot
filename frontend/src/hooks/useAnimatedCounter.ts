"use client";

import { useEffect, useRef, useState } from "react";

interface UseAnimatedCounterOptions {
  end: number;
  duration?: number;
  suffix?: string;
  startOnView?: boolean;
}

export function useAnimatedCounter({
  end,
  duration = 1200,
  suffix = "",
  startOnView = true,
}: UseAnimatedCounterOptions) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [display, setDisplay] = useState(
    reducedMotion ? `${end.toLocaleString()}${suffix}` : `0${suffix}`,
  );
  const [pop, setPop] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reducedMotion) return;

    const el = ref.current;
    if (!el || !startOnView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;

        const startTime = performance.now();
        const tick = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // ease-out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(eased * end);
          setDisplay(`${current.toLocaleString()}${suffix}`);
          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            setDisplay(`${end.toLocaleString()}${suffix}`);
            setPop(true);
            setTimeout(() => setPop(false), 300);
          }
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration, suffix, startOnView, reducedMotion]);

  return { ref, display, pop };
}
