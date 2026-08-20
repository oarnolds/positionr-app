"use client";

import { motion } from "motion/react";

import { useReveal } from "./use-reveal";
import type { HowItWorksKey } from "./keys";

type StepKind = "form" | "progress" | "results";

const STEP_META: ReadonlyArray<{
  n: number;
  titleKey: HowItWorksKey;
  bodyKey: HowItWorksKey;
  kind: StepKind;
}> = [
  {
    n: 1,
    titleKey: "homepage.howitworks.step.1.title",
    bodyKey: "homepage.howitworks.step.1.body",
    kind: "form",
  },
  {
    n: 2,
    titleKey: "homepage.howitworks.step.2.title",
    bodyKey: "homepage.howitworks.step.2.body",
    kind: "progress",
  },
  {
    n: 3,
    titleKey: "homepage.howitworks.step.3.title",
    bodyKey: "homepage.howitworks.step.3.body",
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

function Row({
  n,
  title,
  body,
  kind,
  reverse,
}: {
  n: number;
  title: string;
  body: string;
  kind: StepKind;
  reverse: boolean;
}) {
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
          {n}
        </div>
        <h3 className="font-display text-2xl font-bold text-ink-high md:text-3xl">
          {title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-ink-mid">{body}</p>
      </div>
      <div
        className={`lg:col-span-6 ${
          reverse ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-7"
        } ${rotation}`}
      >
        <StepScreenshot kind={kind} />
      </div>
    </motion.div>
  );
}

export function HowItWorks({
  content,
}: {
  content: Record<HowItWorksKey, string>;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <div className="mb-16 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {content["homepage.howitworks.eyebrow"]}
        </div>
        <h2
          className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl"
          style={{ lineHeight: 1.1 }}
        >
          {content["homepage.howitworks.title"]}
        </h2>
      </div>
      <div className="space-y-20">
        {STEP_META.map((s, i) => (
          <Row
            key={s.n}
            n={s.n}
            title={content[s.titleKey]}
            body={content[s.bodyKey]}
            kind={s.kind}
            reverse={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}
