// Promptbouw voor de generieke runner.
//
// Opbouw van de uiteindelijke prompt:
//   1. Admin-prompt (placeholders gesubstitueerd)
//   2. Website-content-blok (alleen als de admin-prompt zelf geen
//      {scrapedContent} gebruikt — anders bepaalt de admin de positie)
//   3. Layout-instructie (formatExample uit de admin) — stuurt secties/opbouw
//   4. Vast JSON-contract — NIET admin-bewerkbaar, dwingt de vorm af die
//      GenericReportView rendert.

import { substitutePlaceholders } from "@/lib/modules/prompts";
import { globalPlaceholders } from "@/lib/modules/global-placeholders";
import { REPORT_ACCENT_VALUES } from "./schema";

/** Vast instructieblok dat het output-formaat afdwingt. */
export const JSON_CONTRACT = `
---
OUTPUT-FORMAAT (verplicht, niet onderhandelbaar):
Geef UITSLUITEND geldige JSON terug — geen markdown-fences, geen uitleg ervoor of erna. Exact deze structuur:

{
  "heroTekst": "2-3 zinnen kernconclusie van de analyse, geschreven voor de banner bovenaan het rapport",
  "secties": [
    {
      "titel": "Sectietitel",
      "accent": "purple | blue | amber | green | red | indigo | teal",
      "layout": "volledig | half",
      "inhoud": "Markdown-tekst voor in de kaart (paragrafen, bullets, **bold**). Mag leeg zijn als feiten/chips het verhaal vertellen.",
      "feiten": [{ "label": "Kort label", "waarde": "Waarde" }],
      "chips": ["korte tag", "nog een tag"]
    }
  ],
  "volgendeStappen": ["Concrete actie 1", "Concrete actie 2"]
}

Regels:
- "feiten" en "chips" zijn optioneel per sectie; gebruik "feiten" voor label/waarde-overzichten en "chips" voor korte opsommingen van tags/kenmerken.
- "layout": "half" plaatst twee secties naast elkaar op desktop — gebruik dit voor korte, vergelijkbare secties (in paren).
- Toegestane accent-waarden: ${REPORT_ACCENT_VALUES.join(", ")}. Varieer accenten betekenisvol (bv. red voor risico's/dealbreakers, green voor kansen).
- Schrijf alle inhoud in het Nederlands, zakelijk maar toegankelijk.
- Volg de sectie-opbouw uit de LAYOUT-INSTRUCTIE hierboven als die aanwezig is; anders kies je zelf een logische opbouw van 4-7 secties.`;

export type GenericPromptValues = {
  websiteUrl: string;
  companyName: string;
  sector: string;
  description: string;
  competitors: string;
  scrapedContent: string;
};

export function buildGenericPrompt(args: {
  template: string;
  formatExample: string | null;
  values: GenericPromptValues;
}): string {
  const { template, formatExample, values } = args;

  const substituted = substitutePlaceholders(template, {
    ...globalPlaceholders(),
    websiteUrl: values.websiteUrl,
    companyName: values.companyName || "Onbekend",
    sector: values.sector || "Onbekend",
    description: values.description || "(geen beschrijving opgegeven)",
    competitors: values.competitors || "(geen concurrenten opgegeven)",
    scrapedContent: values.scrapedContent || "(Kon website niet laden)",
  });

  const parts: string[] = [substituted];

  // Grond de analyse altijd in de echte website-content. Gebruikt de
  // admin-prompt {scrapedContent} zelf, dan bepaalt die de positie en
  // voegen we niets toe.
  if (!template.includes("{scrapedContent}")) {
    parts.push(
      `---\nWEBSITE-CONTENT (markdown-snapshot van ${values.websiteUrl}):\n\n${
        values.scrapedContent || "(Kon website niet laden)"
      }`,
    );
  }

  if (formatExample && formatExample.trim().length > 0) {
    parts.push(
      `---\nLAYOUT-INSTRUCTIE (bepaalt de sectie-opbouw van het rapport):\n\n${formatExample}`,
    );
  }

  parts.push(JSON_CONTRACT);

  return parts.join("\n\n");
}
