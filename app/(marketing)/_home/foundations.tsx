"use client";

import { motion } from "motion/react";
import { Users, Target, Grid3x3 } from "lucide-react";

import { useReveal } from "./use-reveal";

const CARDS = [
  {
    label: "Cialdini",
    title: "Waarom mensen 'ja' zeggen.",
    body: "Zes principes van invloed (reciprociteit, sociale bewijskracht, autoriteit, sympathie, schaarste, commitment), gebruikt om je propositie en CTA's te toetsen.",
    Icon: Users,
  },
  {
    label: "Mark Ritson",
    title: "Diagnose vóór creatie.",
    body: "Wij kijken eerst naar je categorie, doelgroep en positionering. Pas daarna naar tactiek. Zo werken de sterkste adverteerders ook.",
    Icon: Target,
  },
  {
    label: "Philip Kotler",
    title: "De vier P's, up-to-date.",
    body: "Product, prijs, plaats, promotie, met de aanvullingen uit Kotler's latere werk over CX en H2H (human-to-human).",
    Icon: Grid3x3,
  },
] as const;

export function Foundations() {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  return (
    <section className="bg-cream-tint/40 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            De basis.
          </div>
          <h2
            className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
            style={{ lineHeight: 1.1 }}
          >
            Geen buikgevoel, maar 60 jaar marketingwetenschap.
          </h2>
          <p className="mt-4 text-lg text-ink-mid">
            Elke aanbeveling leunt op raamwerken die op universiteiten en bij
            de sterkste bureaus dagelijks in de praktijk zitten. Wij vertalen
            ze naar jouw situatie.
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.label}
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
                {c.label}
              </div>
              <h3 className="mt-1 font-display text-xl font-bold text-ink-high">
                {c.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-mid">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
