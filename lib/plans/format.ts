/**
 * Bedrag in centen → "€149" of "€149,50".
 * (Geen periode-helpers meer; we voeren alleen jaarprijzen op.)
 */
export function formatPriceEur(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  if (rest === 0) return `€${euros}`;
  return `€${euros},${rest.toString().padStart(2, "0")}`;
}
