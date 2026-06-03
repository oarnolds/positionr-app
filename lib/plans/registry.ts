/**
 * Bron van waarheid voor de abonnementsplannen.
 * Prijzen zijn VOORLOPIG (Olivier stelt definitieve prijzen vast na validatie).
 * Wijzigen = dit bestand aanpassen, geen DB-migratie.
 */

export type Tier = "fundament" | "groei" | "strategie";

export type BillingInterval = "monthly" | "yearly";

/** Oplopend van goedkoop → duur. Index = rang voor cumulatieve toegang. */
export const TIER_ORDER: Tier[] = ["fundament", "groei", "strategie"];

export type Plan = {
  slug: Tier;
  name: string;
  tagline: string;
  monthlyPriceCents: number; // doorlopend, per maand
  yearlyPriceCents: number; // eenmalig, 12 maanden toegang
  features: string[];
  popular?: boolean; // toont een "Populair"-badge op de prijzenpagina
};

export const PLANS: Plan[] = [
  {
    slug: "fundament",
    name: "Fundament",
    tagline: "Het stevige startpunt voor je marketing.",
    monthlyPriceCents: 14900,
    yearlyPriceCents: 149000,
    features: ["Website Check", "Onbeperkt analyses", "E-mailsupport"],
  },
  {
    slug: "groei",
    name: "Groei",
    tagline: "Voor wie de volgende stap wil zetten.",
    monthlyPriceCents: 24900,
    yearlyPriceCents: 249000,
    features: [
      "Alles uit Fundament",
      "ICP-analyse",
      "LinkedIn-analyse",
    ],
    popular: true,
  },
  {
    slug: "strategie",
    name: "Strategie",
    tagline: "Strategische diepgang en alle modules.",
    monthlyPriceCents: 39900,
    yearlyPriceCents: 399000,
    features: ["Alles uit Groei", "Alle modules", "Prioriteit-support"],
  },
];

export function getPlan(slug: Tier): Plan | undefined {
  return PLANS.find((p) => p.slug === slug);
}

/** Mag een gebruiker met `userTier` iets met vereiste `minTier` openen? Cumulatief. */
export function tierAllows(userTier: Tier | null, minTier: Tier): boolean {
  if (!userTier) return false;
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minTier);
}
