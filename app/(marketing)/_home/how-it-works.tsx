"use client";

import { motion } from "motion/react";

import { useReveal } from "./use-reveal";

type StepKind = "form" | "progress" | "results";

type Step = {
  n: number;
  title: string;
  body: string;
  kind: StepKind;
};

const STEPS: readonly Step[] = [
  {
    n: 1,
    title: "Stel je vraag of upload je URL",
    body: "Kies een module — Website Check, ICP-analyse, Concurrentieanalyse — en geef ons je bedrijf. Meer heb je niet nodig.",
    kind: "form",
  },
  {
    n: 2,
    title: "Onze AI analyseert je situatie",
    body: "In ± 2 minuten combineren we jouw input met wetenschappelijk gefundeerde raamwerken (Cialdini, Ritson, Kotler). Geen algoritme-magie — je ziet exact wat we doen.",
    kind: "progress",
  },
  {
    n: 3,
    title: "Krijg concrete, geprioriteerde acties",
    body: "Geen 40-pagina rapport dat op de plank belandt. Vijf acties met impact-score, direct toepasbaar deze week.",
    kind: "results",
  },
] as const;

function StepScreenshot({ kind }: { kind: StepKind }) {
  return (
    <div className="min-h-[280px] rounded-xl border border-black/[0.08] bg-white p-6 shadow-2xl shadow-black/10">
      {kind === "form" && (
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Gratis Website Check
          </div>
          <div className="font-display text-xl font-bold text-ink-high">
            Wat vind je van jouw website?
          </div>
          <label className="block">
            <span className="text-sm text-ink-mid">Jouw URL</span>
            <div className="mt-1 rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2 text-sm text-ink-high">
              https://voorbeeldbv.nl
            </div>
          </label>
          <div className="rounded-lg bg-coral px-4 py-2 text-center text-sm font-semibold text-white">
            Start de analyse
          </div>
        </div>
      )}
      {kind === "progress" && (
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Bezig met analyseren…
          </div>
          <div className="font-display text-xl font-bold text-ink-high">
            ± 90 seconden te gaan
          </div>
          <div className="space-y-2">
            {[
              { s: "Website gescraped", done: true },
              { s: "Content geanalyseerd", done: true },
              { s: "Aanbevelingen samengesteld", done: false },
            ].map((row) => (
              <div key={row.s} className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    row.done ? "bg-mint" : "animate-pulse bg-primary"
                  }`}
                />
                <span className={row.done ? "text-ink-mid line-through" : "text-ink-high"}>
                  {row.s}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {kind === "results" && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Top 5 acties
          </div>
          {[
            { impact: "hoog", txt: "Maak één primaire CTA boven de vouw" },
            { impact: "hoog", txt: "Voeg drie concrete klantcases toe" },
            { impact: "middel", txt: "Comprimeer mobiele beelden" },
          ].map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-black/[0.06] p-2"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  a.impact === "hoog"
                    ? "bg-primary text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                {a.impact}
              </span>
              <span className="text-sm text-ink-high">{a.txt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ step, reverse }: { step: Step; reverse: boolean }) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const rotation = reverse ? "lg:rotate-[1deg]" : "lg:rotate-[-1deg]";
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={revealed ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12"
    >
      <div className={`lg:col-span-5 ${reverse ? "lg:col-start-8 lg:row-start-1" : ""}`}>
        <div className="mb-3 font-display text-6xl font-bold text-primary">
          {step.n}
        </div>
        <h3 className="font-display text-2xl font-bold text-ink-high md:text-3xl">
          {step.title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-ink-mid">{step.body}</p>
      </div>
      <div
        className={`lg:col-span-6 ${
          reverse ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-7"
        } ${rotation}`}
      >
        <StepScreenshot kind={step.kind} />
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <div className="mb-16 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Zo werkt het.
        </div>
        <h2
          className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
          style={{ lineHeight: 1.1 }}
        >
          Van vraag tot toepasbaar antwoord in drie stappen.
        </h2>
      </div>
      <div className="space-y-20">
        {STEPS.map((s, i) => (
          <Row key={s.n} step={s} reverse={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
