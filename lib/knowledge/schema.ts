import { z } from "zod";
import { stripDashes } from "./strip-dashes";

export const KnowledgeCardDraftSchema = z.object({
  title: z.string().trim().min(1),
  kern: z.string().trim().min(1),
  toepassing: z.string().trim().default(""),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type KnowledgeCardDraft = z.infer<typeof KnowledgeCardDraftSchema>;

/**
 * Haalt de JSON-array uit een (mogelijk in markdown-fences verpakte)
 * LLM-tekst. Strip eerst alle ```-fences, pak dan alles tussen de buitenste
 * [ en ]. Gooit als er geen array in staat.
 */
function extractJsonArray(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("geen JSON-array gevonden");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Parse de LLM-output naar geldige kaart-drafts. Verwacht een JSON-array
 * (eventueel in markdown-fences). Ongeldige elementen worden overgeslagen
 * zodat één rotte kaart de hele oogst niet verpest.
 */
export function parseCardDrafts(raw: string): KnowledgeCardDraft[] {
  let parsed: unknown;
  try {
    parsed = extractJsonArray(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const cards: KnowledgeCardDraft[] = [];
  for (const item of parsed) {
    const result = KnowledgeCardDraftSchema.safeParse(item);
    if (result.success) {
      const d = result.data;
      cards.push({
        title: stripDashes(d.title),
        kern: stripDashes(d.kern),
        toepassing: stripDashes(d.toepassing),
        tags: d.tags.map(stripDashes),
      });
    }
  }
  return cards;
}
