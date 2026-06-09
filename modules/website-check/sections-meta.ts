/**
 * JSX-vrije metadata over de Website Check secties.
 * Bestaan apart van `sections.tsx` zodat `lib/modules/layouts.ts`
 * (en zijn tests) de IDs/titels kunnen lezen zonder React-components
 * te laden.
 */
export type SectionMeta = {
  id: string;
  defaultTitle: string;
  description: string; // korte uitleg voor admin-UI
};

export const WEBSITE_CHECK_SECTION_META: SectionMeta[] = [
  {
    id: "score-banner",
    defaultTitle: "Overall score",
    description: "Paarse banner met overall score + bedrijfsnaam + URL.",
  },
  {
    id: "executive-summary",
    defaultTitle: "Samenvatting",
    description: "Korte uitleg-paragraaf.",
  },
  {
    id: "onderdelen-grid",
    defaultTitle: "Score per onderdeel",
    description: "Lijst met 11 sub-score-kaarten.",
  },
  {
    id: "sterke-punten",
    defaultTitle: "Top 3 sterke punten",
    description: "Bullets met sterke punten (groen).",
  },
  {
    id: "verbeterpunten",
    defaultTitle: "Top 3 verbeterpunten",
    description: "Bullets met verbeterpunten (amber).",
  },
  {
    id: "top-acties",
    defaultTitle: "Top 5 prioriteitsacties",
    description: "Genummerde lijst met acties + impact-badges.",
  },
  {
    id: "aanvullende-info",
    defaultTitle: "Aanvullende info",
    description: "Dynamische extras uit de admin-prompt (passthrough-velden).",
  },
];
