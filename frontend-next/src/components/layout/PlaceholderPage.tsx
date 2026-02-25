"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";

interface PlaceholderPageProps {
  title: string;
  description: string;
  coverImage: string;
}

export function PlaceholderPage({ title, description, coverImage }: PlaceholderPageProps) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <Image
        src={coverImage}
        alt=""
        fill
        className="object-cover"
        priority
      />

      {/* Dark overlay with blur */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(7,18,39,0.65)] to-[rgba(7,18,39,0.75)] backdrop-blur-[8px] backdrop-saturate-[115%]" />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-2xl mx-auto space-y-6">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-block px-4 py-1.5 bg-gold/20 text-gold rounded-full text-xs font-semibold uppercase tracking-widest"
        >
          Coming Soon
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold font-[family-name:var(--font-sora)] text-white"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}
        >
          {title}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="w-16 h-1 bg-gold rounded-full mx-auto"
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-lg text-ink-secondary max-w-lg mx-auto leading-relaxed"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Link href="/planner">
            <Button variant="gold" size="lg">
              Go to Planner
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
