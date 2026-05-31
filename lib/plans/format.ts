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
