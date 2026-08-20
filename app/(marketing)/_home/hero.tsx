"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";

import { MockupReport } from "./mockup-report";
import type { HeroKey } from "./keys";

export function Hero({ content }: { content: Record<HeroKey, string> }) {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="pointer-events-none absolute -left-40 top-40 -z-10 h-[480px] w-[480px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-20 -z-10 h-[400px] w-[400px] rounded-full bg-coral/[0.04] blur-[100px]" />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-12 lg:gap-10 lg:py-32">
        <div className="min-w-0 lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-xs font-medium text-ink-mid"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            {content["homepage.hero.chip"]}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.06 }}
            className="mt-6 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high text-balance md:text-5xl"
            style={{
              lineHeight: 1.05,
              fontOpticalSizing: "auto",
            }}
          >
            {content["homepage.hero.title"]}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink-mid"
          >
            {content["homepage.hero.subtitle"]}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.18 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/gratis-check"
              className="inline-flex items-center justify-center rounded-lg bg-coral px-5 py-3 text-[15px] font-semibold tracking-[0.01em] text-white transition-colors hover:bg-coral-hover"
            >
              {content["homepage.hero.cta_primary_label"]}
            </Link>
            <Link
              href="/prijzen"
              className="inline-flex items-center justify-center px-2 py-3 text-[15px] font-semibold text-ink-high underline-offset-4 hover:underline"
            >
              {content["homepage.hero.cta_secondary_label"]}
            </Link>
          </motion.div>

          <p className="mt-3 text-xs text-ink-mut">
            {content["homepage.hero.micro_copy"]}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4, delay: 0.1 }}
          className="lg:col-span-5 lg:-mt-4"
        >
          <MockupReport />
        </motion.div>
      </div>
    </section>
  );
}
