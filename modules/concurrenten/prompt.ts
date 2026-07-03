// Promptbouw voor de concurrentie-analyse.
//
// Fase 1 (discovery): admin-prompt (sub-slug -discovery) + snapshot-content
// + vast JSON-contract voor de kandidatenlijst.
// Fase 2 (diepe analyse): hergebruikt buildGenericPrompt van de generieke
// runner — zelfde sectie-contract, met {competitors} gevuld vanuit de review.

import { substitutePlaceholders } from "@/lib/modules/prompts";
import { globalPlaceholders } from "@/lib/modules/global-placeholders";
import type { ConcurrentenInput, ConfirmedCompetitor } from "./schema";

/** Vast contract voor de discovery-output — niet admin-bewerkbaar. */
export const DISCOVERY_JSON_CONTRACT = `
---
OUTPUT-FORMAAT (verplicht):
Geef UITSLUITEND geldige JSON terug — geen markdown-fences, geen uitleg. Exact deze structuur:

{
  "samenvatting": "2-3 zinnen: in welke marktsegmenten opereert dit bedrijf en waar heb je gezocht",
  "kandidaten": [
    {
      "naam": "Bedrijfsnaam",
      "websiteUrl": "https://voorbeeld.nl (leeg laten als onbekend)",
      "reden": "1-2 zinnen waarom dit een concurrent is — benoem het overlappende aanbod",
      "segment": "Het marktsegment waarin dit bedrijf concurreert"
    }
  ]
}

Regels:
- Zoek ECHTE, bestaande bedrijven via web search — verzin geen namen. Controleer bij twijfel.
- Werk snel: je hebt maximaal 4 web searches — gebruik één brede, gerichte zoekopdracht per marktsegment in plaats van veel kleine.
- 6 tot 12 kandidaten, gesorteerd van meest naar minst directe concurrent.
- Groepeer via "segment": bedrijven die in hetzelfde deel van de markt concurreren krijgen exact dezelfde segment-naam.
- Alleen bedrijven die actief zijn in de opgegeven geografische focus.
- Nederlandse tekst in "reden" en "samenvatting".`;

export { FALLBACK_PROMPT_DISCOVERY } from "./fallback";

export function buildDiscoveryPrompt(args: {
  template: string;
  input: ConcurrentenInput;
  scrapedContent: string;
}): string {
  const substituted = substitutePlaceholders(args.template, {
    ...globalPlaceholders(),
    companyName: args.input.companyName,
    geografie: args.input.geografie,
    sector: args.input.sector || "sector onbekend",
    description: args.input.description || "(geen extra context opgegeven)",
    scrapedContent: args.scrapedContent || "(Kon website niet laden)",
  });

  const parts: string[] = [substituted];
  if (!args.template.includes("{scrapedContent}")) {
    parts.push(
      `---\nWEBSITE-CONTENT (markdown-snapshot):\n\n${
        args.scrapedContent || "(Kon website niet laden)"
      }`,
    );
  }
  parts.push(DISCOVERY_JSON_CONTRACT);
  return parts.join("\n\n");
}

/** Bevestigde concurrenten → tekstblok voor de {competitors}-placeholder. */
export function formatConfirmedCompetitors(
  confirmed: ConfirmedCompetitor[],
): string {
  return confirmed
    .map((c) => (c.websiteUrl ? `- ${c.naam} (${c.websiteUrl})` : `- ${c.naam}`))
    .join("\n");
}
