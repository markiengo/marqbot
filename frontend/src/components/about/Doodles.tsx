"use client";

import { motion, useReducedMotion } from "motion/react";

const MARKS = [
  // ── Hero area ──
  {
    id: "rough-circle-tl",
    top: "7%", left: "4%",
    size: 48,
    rotate: -6,
    color: "rgba(255,204,0,0.13)",
    // Wobbly hand-drawn circle
    path: "M24 4c8 1 15 6 17 14s-2 16-10 20-18 2-22-5S4 15 10 8s10-5 14-4Z",
    viewBox: "0 0 48 44",
  },
  {
    id: "connector-tr",
    top: "10%", right: "6%",
    size: 80,
    rotate: 0,
    color: "rgba(0,114,206,0.11)",
    // Branch line with two offshoots
    path: "M8 40L40 20M40 20L70 10M40 20L65 36M70 10l4 0M65 36l4 2",
    viewBox: "0 0 80 48",
  },
  {
    id: "scribble-circle-l",
    top: "24%", left: "2%",
    size: 36,
    rotate: 10,
    color: "rgba(255,204,0,0.10)",
    // Double-pass rough circle
    path: "M18 3c9 0 15 6 15 15s-7 14-16 14S2 27 3 18 9 3 18 3Zm-1 2c-7 1-12 6-12 13s5 11 12 11 13-5 13-12-5-11-13-12Z",
    viewBox: "0 0 36 36",
  },
  // ── Mid section ──
  {
    id: "mind-branch-r",
    top: "46%", right: "3%",
    size: 100,
    rotate: 0,
    color: "rgba(255,204,0,0.11)",
    // Central node with 3 branches to smaller nodes
    path: "M50 30a8 8 0 1 1-1 0ZM50 22L68 8M50 22L32 6M50 38L50 56M68 8a4 4 0 1 1-1 0ZM32 6a4 4 0 1 1-1 0ZM50 56a4 4 0 1 1-1 0Z",
    viewBox: "0 0 100 68",
  },
  {
    id: "underline-sketch",
    top: "55%", left: "5%",
    size: 64,
    rotate: -3,
    color: "rgba(0,114,206,0.12)",
    // Wavy underline with a rough circle at the end
    path: "M4 16c16-4 30-2 48 0M52 16a6 6 0 1 0 1 0Z",
    viewBox: "0 0 66 28",
  },
  {
    id: "rough-oval",
    top: "60%", left: "3%",
    size: 32,
    rotate: 18,
    color: "rgba(255,204,0,0.09)",
    path: "M16 4c10-1 14 5 14 12s-5 12-14 12S2 23 3 16 6 5 16 4Z",
    viewBox: "0 0 34 32",
  },
  // ── Lower / CTA ──
  {
    id: "mind-map-bl",
    top: "76%", left: "4%",
    size: 90,
    rotate: 0,
    color: "rgba(0,114,206,0.10)",
    // Hub with branches and leaf nodes
    path: "M20 44a6 6 0 1 1-1 0ZM20 38L20 24M20 24L8 10M20 24L34 12M20 24L44 28M8 10a3.5 3.5 0 1 1-1 0ZM34 12a3.5 3.5 0 1 1-1 0ZM44 28L58 20M44 28L56 40M58 20a3 3 0 1 1-1 0ZM56 40a3 3 0 1 1-1 0Z",
    viewBox: "0 0 68 56",
  },
  {
    id: "circle-highlight-br",
    top: "82%", right: "5%",
    size: 44,
    rotate: -12,
    color: "rgba(255,204,0,0.13)",
    // Emphatic rough circle like circling something on paper
    path: "M22 4c12 0 19 8 18 18s-8 17-18 17S3 32 4 22 10 4 22 4Zm1 3c-10 0-16 7-16 15s6 14 15 14 15-5 16-14-5-15-15-15Z",
    viewBox: "0 0 44 44",
  },
  {
    id: "arrow-sketch",
    top: "90%", right: "12%",
    size: 50,
    rotate: 15,
    color: "rgba(255,204,0,0.10)",
    // Hand-drawn curved arrow
    path: "M6 34C10 14 28 6 42 12M42 12l-8-6M42 12l-4 8",
    viewBox: "0 0 50 40",
  },
  // ── Code / tech marks ──
  {
    id: "curly-braces",
    top: "38%", right: "5%",
    size: 56,
    rotate: -4,
    color: "rgba(255,204,0,0.12)",
    // Hand-drawn curly braces { }
    path: "M8 8c-4 0-6 4-6 8v4c0 3-2 4-2 4s2 1 2 4v4c0 4 2 8 6 8M48 8c4 0 6 4 6 8v4c0 3 2 4 2 4s-2 1-2 4v4c0 4-2 8-6 8",
    viewBox: "0 0 56 44",
  },
  {
    id: "angle-brackets",
    top: "18%", left: "3%",
    size: 52,
    rotate: 6,
    color: "rgba(0,114,206,0.12)",
    // Hand-drawn </> tag
    path: "M16 6L4 20l12 14M36 6l12 14-12 14M24 4l-4 34",
    viewBox: "0 0 52 42",
  },
  {
    id: "terminal-prompt",
    top: "68%", right: "4%",
    size: 60,
    rotate: -2,
    color: "rgba(255,204,0,0.11)",
    // Terminal $ _ prompt
    path: "M4 28l8-8-8-8M18 28h16M40 28h6",
    viewBox: "0 0 52 36",
  },
  {
    id: "db-cylinder",
    top: "50%", left: "2%",
    size: 40,
    rotate: 3,
    color: "rgba(0,114,206,0.10)",
    // Database cylinder
    path: "M8 10c0-4 5.5-7 12-7s12 3 12 7M8 10v20c0 4 5.5 7 12 7s12-3 12-7V10M8 18c0 3.5 5.5 6 12 6s12-2.5 12-6",
    viewBox: "0 0 40 42",
  },
  {
    id: "flowchart-diamond",
    top: "34%", left: "4%",
    size: 48,
    rotate: 0,
    color: "rgba(255,204,0,0.09)",
    // Flowchart diamond with arrow
    path: "M24 4l14 14-14 14L10 18Zm0 32v10M24 46l-4-4M24 46l4-4",
    viewBox: "0 0 48 54",
  },
  {
    id: "todo-comment",
    top: "42%", right: "8%",
    size: 64,
    rotate: -5,
    color: "rgba(0,114,206,0.11)",
    // Hand-drawn // TODO text
    path: "M4 14l4-8M4 6l4 8M12 14l4-8M12 6l4 8M24 10h32M24 18h28",
    viewBox: "0 0 64 24",
  },
  {
    id: "semicolon",
    top: "72%", left: "6%",
    size: 24,
    rotate: 8,
    color: "rgba(255,204,0,0.11)",
    // Hand-drawn semicolon ;
    path: "M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM14 16c0 2-1 4-3 6",
    viewBox: "0 0 24 26",
  },
] as const;

export function Doodles() {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[2]" aria-hidden>
      {MARKS.map((m, i) => {
        const pos: React.CSSProperties = {
          position: "absolute",
          top: m.top,
          width: m.size,
          height: m.size,
        };
        if ("left" in m && m.left) pos.left = m.left;
        if ("right" in m && m.right) pos.right = m.right;

        return (
          <motion.svg
            key={m.id}
            viewBox={m.viewBox}
            style={pos}
            className={parseFloat(m.top) < 50 ? "parallax-slow" : "parallax-fast"}
            initial={reduce ? { opacity: 0.6 } : { opacity: 0, rotate: m.rotate - 8 }}
            whileInView={reduce ? undefined : { opacity: 0.6, rotate: m.rotate }}
            viewport={{ once: true, margin: "-40px" }}
            transition={reduce ? undefined : { duration: 0.5, delay: 0.06 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            fill="none"
            stroke={m.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={m.path} />
          </motion.svg>
        );
      })}
    </div>
  );
}
