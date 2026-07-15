import type { ApprovedCard } from "./types";

/**
 * Per sectie: de kaarten waarvan minstens één thema in de sectie-thema's zit.
 * Secties zonder kandidaten komen NIET in de map.
 */
export function prefilter(
  sectionThemes: Record<string, string[]>,
  cards: ApprovedCard[],
): Map<string, ApprovedCard[]> {
  const out = new Map<string, ApprovedCard[]>();
  for (const [key, themes] of Object.entries(sectionThemes)) {
    if (themes.length === 0) continue;
    const set = new Set(themes);
    const candidates = cards.filter((c) => c.themes.some((t) => set.has(t)));
    if (candidates.length > 0) out.set(key, candidates);
  }
  return out;
}
