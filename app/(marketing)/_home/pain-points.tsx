"use client";

import { motion } from "motion/react";
import { HelpCircle } from "lucide-react";

import { useReveal } from "./use-reveal";
import type { PainPointsKey } from "./keys";

const QUESTION_KEYS: readonly PainPointsKey[] = [
  "homepage.painpoints.q.1",
  "homepage.painpoints.q.2",
  "homepage.painpoints.q.3",
  "homepage.painpoints.q.4",
  "homepage.painpoints.q.5",
  "homepage.painpoints.q.6",
  "homepage.painpoints.q.7",
  "homepage.painpoints.q.8",
  "homepage.painpoints.q.9",
];

export function PainPoints({
  content,
}: {
  content: Record<PainPointsKey, string>;
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <div className="mb-10 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {content["homepage.painpoints.eyebrow"]}
        </div>
        <h2
          className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-ink-high md:text-4xl"
          style={{ lineHeight: 1.15 }}
        >
          {content["homepage.painpoints.title"]}
        </h2>
        <p className="mt-3 text-base text-ink-mid">
          {content["homepage.painpoints.intro"]}
        </p>
      </div>
      <div ref={ref} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUESTION_KEYS.map((qKey, i) => (
          <motion.div
            key={qKey}
            initial={{ opacity: 0, y: 8 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{
              type: "spring",
              bounce: 0,
              duration: 0.35,
              delay: i * 0.04,
            }}
            className="flex items-start gap-3 rounded-xl border border-black/[0.06] bg-white/70 p-4"
          >
            <HelpCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              strokeWidth={1.75}
            />
            <span className="text-sm font-medium text-ink-high">
              {content[qKey]}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
