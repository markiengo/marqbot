"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { useReducedEffects } from "@/hooks/useReducedEffects";

export function LandingFinalCTA() {
  const reduceEffects = useReducedEffects();
  const [wakeBackground, setWakeBackground] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const targetPos = useRef({ x: 0.5, y: 0.5, opacity: 0 });
  const currentPos = useRef({ x: 0.5, y: 0.5, opacity: 0 });

  useEffect(() => {
    if (reduceEffects) return;
    const tick = () => {
      const t = targetPos.current;
      const c = currentPos.current;
      c.x += (t.x - c.x) * 0.12;
      c.y += (t.y - c.y) * 0.12;
      c.opacity += (t.opacity - c.opacity) * 0.1;
      const glow = glowRef.current;
      if (glow) {
        glow.style.setProperty("--gx", `${c.x * 100}%`);
        glow.style.setProperty("--gy", `${c.y * 100}%`);
        glow.style.opacity = String(c.opacity);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [reduceEffects]);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduceEffects) return;
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    targetPos.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      opacity: 1,
    };
  };

  const handlePointerLeave = () => { if (!reduceEffects) targetPos.current.opacity = 0; };

  const handleWakeStart = () => { if (!reduceEffects) setWakeBackground(true); };
  const handleWakeEnd = () => setWakeBackground(false);

  return (
    <section
      ref={sectionRef}
      data-testid="landing-final-cta"
      data-wake={wakeBackground ? "true" : "false"}
      className="relative overflow-hidden bg-[linear-gradient(180deg,#071426_0%,#081b31_100%)] pb-10 pt-18 sm:pb-12 sm:pt-22"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,204,0,0.12),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(0,114,206,0.10),transparent_30%)]" />
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle 16rem at var(--gx, 50%) var(--gy, 50%), rgba(255,204,0,0.22), transparent 50%), radial-gradient(circle 28rem at calc(var(--gx, 50%) + 5rem) calc(var(--gy, 50%) - 4rem), rgba(0,114,206,0.14), transparent 58%)",
          filter: "blur(20px)",
          opacity: 0,
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          wakeBackground ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-[-10%] bg-[radial-gradient(circle_at_16%_72%,rgba(255,204,0,0.20),transparent_30%),radial-gradient(circle_at_84%_20%,rgba(0,114,206,0.20),transparent_30%),radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_22%)]" />
      </div>

      <div className="relative mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <motion.div
          initial={reduceEffects ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: reduceEffects ? 0.18 : 0.46 }}
          className={`relative overflow-hidden rounded-[2.3rem] border px-6 py-12 text-center transition-all duration-500 sm:px-10 sm:py-16 ${
            wakeBackground
              ? "border-gold/22 bg-[linear-gradient(180deg,rgba(10,31,58,0.96),rgba(9,25,45,0.98))] shadow-[0_36px_120px_rgba(0,0,0,0.32),0_0_80px_rgba(255,204,0,0.10)]"
              : "border-white/10 bg-[linear-gradient(180deg,rgba(10,27,50,0.95),rgba(8,21,39,0.98))] shadow-[0_30px_100px_rgba(0,0,0,0.28)]"
          }`}
        >
          <div className="landing-hero-grid absolute inset-0 opacity-[0.06]" />
          <div className="pointer-events-none absolute left-1/2 top-7 h-px w-56 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,204,0,0.95),transparent)]" />
          <div className="pointer-events-none absolute bottom-7 left-1/2 h-px w-56 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,204,0,0.55),transparent)]" />

          <div className="relative">
            <h2 className="mx-auto max-w-[12ch] text-[clamp(2.9rem,7vw,5.8rem)] font-bold leading-[0.92] tracking-[-0.055em] text-white">
              Plan your semesters.
              <span className="block text-gold-light">Close the tabs.</span>
            </h2>

            <p className="mx-auto mt-5 max-w-[34rem] text-[1.06rem] leading-relaxed text-slate-300">
              Takes a few minutes. No account needed.
            </p>

            <div className="mt-8 flex justify-center">
              <Button
                asChild
                variant="gold"
                size="lg"
                className="min-h-[78px] min-w-[280px] rounded-[1.9rem] px-10 text-[clamp(1.45rem,3vw,2rem)] font-semibold shadow-[0_24px_70px_rgba(0,0,0,0.30)]"
                onMouseEnter={handleWakeStart}
                onMouseLeave={handleWakeEnd}
                onFocus={handleWakeStart}
                onBlur={handleWakeEnd}
              >
                <Link href="/onboarding">
                  Get My Plan
                </Link>
              </Button>
            </div>

            <p className="mt-6 text-sm text-slate-400">
              Double-check with your advisor before registration.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
