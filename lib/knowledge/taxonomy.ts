/**
 * Gecureerde, in git geversioneerde kennis-taxonomie. Dit is de ENIGE
 * toegestane woordenschat voor knowledge_cards.themes én voor de classify-stap
 * in de matching-engine (plan 2B). Uitbreiden = een bewuste git-wijziging.
 */
export type Theme = { slug: string; label: string };

export const TAXONOMY: readonly Theme[] = [
  { slug: "waardepropositie", label: "Waardepropositie" },
  { slug: "klantvoordelen", label: "Klantvoordelen / benefits" },
  { slug: "bewijsvoering", label: "Bewijsvoering" },
  { slug: "sociale-bewijskracht", label: "Sociale bewijskracht" },
  { slug: "autoriteit-expertise", label: "Autoriteit & expertise" },
  { slug: "schaarste-urgentie", label: "Schaarste & urgentie" },
  { slug: "wederkerigheid", label: "Wederkerigheid" },
  { slug: "commitment-consistentie", label: "Commitment & consistentie" },
  { slug: "sympathie-relatie", label: "Sympathie & relatie" },
  { slug: "positionering-onderscheid", label: "Positionering & onderscheid" },
  { slug: "doelgroep-icp", label: "Doelgroep & ideale klant" },
  { slug: "storytelling-klantcase", label: "Storytelling & klantcases" },
  { slug: "cta-conversie", label: "CTA & conversie" },
  { slug: "prijs-waardeperceptie", label: "Prijs & waardeperceptie" },
  { slug: "content-thought-leadership", label: "Content & thought leadership" },
  { slug: "vertrouwen-risicoreductie", label: "Vertrouwen & risicoreductie" },
  { slug: "boodschap-copyhelderheid", label: "Boodschap & copy-helderheid" },
  { slug: "gedrag-besliskunde", label: "Gedrag & besliskunde" },
] as const;

export const THEME_SLUGS: ReadonlySet<string> = new Set(
  TAXONOMY.map((t) => t.slug),
);

/** Normaliseert (trim + lowercase), houdt alleen bestaande slugs, ontdubbelt. */
export function filterValidThemes(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of slugs) {
    const norm = raw.trim().toLowerCase();
    if (THEME_SLUGS.has(norm) && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}
