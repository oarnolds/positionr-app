import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { parseCardDrafts, type KnowledgeCardDraft } from "./schema";

export function buildDistillPrompt(args: {
  chapterText: string;
  sourceLabel: string;
  language: string | null;
}): string {
  const bron =
    args.language && args.language.toLowerCase().startsWith("nl")
      ? "Het bronhoofdstuk is Nederlands."
      : `Het bronhoofdstuk is anderstalig (${args.language ?? "onbekend"}).`;
  return `Je distilleert één hoofdstuk uit een marketing/sales-boek tot concept-kaarten voor een kennisbibliotheek. ${bron}

Haal de kernprincipes, frameworks en signature-voorbeelden eruit en zet ze om naar korte kaarten. Regels:
- Schrijf ALLE tekst in het Nederlands (B1-niveau), ook als het bronhoofdstuk anderstalig is. Vertaal de ideeën, kopieer geen zinnen letterlijk uit de bron.
- Elke kaart is een principe in je eigen woorden, geen samenvatting van het hoofdstuk.
- Verzin geen feiten; baseer je op het hoofdstuk.
- Gebruik geen liggende streepjes (— of –); gebruik gewone leestekens zoals komma, punt of dubbele punt.

Geef UITSLUITEND een JSON-array terug (geen tekst eromheen). Elk element:
{
  "title": "korte naam van het principe",
  "kern": "2-4 zinnen die het principe uitleggen",
  "toepassing": "één praktische zin: zo pas je het toe",
  "tags": ["thema of situatie", "nog een"]
}
Geef 0 tot 3 kaarten, alleen écht onderscheidende kernprincipes. Bevat dit hoofdstuk geen inhoudelijk principe (bijvoorbeeld voorwerk, inhoudsopgave, noten, register, dankwoord of colofon)? Geef dan een lege array [] terug.

BRON: ${args.sourceLabel}

HOOFDSTUK:
${args.chapterText}`;
}

/** Distilleert één hoofdstuk tot kaart-drafts via Claude. */
export async function distillChapter(args: {
  chapterText: string;
  sourceLabel: string;
  language: string | null;
}): Promise<KnowledgeCardDraft[]> {
  const prompt = buildDistillPrompt(args);
  const result = await analyzeClaudeRaw({ prompt });
  return parseCardDrafts(result.markdown);
}
