# Positionr Marketingsite — PR 2: Marketing-shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live een professionele publieke "schil" voor `positionr.nl`: landing, prijzenpagina (leest uit PR1's PLANS-registry, met maand/jaar-toggle), juridische pagina's, en een placeholder-checkout. Inloggen blijft werken; de portal is ongemoeid.

**Architectuur:** Nieuwe publieke route-groep `app/(marketing)/` met eigen layout (nav + footer, los van portal-chrome). Pure helpers voor prijsformattering en periode-keuze (TDD). Pricing-UI is een klein client-component met state voor de maand/jaar-toggle; alles eromheen is server-rendered. Middleware breidt `isPublic` uit zodat de marketing-routes geen login eisen.

**Tech Stack:** Next.js 15 (App Router, server components + één client component), Tailwind + shadcn-style primitives, Vitest (alleen voor pure helpers — UI verifieer ik via typecheck + handmatige smoke; geen React-test-library setup toegevoegd in deze PR).

**Scope-grens (bewust niet in PR 2):**
- Mollie-integratie + echte checkout (PR 4).
- Gratis Website Check + lead-capture (PR 3).
- Tier-gating in de portal + `/account`-beheer (PR 5).
- Echte juridische teksten — pagina's zijn nu duidelijke plaatshouders die jij later invult.

**Bestandsstructuur (alle paden absoluut vanaf de repo-root):**

```
app/
  page.tsx                                  ← VERVANGEN (verhuist naar (marketing)/page.tsx)
  (marketing)/
    layout.tsx                              ← NIEUW (marketing-chrome)
    page.tsx                                ← NIEUW (landing)
    prijzen/page.tsx                        ← NIEUW
    voorwaarden/page.tsx                    ← NIEUW (stub-content)
    privacy/page.tsx                        ← NIEUW (stub-content)
    checkout/page.tsx                       ← NIEUW (placeholder, leest plan+interval)
components/
  ui/card.tsx                               ← NIEUW (shadcn-primitive)
  marketing/
    BillingToggle.tsx                       ← NIEUW (client-component, useState)
    PricingCard.tsx                         ← NIEUW (één tier-kaart)
    PricingSection.tsx                      ← NIEUW (client-component: toggle + 3 cards)
lib/
  plans/
    registry.ts                             ← UITBREIDEN (BillingInterval + popular)
    registry.test.ts                        ← UITBREIDEN (popular-test)
    format.ts                               ← NIEUW (formatPriceEur / formatPeriod / priceFor)
    format.test.ts                          ← NIEUW
  supabase/
    middleware.ts                           ← AANPASSEN (isPublic uitbreiden)
```

---

### Task 1: Pricing-helpers (`formatPriceEur`, `formatPeriod`, `priceFor`)

Pure functies voor de prijzen-UI. TDD.

**Files:**
- Create: `lib/plans/format.ts`
- Test: `lib/plans/format.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/plans/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatPriceEur, formatPeriod, priceFor } from "./format";
import { getPlan } from "./registry";

describe("formatPriceEur", () => {
  it("toont hele euro's zonder decimalen", () => {
    expect(formatPriceEur(14900)).toBe("€149");
    expect(formatPriceEur(39900)).toBe("€399");
  });

  it("toont cents als ze niet 0 zijn (met komma)", () => {
    expect(formatPriceEur(14950)).toBe("€149,50");
    expect(formatPriceEur(199)).toBe("€1,99");
  });

  it("werkt met 0", () => {
    expect(formatPriceEur(0)).toBe("€0");
  });
});

describe("formatPeriod", () => {
  it("vertaalt 'monthly' naar 'per maand'", () => {
    expect(formatPeriod("monthly")).toBe("per maand");
  });

  it("vertaalt 'yearly' naar 'per jaar'", () => {
    expect(formatPeriod("yearly")).toBe("per jaar");
  });
});

describe("priceFor", () => {
  it("kiest maandprijs bij interval 'monthly'", () => {
    const basis = getPlan("basis")!;
    expect(priceFor(basis, "monthly")).toBe(basis.monthlyPriceCents);
  });

  it("kiest jaarprijs bij interval 'yearly'", () => {
    const pro = getPlan("pro")!;
    expect(priceFor(pro, "yearly")).toBe(pro.yearlyPriceCents);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/plans/format.test.ts`
Expected: FAIL — "Cannot find module './format'".

- [ ] **Step 3: Write minimal implementation**

Maak `lib/plans/format.ts`:

```ts
import type { Plan } from "./registry";

/** Bedrag in centen → "€149" of "€149,50". */
export function formatPriceEur(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  if (rest === 0) return `€${euros}`;
  return `€${euros},${rest.toString().padStart(2, "0")}`;
}

/** Periode-label voor de UI. */
export function formatPeriod(interval: "monthly" | "yearly"): string {
  return interval === "monthly" ? "per maand" : "per jaar";
}

/** Het prijsbedrag in centen voor dit plan + interval. */
export function priceFor(
  plan: Plan,
  interval: "monthly" | "yearly",
): number {
  return interval === "monthly" ? plan.monthlyPriceCents : plan.yearlyPriceCents;
}
```

> De signatures gebruiken hier de inline-union `"monthly" | "yearly"`. Task 2 voegt `BillingInterval` toe aan `registry.ts`; latere code (Tasks 4, 5, 10) importeert daar `BillingInterval` en geeft die door — TypeScript accepteert dat structureel (beide zijn exact `"monthly" | "yearly"`). Voordeel: elke tussenstap blijft typecheck-groen.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/plans/format.test.ts`
Expected: PASS (alle 7 tests groen).

- [ ] **Step 5: Commit**

```bash
git add lib/plans/format.ts lib/plans/format.test.ts
git commit -m "feat(plans): formatPriceEur + formatPeriod + priceFor (TDD)"
```

---

### Task 2: `Plan.popular` + `BillingInterval` type-export

Uitbreiding van PR 1's registry. Markeer "pro" als populair (visueel highlight op de prijzenpagina) en exporteer `BillingInterval` als type.

**Files:**
- Modify: `lib/plans/registry.ts` (add `BillingInterval` type, add `popular?: boolean` to Plan, mark `pro` popular)
- Modify: `lib/plans/registry.test.ts` (extend with popular-test)

- [ ] **Step 1: Voeg de falende test toe**

Voeg onderaan `lib/plans/registry.test.ts` (binnen de bestaande `describe("PLANS registry", ...)` of als nieuwe `describe`):

```ts
describe("popular-vlag", () => {
  it("er is precies één populair plan en dat is 'pro'", () => {
    const popular = PLANS.filter((p) => p.popular);
    expect(popular).toHaveLength(1);
    expect(popular[0].slug).toBe("pro");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/plans/registry.test.ts`
Expected: FAIL — `popular` bestaat nog niet, dus `PLANS.filter((p) => p.popular)` is leeg.

- [ ] **Step 3: Voeg de uitbreidingen toe in `lib/plans/registry.ts`**

Voeg ná de regel `export type Tier = "basis" | "pro" | "premium";` toe:

```ts
export type BillingInterval = "monthly" | "yearly";
```

Pas de `Plan`-type-definitie aan (voeg `popular?: boolean` toe):

```ts
export type Plan = {
  slug: Tier;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  features: string[];
  popular?: boolean; // toont een "Populair"-badge op de prijzenpagina
};
```

In de `PLANS`-array: voeg `popular: true,` toe aan het `pro`-object (vóór de afsluitende `},`):

```ts
  {
    slug: "pro",
    name: "Pro",
    tagline: "Voor groeiende B2B-bedrijven.",
    monthlyPriceCents: 24900,
    yearlyPriceCents: 249000,
    features: ["Alles uit Basis", "ICP-analyse", "LinkedIn-analyse"],
    popular: true,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/plans/registry.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/plans/registry.ts lib/plans/registry.test.ts
git commit -m "feat(plans): BillingInterval-type + popular-vlag op pro-plan"
```

---

### Task 3: shadcn `Card`-primitive

Voor de pricing-cards en mogelijke andere kaarten op de marketingsite. Standaard shadcn-implementatie, gemaakt met `cn`-helper uit `lib/utils.ts` (bestaand).

**Files:**
- Create: `components/ui/card.tsx`

- [ ] **Step 1: Maak het bestand**

Maak `components/ui/card.tsx`:

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
```

- [ ] **Step 2: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS (geen errors).

- [ ] **Step 3: Commit**

```bash
git add components/ui/card.tsx
git commit -m "feat(ui): Card-primitive (shadcn)"
```

---

### Task 4: `BillingToggle` client-component

Maand/jaar-keuzeknoppen. State leeft in de parent (Task 5).

**Files:**
- Create: `components/marketing/BillingToggle.tsx`

- [ ] **Step 1: Maak het component**

Maak `components/marketing/BillingToggle.tsx`:

```tsx
"use client";

import type { BillingInterval } from "@/lib/plans/registry";
import { cn } from "@/lib/utils";

type Props = {
  value: BillingInterval;
  onChange: (next: BillingInterval) => void;
};

export function BillingToggle({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Betalingsperiode"
      className="inline-flex rounded-full border border-border bg-muted p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition",
          value === "monthly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Per maand
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "yearly"}
        onClick={() => onChange("yearly")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition",
          value === "yearly"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Per jaar <span className="ml-1 text-xs text-primary">bespaar</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/BillingToggle.tsx
git commit -m "feat(marketing): BillingToggle (maand/jaar) client-component"
```

---

### Task 5: `PricingCard` + `PricingSection`

`PricingCard` toont één tier. `PricingSection` is het client-component dat de toggle-state houdt en de drie kaarten naast elkaar zet.

**Files:**
- Create: `components/marketing/PricingCard.tsx`
- Create: `components/marketing/PricingSection.tsx`

- [ ] **Step 1: Maak `PricingCard.tsx`**

Maak `components/marketing/PricingCard.tsx`:

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BillingInterval, Plan } from "@/lib/plans/registry";
import { formatPeriod, formatPriceEur, priceFor } from "@/lib/plans/format";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Props = {
  plan: Plan;
  interval: BillingInterval;
};

export function PricingCard({ plan, interval }: Props) {
  const cents = priceFor(plan, interval);
  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        plan.popular && "border-primary shadow-lg ring-2 ring-primary/20",
      )}
    >
      <CardHeader>
        {plan.popular && (
          <div className="mb-2 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Populair
          </div>
        )}
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.tagline}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">{formatPriceEur(cents)}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {formatPeriod(interval)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Link
          href={`/checkout?plan=${plan.slug}&interval=${interval}`}
          className="w-full"
        >
          <Button
            variant={plan.popular ? "default" : "outline"}
            className="w-full"
            size="lg"
          >
            Kies {plan.name}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 2: Maak `PricingSection.tsx`**

Maak `components/marketing/PricingSection.tsx`:

```tsx
"use client";

import { useState } from "react";

import { BillingToggle } from "./BillingToggle";
import { PricingCard } from "./PricingCard";
import { PLANS, type BillingInterval } from "@/lib/plans/registry";

export function PricingSection() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex justify-center">
        <BillingToggle value={interval} onChange={setInterval} />
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard key={plan.slug} plan={plan} interval={interval} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/PricingCard.tsx components/marketing/PricingSection.tsx
git commit -m "feat(marketing): PricingCard + PricingSection (3 tiers, maand/jaar)"
```

---

### Task 6: Marketing layout

Eigen nav + footer voor de publieke marketingpagina's, los van de portal-chrome.

**Files:**
- Create: `app/(marketing)/layout.tsx`

- [ ] **Step 1: Maak de layout**

Maak `app/(marketing)/layout.tsx`:

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="sticky top-0 z-50 border-b border-purple-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-xl font-bold text-transparent"
          >
            Positionr
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/prijzen">
              <Button variant="ghost" size="sm">
                Prijzen
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Inloggen
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-purple-100 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <span>© Positionr</span>
          <nav className="flex gap-4">
            <Link href="/voorwaarden" className="hover:text-foreground">
              Voorwaarden
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Inloggen
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/(marketing)/layout.tsx
git commit -m "feat(marketing): publieke layout (nav + footer)"
```

---

### Task 7: Verhuis de landing naar de marketing-groep

De huidige `app/page.tsx` (kale placeholder) verhuist naar `app/(marketing)/page.tsx` met een professionelere indeling: hero + waardepropositie + CTA-strip. Layout wordt geleverd door Task 6.

**Files:**
- Delete: `app/page.tsx`
- Create: `app/(marketing)/page.tsx`

- [ ] **Step 1: Verwijder de oude placeholder**

```bash
git rm app/page.tsx
```

- [ ] **Step 2: Maak de nieuwe landing**

Maak `app/(marketing)/page.tsx`:

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, LineChart, Sparkles } from "lucide-react";

const valueProps = [
  {
    icon: Compass,
    title: "Strakke positionering",
    description:
      "Helder zicht op je ideale klant, propositie en concurrentie — zonder consultancy-uurtarief.",
  },
  {
    icon: LineChart,
    title: "Meetbare grip",
    description:
      "Scores en concrete actiepunten per analyse, zodat je weet wat te doen.",
  },
  {
    icon: Sparkles,
    title: "AI met praktijkkennis",
    description:
      "Modules gebouwd op decennia marketing- en sales-ervaring — niet zomaar een GPT-wrapper.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-6xl font-bold text-transparent">
          Positionr
        </h1>
        <p className="mt-6 text-xl text-gray-600">
          Snel inzicht in wat je marketing oplevert,
          <br />
          zodat je met vertrouwen kunt bijsturen.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/prijzen">
            <Button size="lg">
              Bekijk de abonnementen <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Inloggen
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {valueProps.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur"
            >
              <Icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">Klaar om grip te krijgen?</h2>
        <p className="mt-4 text-muted-foreground">
          Kies een abonnement en log binnen 1 minuut in.
        </p>
        <div className="mt-8">
          <Link href="/prijzen">
            <Button size="lg">
              Naar de prijzen <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verifieer met typecheck en tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (geen routing-conflict, alle tests groen).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/\(marketing\)/page.tsx
git commit -m "feat(marketing): landing met hero + value-props + CTA"
```

---

### Task 8: Prijzenpagina

Composeert de Task 6-layout, een hero-titel, en de `PricingSection` uit Task 5.

**Files:**
- Create: `app/(marketing)/prijzen/page.tsx`

- [ ] **Step 1: Maak de pagina**

Maak `app/(marketing)/prijzen/page.tsx`:

```tsx
import { PricingSection } from "@/components/marketing/PricingSection";

export const metadata = {
  title: "Prijzen — Positionr",
};

export default function PrijzenPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold">Kies je abonnement</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Drie tiers, allemaal gratis op te zeggen. Kies maand of jaar — jaar is
          voordeliger.
        </p>
      </section>

      <PricingSection />

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center text-sm text-muted-foreground">
        <p>
          Vragen? Mail{" "}
          <a
            href="mailto:olivier@positionr.nl"
            className="text-primary hover:underline"
          >
            olivier@positionr.nl
          </a>
          .
        </p>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/\(marketing\)/prijzen/page.tsx
git commit -m "feat(marketing): prijzenpagina (3 tiers + maand/jaar-toggle)"
```

---

### Task 9: Juridische pagina's (stubs)

Pagina's met duidelijke plaatshoudertekst. Olivier vult later de juridische inhoud in (bv. via een jurist). De structuur staat klaar zodat ze meteen vindbaar zijn vanuit de footer.

**Files:**
- Create: `app/(marketing)/voorwaarden/page.tsx`
- Create: `app/(marketing)/privacy/page.tsx`

- [ ] **Step 1: Maak `voorwaarden/page.tsx`**

Maak `app/(marketing)/voorwaarden/page.tsx`:

```tsx
export const metadata = {
  title: "Algemene voorwaarden — Positionr",
};

export default function VoorwaardenPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-20">
      <h1>Algemene voorwaarden</h1>
      <p className="text-muted-foreground">
        Laatst bijgewerkt: <em>nog in te vullen</em>
      </p>
      <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Plaatshouder:</strong> de definitieve algemene voorwaarden
        worden hier nog ingevuld. Tot die tijd geldt: door gebruik van Positionr
        ga je akkoord met deze nog op te stellen voorwaarden. Heb je nu vragen?
        Mail{" "}
        <a href="mailto:olivier@positionr.nl">olivier@positionr.nl</a>.
      </p>
      <h2>1. Wie zijn wij?</h2>
      <p>Positionr — contactgegevens worden later toegevoegd.</p>
      <h2>2. Wat we leveren</h2>
      <p>Online marketinganalyses via abonnement (Basis / Pro / Premium).</p>
      <h2>3. Betaling en opzegging</h2>
      <p>Betaling via Mollie; maandabonnementen opzegbaar per einde periode.</p>
      <h2>4. Aansprakelijkheid</h2>
      <p>Tekst volgt.</p>
    </article>
  );
}
```

- [ ] **Step 2: Maak `privacy/page.tsx`**

Maak `app/(marketing)/privacy/page.tsx`:

```tsx
export const metadata = {
  title: "Privacy — Positionr",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-6 py-20">
      <h1>Privacyverklaring</h1>
      <p className="text-muted-foreground">
        Laatst bijgewerkt: <em>nog in te vullen</em>
      </p>
      <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Plaatshouder:</strong> de definitieve privacyverklaring wordt
        hier nog ingevuld. Heb je nu vragen over hoe wij met je gegevens
        omgaan? Mail{" "}
        <a href="mailto:olivier@positionr.nl">olivier@positionr.nl</a>.
      </p>
      <h2>Welke gegevens verwerken we?</h2>
      <p>
        E-mailadres + bedrijfsgegevens (account), gebruiksdata van modules,
        en — bij gebruik van de gratis Website Check — het opgegeven
        e-mailadres en de gecheckte URL.
      </p>
      <h2>Waarom?</h2>
      <p>
        Om je het product te kunnen leveren (account, abonnement, analyses) en
        om met je te kunnen communiceren over je gebruik.
      </p>
      <h2>Met wie delen we het?</h2>
      <p>
        Met onze verwerkers: Supabase (database/auth), Vercel (hosting), Mollie
        (betalingen), en — wanneer geactiveerd — Resend (e-mail).
      </p>
      <h2>Hoe lang?</h2>
      <p>Tekst volgt.</p>
    </article>
  );
}
```

- [ ] **Step 3: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/voorwaarden/page.tsx app/\(marketing\)/privacy/page.tsx
git commit -m "feat(marketing): voorwaarden + privacy pagina's (stub-content)"
```

---

### Task 10: Checkout-placeholder

Pagina die de gekozen tier + interval uit de URL leest, valideert tegen `PLANS`, en een nette wachtkamer toont. In PR 4 wordt dit de echte Mollie-checkout.

**Files:**
- Create: `app/(marketing)/checkout/page.tsx`

- [ ] **Step 1: Maak de pagina**

Maak `app/(marketing)/checkout/page.tsx`:

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getPlan, type BillingInterval, type Tier } from "@/lib/plans/registry";
import { formatPeriod, formatPriceEur, priceFor } from "@/lib/plans/format";

export const metadata = {
  title: "Afrekenen — Positionr",
};

type SearchParams = { plan?: string; interval?: string };

function parseInterval(raw: string | undefined): BillingInterval {
  return raw === "yearly" ? "yearly" : "monthly";
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const plan = params.plan ? getPlan(params.plan as Tier) : undefined;
  const interval = parseInterval(params.interval);

  if (!plan) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">Geen abonnement gekozen</h1>
        <p className="mt-4 text-muted-foreground">
          We kunnen je gekozen abonnement niet vinden. Kies er een op de
          prijzenpagina.
        </p>
        <div className="mt-8">
          <Link href="/prijzen">
            <Button size="lg">Naar prijzen</Button>
          </Link>
        </div>
      </section>
    );
  }

  const cents = priceFor(plan, interval);

  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Afrekenen — bijna klaar</h1>
      <div className="mt-8 rounded-xl border border-border bg-white p-8 text-left shadow-sm">
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Abonnement</dt>
            <dd className="font-medium">{plan.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Periode</dt>
            <dd className="font-medium">{formatPeriod(interval)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="text-muted-foreground">Prijs</dt>
            <dd className="text-lg font-semibold">{formatPriceEur(cents)}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Binnenkort:</strong> betalen via Mollie wordt nog ingebouwd
        (volgt in de eerstvolgende update). Je krijgt dan automatisch een
        account en een inloglink per mail.
      </p>

      <div className="mt-8 flex justify-center gap-3">
        <Link href="/prijzen">
          <Button variant="outline" size="lg">
            Terug naar prijzen
          </Button>
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/\(marketing\)/checkout/page.tsx
git commit -m "feat(marketing): checkout-placeholder leest plan+interval uit URL"
```

---

### Task 11: Middleware — marketing-routes publiek

Maak de nieuwe marketing-paden publiek zodat ze geen login eisen.

**Files:**
- Modify: `lib/supabase/middleware.ts`

- [ ] **Step 1: Pas de `isPublic`-check aan**

Vervang het hele `isPublic`-blok (regels die het pad tegen patronen vergelijken) door deze uitbreiding:

Zoek (huidige code):

```ts
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/preview") || // tijdelijk voor visuele check
    path.startsWith("/_next") ||
    path.startsWith("/favicon");
```

Vervang door:

```ts
  const isPublic =
    path === "/" ||
    path.startsWith("/prijzen") ||
    path.startsWith("/voorwaarden") ||
    path.startsWith("/privacy") ||
    path.startsWith("/checkout") ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/preview") || // tijdelijk voor visuele check
    path.startsWith("/_next") ||
    path.startsWith("/favicon");
```

- [ ] **Step 2: Verifieer met typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (alle bestaande tests blijven groen).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "feat(middleware): marketing-routes publiek (prijzen, voorwaarden, privacy, checkout)"
```

---

### Task 12: Eindcheck — typecheck, tests, en handmatige smoke

**Files:** (geen wijzigingen)

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS — geen errors.

- [ ] **Step 2: Run de volledige testsuite**

Run: `pnpm test`
Expected: PASS — alle tests groen, inclusief de nieuwe `format.test.ts` (7 tests) en de uitbreiding in `registry.test.ts` (+1 test). Totaal: oude baseline (55) + 7 format + 1 popular = **63 tests**, **13 files**.

- [ ] **Step 3: Handmatige smoke (door Olivier)**

Run:

```bash
pnpm dev
```

Open in de browser:
- `http://localhost:3000` — landing met hero, value-props, CTA-strip. Klikken op "Bekijk de abonnementen" → `/prijzen`. Klikken op "Inloggen" → `/login`.
- `http://localhost:3000/prijzen` — drie tier-kaarten, Pro met "Populair"-badge. Toggle maand/jaar wijzigt alle prijzen tegelijk. Klikken op "Kies Pro" → `/checkout?plan=pro&interval=monthly` (of `yearly`).
- `http://localhost:3000/checkout?plan=pro&interval=yearly` — toont "Pro, per jaar, €X" + de amber "Binnenkort"-melding. Klikken op "Terug" → `/prijzen`.
- `http://localhost:3000/voorwaarden` en `/privacy` — open, plaatshouder-tekst zichtbaar.
- `http://localhost:3000/modules` (zonder ingelogd te zijn) — redirect naar `/login` (de portal blijft afgeschermd).

- [ ] **Step 4: Geen verdere commits — alleen afsluiten via finishing-skill**

Dit is geen aparte commit. Wel mark de PR als klaar voor afsluiting (push naar `main` via dezelfde finishing-flow als PR 1).

---

## Self-review (na voltooiing PR 2)

- [ ] `pnpm typecheck` — schoon.
- [ ] `pnpm test` — alle tests groen (verwacht 63 totaal).
- [ ] Routes werken: `/`, `/prijzen`, `/checkout`, `/voorwaarden`, `/privacy` zonder login. `/modules` nog steeds achter login.
- [ ] Geen regressie in `app.positionr.nl` (portal-routes ongemoeid).
- [ ] Prijzen lezen uit `PLANS`; maand/jaar-toggle werkt; Pro-kaart heeft de "Populair"-badge.
- [ ] Juridische pagina's tonen duidelijke plaatshouder-melding (zodat Olivier weet dat hij ze nog moet invullen).

## Wat deze PR NIET doet

- Gratis Website Check — komt in PR 3 (`/gratis-check` + lead-opslag).
- Mollie-checkout + webhook + account-aanmaak + magic-link — komen in PR 4.
- Tier-gating op modules in de portal + `/account`-abonnementbeheer — PR 5.
- Echte juridische teksten + visuele identiteit (logo, hero-beeld, brand-kleuren) — invulwerk van Olivier, geen code.
