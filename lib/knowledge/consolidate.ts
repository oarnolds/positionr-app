import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { parseCardDrafts, type KnowledgeCardDraft } from "./schema";

const TARGET_MIN = 10;
const TARGET_MAX = 20;

export function buildConsolidatePrompt(cards: KnowledgeCardDraft[]): string {
  const list = cards
    .map(
      (c, i) =>
        `${i + 1}. TITEL: ${c.title}\nKERN: ${c.kern}\nTOEPASSING: ${c.toepassing}\nTAGS: ${c.tags.join(", ")}`,
    )
    .join("\n\n");

  return `Je krijgt een lijst kandidaat-kennis-kaarten die per hoofdstuk uit één boek zijn gedistilleerd. Er zitten dubbelingen en overlap in, en het zijn er te veel.

Consolideer ze tot de ${TARGET_MIN} à ${TARGET_MAX} STERKSTE, onderscheidende kaarten:
- Voeg kaarten die (grotendeels) hetzelfde principe beschrijven samen tot één sterke kaart; combineer de beste kern, toepassing en tags. Ontdubbel dus alles wat te veel op elkaar lijkt.
- Gooi zwakke, triviale of louter herhalende kaarten weg.
- Verzin geen nieuwe principes die niet in de kandidaten zitten.
- Schrijf alle tekst in het Nederlands (B1-niveau).

Geef UITSLUITEND een JSON-array terug (geen tekst eromheen), met ${TARGET_MIN} tot ${TARGET_MAX} elementen. Elk element:
{
  "title": "korte naam van het principe",
  "kern": "2-4 zinnen die het principe uitleggen",
  "toepassing": "één praktische zin: zo pas je het toe",
  "tags": ["thema of situatie", "nog een"]
}

KANDIDAAT-KAARTEN:
${list}`;
}

/**
 * Slotronde: ontdubbelt en knijpt de per-hoofdstuk-kandidaten terug tot de
 * sterkste ~10-20 kaarten. Vangnet: levert de LLM niets bruikbaars, dan houden
 * we de kandidaten (beter te veel dan niets).
 */
export async function consolidateCards(
  cards: KnowledgeCardDraft[],
): Promise<KnowledgeCardDraft[]> {
  if (cards.length === 0) return [];
  const result = await analyzeClaudeRaw({ prompt: buildConsolidatePrompt(cards) });
  const consolidated = parseCardDrafts(result.markdown);
  return consolidated.length > 0 ? consolidated : cards;
}
