# Homepage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** herbouw `app/(marketing)/page.tsx` volgens spec `docs/superpowers/specs/2026-08-19-homepage-redesign-design.md` — warm-vertrouwd MoneyBird-stijl met Apple-fluid principes, alleen de homepage, met behoud van bestaande copy.

**Architecture:** één marketing-`page.tsx` orchestreert 8 secties (Nav bestaat al in `(marketing)/layout.tsx`, wel herstylen); elke sectie krijgt een eigen component in `app/(marketing)/_home/`. Motion via `motion` (successor van framer-motion, kleiner). Fonts via `next/font/google`. Screenshots in de eerste PR als inline SVG-mockups (later te vervangen door echte renders).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v3 (uitgebreid met crème + koraal), `next/font/google` (Inter + Fraunces), `motion` v11, Lucide-icons (bestaand).

---

### Task 1: Tailwind config uitbreiden met warm palet

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Voeg kleuren toe aan `tailwind.config.ts`**

Zoek `theme.extend.colors` en breid uit:

```ts
theme: {
  extend: {
    colors: {
      // Homepage-warm palet (spec 1.1)
      cream: {
        DEFAULT: "#FBF9F5",
        tint: "#F5EFE4",
      },
      coral: {
        DEFAULT: "#E56A50",
        hover: "#D25940",
      },
      mint: {
        DEFAULT: "#6DB396",
      },
      ink: {
        high: "#1A1A1F",
        mid: "#4A4A55",
        mut: "#8A8A95",
      },
      // ...bestaande extend blijft
    },
  },
},
```

- [ ] **Step 2: Primary iets warmer maken in `app/globals.css`**

Zoek `--primary: 262 83% 58%;` en vervang door:

```css
--primary: 262 55% 55%;
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
```
Verwacht: geen build errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add tailwind.config.ts app/globals.css && git commit -m "feat(marketing): warm palet — cream/coral/mint/ink + minder verzadigd paars"
```

---

### Task 2: Fraunces-font toevoegen via next/font

**Files:**
- Modify: `app/layout.tsx`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Voeg Fraunces toe in `app/layout.tsx`**

Boven de bestaande Inter-import:

```ts
import { Inter, Fraunces } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});
```

Voeg `fraunces.variable` toe aan de body-className naast `inter.variable`.

- [ ] **Step 2: Voeg `fontFamily` toe in Tailwind config**

In `theme.extend`:

```ts
fontFamily: {
  sans: ["var(--font-inter)", "system-ui", "sans-serif"],
  display: ["var(--font-fraunces)", "Georgia", "serif"],
},
```

- [ ] **Step 3: Build check**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add app/layout.tsx tailwind.config.ts && git commit -m "feat(marketing): Fraunces display-font naast Inter via next/font"
```

---

### Task 3: motion-library installeren + reveal-hook

**Files:**
- Create: `app/(marketing)/_home/use-reveal.ts`
- Modify: `package.json`

- [ ] **Step 1: Install motion**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm add motion
```

- [ ] **Step 2: Reveal-hook maken**

```ts
// app/(marketing)/_home/use-reveal.ts
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * IntersectionObserver-hook voor één-shot scroll-reveals.
 * Element krijgt `revealed` state true zodra ≥ ~15% in view komt.
 * Blijft dan true — geen "re-hide" bij terugscrollen.
 * Respecteert prefers-reduced-motion door meteen true te zetten.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, revealed };
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add package.json pnpm-lock.yaml 'app/(marketing)/_home/use-reveal.ts' && git commit -m "feat(marketing): motion-dep + useReveal hook voor scroll-reveals"
```

---

### Task 4: Marketing nav → translucent materiaal

**Files:**
- Modify: `app/(marketing)/layout.tsx` (of waar de nav zit — grep eerst)

- [ ] **Step 1: Grep waar de nav gedefinieerd is**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && grep -rln "backdrop-filter\|navigatie\|<nav" 'app/(marketing)' | head -5
```

- [ ] **Step 2: Pas nav-styling aan**

Vervang de huidige nav-`className` door:

```tsx
<nav className="sticky top-0 z-40 border-b border-black/[0.06] bg-cream/70 backdrop-blur-xl saturate-150 supports-[not_(backdrop-filter:blur(0))]:bg-cream/95">
  {/* content */}
</nav>
```

Voeg `@supports`-fallback toe: als `backdrop-filter` niet ondersteund is, valt hij terug op solid `bg-cream/95`.

- [ ] **Step 3: Verify in dev-server + build**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/layout.tsx' && git commit -m "feat(marketing): translucent nav met backdrop-blur + solid fallback"
```

---

### Task 5: Hero-component + SVG-mockup asset

**Files:**
- Create: `app/(marketing)/_home/hero.tsx`
- Create: `app/(marketing)/_home/mockup-report.tsx`

- [ ] **Step 1: Mockup-component (inline SVG-achtige browser-frame)**

```tsx
// app/(marketing)/_home/mockup-report.tsx
export function MockupReport() {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white shadow-2xl shadow-black/10 overflow-hidden">
      {/* Traffic-light dots */}
      <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-cream/60 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 rounded bg-black/[0.05] px-2 py-0.5 text-[10px] font-mono text-ink-mut">
          crm.positionr.nl/rapport/voorbeeld-bv
        </span>
      </div>
      {/* Content */}
      <div className="space-y-3 p-5">
        {/* Score-banner */}
        <div className="flex items-center gap-4 rounded-lg bg-primary/8 p-4">
          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 border-primary text-primary">
            <div className="text-lg font-extrabold leading-none">8.2</div>
            <div className="text-[8px] opacity-70">/ 10</div>
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold text-ink-high">Voorbeeld B.V.</div>
            <div className="truncate text-xs text-ink-mut">voorbeeldbv.nl</div>
          </div>
        </div>
        {/* Één sectie-card */}
        <div className="rounded-lg border border-black/[0.06] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-ink-high">Score per onderdeel</div>
            <span className="rounded bg-mint/20 px-1.5 py-0.5 text-[10px] font-bold text-mint">7.4 GEM.</span>
          </div>
          {["Eerste indruk", "Propositie", "Call to actions"].map((label, i) => (
            <div key={label} className="mt-2 flex items-center gap-3">
              <div className="w-32 text-xs text-ink-mid">{label}</div>
              <div className="flex-1 h-1.5 rounded-full bg-black/[0.05]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${[75, 58, 62][i]}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs font-semibold text-ink-high">
                {[7.5, 5.8, 6.2][i]}
              </div>
            </div>
          ))}
        </div>
        {/* Mask onderin */}
        <div className="h-8 -mb-5 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Hero-component**

```tsx
// app/(marketing)/_home/hero.tsx
"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { MockupReport } from "./mockup-report";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      {/* Achtergrond-blobs */}
      <div className="pointer-events-none absolute -left-40 top-40 -z-10 h-[480px] w-[480px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-20 -z-10 h-[400px] w-[400px] rounded-full bg-coral/[0.04] blur-[100px]" />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-12 lg:gap-8 lg:py-32">
        {/* Tekst-kolom */}
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-xs font-medium text-ink-mid"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            Marketinganalyse voor MKB
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.06 }}
            className="mt-6 font-display text-5xl font-bold tracking-[-0.02em] text-ink-high md:text-6xl lg:text-7xl"
            style={{ lineHeight: 1.05, fontOpticalSizing: "auto" }}
          >
            De second opinion voor je marketingbeslissingen.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink-mid"
          >
            Wat een bureau in dagen doet, krijg jij in minuten. Concreet, direct
            toepasbaar, met wetenschappelijke basis.
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
              Probeer de gratis Website Check
            </Link>
            <Link
              href="/prijzen"
              className="inline-flex items-center justify-center px-2 py-3 text-[15px] font-semibold text-ink-high underline-offset-4 hover:underline"
            >
              Bekijk de pakketten →
            </Link>
          </motion.div>

          <p className="mt-3 text-xs text-ink-mut">
            Geen credit card. Klaar in ± 2 minuten.
          </p>
        </div>

        {/* Mockup-kolom */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4, delay: 0.1 }}
          className="lg:col-span-7 lg:-mt-4"
        >
          <MockupReport />
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/hero.tsx' 'app/(marketing)/_home/mockup-report.tsx' && git commit -m "feat(marketing): Hero met asymmetrische layout + productmockup + springs"
```

---

### Task 6: 3-staps verhaal-sectie

**Files:**
- Create: `app/(marketing)/_home/how-it-works.tsx`

- [ ] **Step 1: Component**

```tsx
// app/(marketing)/_home/how-it-works.tsx
"use client";
import { motion } from "motion/react";
import { useReveal } from "./use-reveal";

const STEPS = [
  {
    n: 1,
    title: "Stel je vraag of upload je URL",
    body: "Kies een module — Website Check, ICP-analyse, Concurrentieanalyse — en geef ons je bedrijf. Meer heb je niet nodig.",
    screenshot: "form",
  },
  {
    n: 2,
    title: "Onze AI analyseert je situatie",
    body: "In ± 2 minuten combineren we jouw input met wetenschappelijk gefundeerde raamwerken (Cialdini, Ritson, Kotler). Geen algoritme-magie — je ziet exact wat we doen.",
    screenshot: "progress",
  },
  {
    n: 3,
    title: "Krijg concrete, geprioriteerde acties",
    body: "Geen 40-pagina rapport dat op de plank belandt. Vijf acties met impact-score, direct toepasbaar deze week.",
    screenshot: "results",
  },
] as const;

function StepScreenshot({ kind }: { kind: "form" | "progress" | "results" }) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white shadow-2xl shadow-black/10 p-6 min-h-[280px]">
      {kind === "form" && (
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Gratis Website Check</div>
          <div className="font-display text-xl font-bold text-ink-high">Wat vind je van jouw website?</div>
          <label className="block">
            <span className="text-sm text-ink-mid">Jouw URL</span>
            <div className="mt-1 rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2 text-sm text-ink-high">https://voorbeeldbv.nl</div>
          </label>
          <div className="rounded-lg bg-coral px-4 py-2 text-center text-sm font-semibold text-white">Start de analyse</div>
        </div>
      )}
      {kind === "progress" && (
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Bezig met analyseren…</div>
          <div className="font-display text-xl font-bold text-ink-high">± 90 seconden te gaan</div>
          <div className="space-y-2">
            {["Website gescraped", "Content geanalyseerd", "Aanbevelingen samengesteld"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 rounded-full ${i < 2 ? "bg-mint" : "bg-primary animate-pulse"}`} />
                <span className={i < 2 ? "text-ink-mid line-through" : "text-ink-high"}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {kind === "results" && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Top 5 acties</div>
          {[
            { impact: "hoog", txt: "Maak één primaire CTA boven de vouw" },
            { impact: "hoog", txt: "Voeg drie concrete klantcases toe" },
            { impact: "middel", txt: "Comprimeer mobiele beelden" },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-black/[0.06] p-2">
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${a.impact === "hoog" ? "bg-primary text-white" : "bg-amber-500 text-white"}`}>{a.impact}</span>
              <span className="text-sm text-ink-high">{a.txt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ step, reverse }: { step: (typeof STEPS)[number]; reverse: boolean }) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const rotation = reverse ? "lg:rotate-[1deg]" : "lg:rotate-[-1deg]";
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={revealed ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-12 ${reverse ? "" : ""}`}
    >
      <div className={`lg:col-span-5 ${reverse ? "lg:col-start-8 lg:row-start-1" : ""}`}>
        <div className="mb-3 font-display text-6xl font-bold text-primary">{step.n}</div>
        <h3 className="font-display text-2xl font-bold text-ink-high md:text-3xl">{step.title}</h3>
        <p className="mt-3 text-base leading-relaxed text-ink-mid">{step.body}</p>
      </div>
      <div className={`lg:col-span-6 ${reverse ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-7"} ${rotation}`}>
        <StepScreenshot kind={step.screenshot} />
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <div className="mb-16 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Zo werkt het.</div>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl" style={{ lineHeight: 1.1 }}>
          Van vraag tot toepasbaar antwoord in drie stappen.
        </h2>
      </div>
      <div className="space-y-20">
        {STEPS.map((s, i) => <Row key={s.n} step={s} reverse={i % 2 === 1} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/how-it-works.tsx' && git commit -m "feat(marketing): 3-staps verhaal met zigzag-layout + reveal-springs"
```

---

### Task 7: Wetenschap-sectie (Cialdini/Ritson/Kotler)

**Files:**
- Create: `app/(marketing)/_home/foundations.tsx`

- [ ] **Step 1: Component**

```tsx
// app/(marketing)/_home/foundations.tsx
"use client";
import { motion } from "motion/react";
import { Users, Target, Grid3x3 } from "lucide-react";
import { useReveal } from "./use-reveal";

const CARDS = [
  {
    label: "Cialdini",
    title: "Waarom mensen 'ja' zeggen.",
    body: "Zes principes van invloed — reciprociteit, sociale bewijskracht, autoriteit, sympathie, schaarste, commitment — gebruikt om je propositie en CTA's te toetsen.",
    Icon: Users,
  },
  {
    label: "Mark Ritson",
    title: "Diagnose vóór creatie.",
    body: "Wij analyseren eerst je categorie, doelgroep en positionering — dan pas de tactiek. De aanpak die grote adverteerders van sub-schaal onderscheidt.",
    Icon: Target,
  },
  {
    label: "Philip Kotler",
    title: "Klassieke marketingmix, modern toegepast.",
    body: "Product, prijs, plaats, promotie — met de aanvullingen uit Kotler's latere werk over CX en H2H (human-to-human).",
    Icon: Grid3x3,
  },
] as const;

export function Foundations() {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  return (
    <section className="bg-cream-tint/40 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">De basis.</div>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl" style={{ lineHeight: 1.1 }}>
            Geen buikgevoel, maar 60 jaar marketingwetenschap.
          </h2>
          <p className="mt-4 text-lg text-ink-mid">
            Elke aanbeveling komt uit raamwerken die aan universiteiten en de sterkste bureaus dagelijks worden toegepast — vertaald naar jouw context.
          </p>
        </div>
        <div ref={ref} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={revealed ? { opacity: 1, y: 0 } : {}}
              transition={{ type: "spring", bounce: 0, duration: 0.35, delay: i * 0.08 }}
              className="rounded-2xl bg-white p-8 shadow-sm shadow-black/5"
            >
              <c.Icon className="h-10 w-10 text-primary" strokeWidth={1.5} />
              <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-mut">{c.label}</div>
              <h3 className="mt-1 font-display text-xl font-bold text-ink-high">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-mid">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/foundations.tsx' && git commit -m "feat(marketing): wetenschap-sectie Cialdini/Ritson/Kotler-kaarten"
```

---

### Task 8: Bureau vs Positionr strook

**Files:**
- Create: `app/(marketing)/_home/agency-comparison.tsx`

- [ ] **Step 1: Component**

```tsx
// app/(marketing)/_home/agency-comparison.tsx
"use client";
import { Clock, Coins, Hand } from "lucide-react";

const COLS = [
  {
    Icon: Clock,
    title: "Tijd",
    left: "Bureau: dagen tot weken.",
    right: "Positionr: minuten.",
  },
  {
    Icon: Coins,
    title: "Prijs",
    left: "Bureau: € 5.000 – € 30.000+.",
    right: "Positionr: één jaarbedrag.",
  },
  {
    Icon: Hand,
    title: "Controle",
    left: "Bureau: extern advies.",
    right: "Positionr: in eigen handen.",
  },
] as const;

export function AgencyComparison() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Wat het verschil maakt.</div>
        <h3 className="mt-3 font-display text-2xl font-bold text-ink-high md:text-3xl">
          Bureau of Positionr — dit weegt anders.
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {COLS.map((c) => (
          <div key={c.title}>
            <c.Icon className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <h4 className="mt-4 font-display text-xl font-bold text-ink-high">{c.title}</h4>
            <p className="mt-2 text-sm text-ink-mid">{c.left}</p>
            <p className="mt-1 text-sm font-medium text-ink-high">{c.right}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/agency-comparison.tsx' && git commit -m "feat(marketing): bureau-vs-Positionr driekolom-strook"
```

---

### Task 9: Pakketten-teaser

**Files:**
- Create: `app/(marketing)/_home/plans-teaser.tsx`

- [ ] **Step 1: Component**

```tsx
// app/(marketing)/_home/plans-teaser.tsx
"use client";
import Link from "next/link";

const PLANS = [
  { slug: "fundament", name: "Fundament", pitch: "Weten wat er speelt.", price: "€ 490", popular: false },
  { slug: "groei", name: "Groei", pitch: "Actie ondernemen, gefundeerd.", price: "€ 990", popular: true },
  { slug: "strategie", name: "Strategie", pitch: "Structureel sterker positioneren.", price: "€ 1.990", popular: false },
] as const;

export function PlansTeaser() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Pakketten.</div>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl" style={{ lineHeight: 1.1 }}>
          Eén jaarbedrag, alle modules in je pakket.
        </h2>
        <p className="mt-4 text-lg text-ink-mid">
          Geen uurtarieven, geen consultancy-add-ons. Een fractie van wat één bureau-traject kost.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.slug}
            className={`relative rounded-2xl bg-cream-tint/40 p-8 ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 ${
              p.popular ? "border-t-2 border-primary -translate-y-1" : ""
            }`}
          >
            {p.popular && (
              <div className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
                Populair
              </div>
            )}
            <div className="font-display text-2xl font-bold text-ink-high">{p.name}</div>
            <p className="mt-1 text-sm text-ink-mid">{p.pitch}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-ink-high">{p.price}</span>
              <span className="text-sm text-ink-mut">/jaar</span>
            </div>
            <Link
              href="/prijzen"
              className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-[15px] font-semibold ${
                p.popular
                  ? "bg-coral text-white hover:bg-coral-hover"
                  : "border border-black/10 text-ink-high hover:bg-white"
              }`}
            >
              Kies dit pakket
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-sm text-ink-mid">
        <Link href="/prijzen" className="font-semibold text-primary hover:underline">
          Bekijk alle features en modules per pakket →
        </Link>
      </p>
    </section>
  );
}
```

> **Let op:** de prijzen (`€ 490`, `€ 990`, `€ 1.990`) zijn placeholders — check `/prijzen` en pas aan als de echte bedragen anders zijn.

- [ ] **Step 2: Build + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/plans-teaser.tsx' && git commit -m "feat(marketing): pakketten-teaser met 3 cards + Populair-badge"
```

---

### Task 10: FAQ-accordion

**Files:**
- Create: `app/(marketing)/_home/faq.tsx`

- [ ] **Step 1: Component**

```tsx
// app/(marketing)/_home/faq.tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";

const QA = [
  {
    q: "Kan ik dit ook zonder marketing-achtergrond gebruiken?",
    a: "Ja. De rapportages leggen uit wat je ziet en welke acties je kunt nemen. Je hoeft geen marketing-jargon te kennen.",
  },
  {
    q: "Wat gebeurt er met mijn data?",
    a: "Je data blijft van jou. We bewaren analyses in je eigen account, verkopen niets aan derden en verwijderen alles bij opzegging.",
  },
  {
    q: "Werkt dit ook voor mijn sector?",
    a: "Positionr is gebouwd voor B2B-MKB in zakelijke dienstverlening, technologie en financiële dienstverlening. Buiten die sectoren werkt het ook, maar de raamwerken zijn dáár het beste getest.",
  },
  {
    q: "Kan ik opzeggen?",
    a: "Je koopt een jaar toegang. Aan het einde loopt de licentie vanzelf af — geen automatische verlenging.",
  },
  {
    q: "Hoe verhoudt Positionr zich tot mijn huidige bureau?",
    a: "Positionr vervangt je bureau niet noodzakelijk — het geeft je een onafhankelijke second opinion en helpt bepalen waarop je bureau moet focussen.",
  },
  {
    q: "Wat als ik meer hulp nodig heb dan de tool geeft?",
    a: "Neem contact op — we denken graag mee, of verwijzen je naar een specialist uit ons netwerk als dat beter past.",
  },
] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="mb-8 font-display text-3xl font-bold text-ink-high md:text-4xl">
        Wat vragen mensen ons vaak?
      </h2>
      <div>
        {QA.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="border-b border-black/[0.08]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-[17px] font-medium text-ink-high">{item.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="shrink-0 text-ink-mut"
                >
                  <ChevronRight size={18} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 pr-8 text-ink-mid">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/faq.tsx' && git commit -m "feat(marketing): FAQ-accordion met height-spring + single-open"
```

---

### Task 11: Slot-CTA

**Files:**
- Create: `app/(marketing)/_home/final-cta.tsx`

- [ ] **Step 1: Component**

```tsx
// app/(marketing)/_home/final-cta.tsx
import Link from "next/link";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="rounded-3xl bg-cream-tint p-12 text-center md:p-20">
        <h2 className="font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl" style={{ lineHeight: 1.1 }}>
          Klaar om zelf grip te krijgen?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-mid">
          Begin met een gratis Website Check — geen account, ± 2 minuten.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/gratis-check"
            className="inline-flex items-center justify-center rounded-lg bg-coral px-5 py-3 text-[15px] font-semibold text-white hover:bg-coral-hover"
          >
            Doe de gratis check →
          </Link>
          <Link
            href="/prijzen"
            className="inline-flex items-center justify-center px-2 py-3 text-[15px] font-semibold text-ink-high underline-offset-4 hover:underline"
          >
            Of bekijk eerst de pakketten
          </Link>
        </div>
        <p className="mt-6 text-xs text-ink-mut">
          Ruim 90% van de tijd zit je binnen 5 minuten met een concreet rapport voor je.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/final-cta.tsx' && git commit -m "feat(marketing): slot-CTA blok in crème met dubbele knop"
```

---

### Task 12: Footer

**Files:**
- Create: `app/(marketing)/_home/footer.tsx`

- [ ] **Step 1: Component**

```tsx
// app/(marketing)/_home/footer.tsx
import Link from "next/link";

const COLS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Product",
    links: [
      { label: "Modules", href: "/modules" },
      { label: "Pakketten", href: "/prijzen" },
      { label: "Gratis check", href: "/gratis-check" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    heading: "Bedrijf",
    links: [
      { label: "Over ons", href: "#" },
      { label: "Methodiek", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Juridisch",
    links: [
      { label: "Voorwaarden", href: "/voorwaarden" },
      { label: "Privacy", href: "/privacy" },
      { label: "Cookiebeleid", href: "#" },
    ],
  },
];

export function HomeFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-cream py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-mut">
                {col.heading}
              </h4>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-ink-mid hover:text-ink-high"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-black/[0.05] pt-6">
          <span className="font-display text-lg font-bold text-ink-high">Positionr</span>
          <span className="text-sm text-ink-mut">© 2026 Positionr · Gemaakt in Nederland</span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -3
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/footer.tsx' && git commit -m "feat(marketing): homepage-footer met 3 kolommen + copyright"
```

---

### Task 13: Assemblage — nieuwe page.tsx + smoke check

**Files:**
- Modify: `app/(marketing)/page.tsx`

- [ ] **Step 1: Backup en herschrijf**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && cp 'app/(marketing)/page.tsx' 'app/(marketing)/page.tsx.pre-redesign.bak'
```

Nieuwe inhoud voor `page.tsx`:

```tsx
// app/(marketing)/page.tsx
import { Hero } from "./_home/hero";
import { HowItWorks } from "./_home/how-it-works";
import { Foundations } from "./_home/foundations";
import { AgencyComparison } from "./_home/agency-comparison";
import { PlansTeaser } from "./_home/plans-teaser";
import { Faq } from "./_home/faq";
import { FinalCta } from "./_home/final-cta";
import { HomeFooter } from "./_home/footer";

export default function HomePage() {
  return (
    <main className="bg-cream text-ink-high">
      <Hero />
      <HowItWorks />
      <Foundations />
      <AgencyComparison />
      <PlansTeaser />
      <Faq />
      <FinalCta />
      <HomeFooter />
    </main>
  );
}
```

- [ ] **Step 2: Verwijder de backup na verifiëren**

Alleen als build + smoke groen zijn:

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && rm 'app/(marketing)/page.tsx.pre-redesign.bak'
```

- [ ] **Step 3: Volledige verificatie**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck && pnpm test && pnpm build 2>&1 | tail -20
```

Verwacht:
- `pnpm typecheck`: schoon
- `pnpm test`: alle bestaande tests groen (geen nieuwe tests voor deze PR — visueel-only)
- `pnpm build`: `/` compileert, geen errors

- [ ] **Step 4: Browser-smoke**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm dev
```

Open `http://localhost:3000/` en check:
1. Hero laadt met mockup + spring-animatie
2. Scrollen onthult sequentieel: 3 stappen (zigzag), wetenschap-kaarten, bureau-vergelijking, pakketten, FAQ, slot-CTA
3. FAQ-accordion opent/sluit met animatie
4. Hover op pakket-cards → subtiele lift
5. Sticky nav → translucent bij scroll onder content
6. Resize naar mobile (`< 640`): geen horizontal-scroll, alles gestapeld, geen rotaties op screenshots
7. DevTools > Rendering > Emulate prefers-reduced-motion: reduce → animaties vervangen door instant fades

- [ ] **Step 5: Commit assemblage**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/page.tsx' && git commit -m "feat(marketing): homepage-assemblage — nieuwe redesign live"
```

- [ ] **Step 6: Push (na akkoord van gebruiker)**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git push origin main
```

---

## File-overzicht (per task)

| Task | Create | Modify |
|---|---|---|
| 1 | - | `tailwind.config.ts`, `app/globals.css` |
| 2 | - | `app/layout.tsx`, `tailwind.config.ts` |
| 3 | `_home/use-reveal.ts` | `package.json` |
| 4 | - | `(marketing)/layout.tsx` |
| 5 | `_home/hero.tsx`, `_home/mockup-report.tsx` | - |
| 6 | `_home/how-it-works.tsx` | - |
| 7 | `_home/foundations.tsx` | - |
| 8 | `_home/agency-comparison.tsx` | - |
| 9 | `_home/plans-teaser.tsx` | - |
| 10 | `_home/faq.tsx` | - |
| 11 | `_home/final-cta.tsx` | - |
| 12 | `_home/footer.tsx` | - |
| 13 | - | `(marketing)/page.tsx` |

Alle nieuwe componenten in `app/(marketing)/_home/` — Next.js negeert `_prefix` folders bij routing, dus geen accidentele publieke route.

---

## Later (niet in deze PR)

- Echte screenshots vervangen SVG-mockups in Hero + HowItWorks
- `/methodiek`-pagina + link onder wetenschap-sectie
- Herontwerp `/prijzen`, `/gratis-check`, `/checkout`, `/voorwaarden`, `/privacy` in dezelfde taal
- Dark mode voor marketing (huidig alleen light)
- Klant-testimonials-blok (wanneer er echte cases zijn)
