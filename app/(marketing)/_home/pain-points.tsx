"use client";

import { motion } from "motion/react";
import { HelpCircle } from "lucide-react";

import { useReveal } from "./use-reveal";

const QUESTIONS = [
  "Bereiken we de juiste doelgroep?",
  "Waarom converteert onze website niet?",
  "Wat doen concurrenten beter?",
  "Hoe meet ik marketing-ROI?",
  "Welke kanalen werken écht?",
  "Wat is onze USP eigenlijk?",
  "Hoe stuur ik mijn marketeer aan?",
  "Investeren in SEO of SEA?",
  "Hoe krijg ik grip op marketing?",
] as const;

export function PainPoints() {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <div className="mb-10 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Herken je dit?
        </div>
        <h2
          className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-ink-high md:text-4xl"
          style={{ lineHeight: 1.15 }}
        >
          Deze vragen krijgen wij dagelijks van ondernemers.
        </h2>
        <p className="mt-3 text-base text-ink-mid">
          Blijf je zelf zitten met dit soort twijfels? Positionr geeft er in
          minuten een gefundeerd antwoord op. Geen uren met een bureau, geen
          buikgevoel.
        </p>
      </div>
      <div ref={ref} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUESTIONS.map((q, i) => (
          <motion.div
            key={q}
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
            <span className="text-sm font-medium text-ink-high">{q}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
