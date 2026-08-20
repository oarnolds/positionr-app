"use client";

import { motion } from "motion/react";
import { Users, Target, Grid3x3, type LucideIcon } from "lucide-react";

import { useReveal } from "./use-reveal";
import type { FoundationsKey } from "./keys";

const CARDS: ReadonlyArray<{
  Icon: LucideIcon;
  labelKey: FoundationsKey;
  titleKey: FoundationsKey;
  bodyKey: FoundationsKey;
}> = [
  {
    Icon: Users,
    labelKey: "homepage.foundations.card.cialdini.label",
    titleKey: "homepage.foundations.card.cialdini.title",
    bodyKey: "homepage.foundations.card.cialdini.body",
  },
  {
    Icon: Target,
    labelKey: "homepage.foundations.card.ritson.label",
    titleKey: "homepage.foundations.card.ritson.title",
    bodyKey: "homepage.foundations.card.ritson.body",
  },
  {
    Icon: Grid3x3,
    labelKey: "homepage.foundations.card.kotler.label",
    titleKey: "homepage.foundations.card.kotler.title",
    bodyKey: "homepage.foundations.card.kotler.body",
  },
] as const;

export function Foundations({
  content,
}: {
  content: Record<FoundationsKey, string>;
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  return (
    <section className="bg-cream-tint/40 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {content["homepage.foundations.eyebrow"]}
          </div>
          <h2
            className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
            style={{ lineHeight: 1.1 }}
          >
            {content["homepage.foundations.title"]}
          </h2>
          <p className="mt-4 text-lg text-ink-mid">
            {content["homepage.foundations.intro"]}
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.labelKey}
              initial={{ opacity: 0, y: 12 }}
              animate={revealed ? { opacity: 1, y: 0 } : {}}
              transition={{
                type: "spring",
                bounce: 0,
                duration: 0.35,
                delay: i * 0.08,
              }}
              className="rounded-2xl bg-white p-8 shadow-sm shadow-black/5"
            >
              <c.Icon className="h-10 w-10 text-primary" strokeWidth={1.5} />
              <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-mut">
                {content[c.labelKey]}
              </div>
              <h3 className="mt-1 font-display text-xl font-bold text-ink-high">
                {content[c.titleKey]}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-mid">
                {content[c.bodyKey]}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
