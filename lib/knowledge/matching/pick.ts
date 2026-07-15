import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { stripDashes } from "@/lib/knowledge/strip-dashes";
import type { ApprovedCard, MatchableSection } from "./types";

export const MAX_BLOCKS = 3;

export type Pick = { sectionKey: string; cardId: string; bridge: string };

export function buildPickPrompt(
  sections: MatchableSection[],
  candidates: Map<string, ApprovedCard[]>,
): string {
  const blocks = sections
    .filter((s) => candidates.has(s.key))
    .map((s) => {
      const cards = candidates
        .get(s.key)!
        .map((c) => `  - id:${c.id} | ${c.title}: ${c.kern}`)
        .join("\n");
      return `SECTIE [${s.key}] ${s.titel}\n${s.tekst}\nKANDIDAAT-KAARTEN:\n${cards}`;
    })
    .join("\n\n");
  return `Je kiest "kennisblokjes" om bij secties van een marketingrapport te tonen. Per sectie HOOGSTENS één kaart, en in totaal HOOGSTENS ${MAX_BLOCKS} over het hele rapport. Kies alleen als een kaart écht raakt aan wat er in de sectie staat — liever niets dan een zwakke match.

Voor elke gekozen kaart schrijf je één korte brug-zin (Nederlands, B1) die het principe aan díé sectie koppelt. Verzin geen feiten over het bronboek. Gebruik geen liggende streepjes (— of –); gebruik gewone leestekens.

${blocks}

Geef UITSLUITEND een JSON-array terug (max ${MAX_BLOCKS} items), van meest naar minst relevant:
[{"sectionKey":"...","cardId":"...","bridge":"..."}]
Lege array [] als niets goed past. Geen tekst eromheen.`;
}

export function parsePicks(raw: string): Pick[] {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Pick[] = [];
  for (const item of parsed) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (
        typeof o.sectionKey === "string" &&
        typeof o.cardId === "string" &&
        typeof o.bridge === "string"
      ) {
        out.push({
          sectionKey: o.sectionKey,
          cardId: o.cardId,
          bridge: stripDashes(o.bridge),
        });
      }
    }
  }
  return out.slice(0, MAX_BLOCKS);
}

export async function pickBlocks(
  sections: MatchableSection[],
  candidates: Map<string, ApprovedCard[]>,
): Promise<Pick[]> {
  if (candidates.size === 0) return [];
  const { markdown } = await analyzeClaudeRaw({
    prompt: buildPickPrompt(sections, candidates),
  });
  return parsePicks(markdown);
}
