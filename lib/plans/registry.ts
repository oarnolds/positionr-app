/**
 * Bron van waarheid voor de abonnementsplannen.
 * Prijzen zijn VOORLOPIG (Olivier stelt definitieve prijzen vast na validatie).
 * Wijzigen = dit bestand aanpassen, geen DB-migratie.
 */

export type Tier = "basis" | "pro" | "premium";

/** Oplopend van goedkoop → duur. Index = rang voor cumulatieve toegang. */
export const TIER_ORDER: Tier[] = ["basis", "pro", "premium"];

export type Plan = {
  slug: Tier;
  name: string;
  tagline: string;
  monthlyPriceCents: number; // doorlopend, per maand
  yearlyPriceCents: number; // eenmalig, 12 maanden toegang
  features: string[];
};

export const PLANS: Plan[] = [
  {
    slug: "basis",
    name: "Basis",
    tagline: "Voor wie zelf aan de slag wil.",
    monthlyPriceCents: 14900,
    yearlyPriceCents: 149000,
    features: ["Website Check", "Onbeperkt analyses", "E-mailsupport"],
  },
  {
    slug: "pro",
    name: "Pro",
    tagline: "Voor groeiende B2B-bedrijven.",
    monthlyPriceCents: 24900,
    yearlyPriceCents: 249000,
    features: ["Alles uit Basis", "ICP-analyse", "LinkedIn-analyse"],
  },
  {
    slug: "premium",
    name: "Premium",
    tagline: "Alle modules, maximale grip.",
    monthlyPriceCents: 39900,
    yearlyPriceCents: 399000,
    features: ["Alles uit Pro", "Alle modules", "Prioriteit-support"],
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
