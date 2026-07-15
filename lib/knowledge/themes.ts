import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards } from "@/lib/db/schema";
import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { TAXONOMY, filterValidThemes } from "./taxonomy";

export type CardForThemes = { title: string; kern: string; tags: string[] };

export function buildThemeSuggestionPrompt(card: CardForThemes): string {
  const opties = TAXONOMY.map((t) => `- ${t.slug}: ${t.label}`).join("\n");
  return `Je labelt een marketing/sales-kennis-kaart met thema's uit een VASTE taxonomie. Kies alleen slugs die écht op de kaart van toepassing zijn.

KAART
Titel: ${card.title}
Kern: ${card.kern}
Vrije tags: ${card.tags.join(", ") || "(geen)"}

TAXONOMIE (kies UITSLUITEND uit deze slugs):
${opties}

Geef UITSLUITEND een JSON-array van 1 tot 4 slugs die het best passen, bijvoorbeeld ["bewijsvoering","sociale-bewijskracht"]. Geen tekst eromheen.`;
}

/** Strip fences, pak de buitenste array, parse, filter op geldige taxonomie-slugs. */
export function parseThemeSlugs(raw: string): string[] {
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
  const strings = parsed.filter((x): x is string => typeof x === "string");
  return filterValidThemes(strings);
}

/** Eén LLM-call → gesuggereerde taxonomie-thema's voor een kaart. */
export async function suggestThemes(card: CardForThemes): Promise<string[]> {
  const { markdown } = await analyzeClaudeRaw({
    prompt: buildThemeSuggestionPrompt(card),
  });
  return parseThemeSlugs(markdown);
}

/**
 * Zet themes op één kaart (best-effort). Slaat over als de kaart al themes
 * heeft. Faalt stil — thema-toewijzing mag nooit de goedkeuring blokkeren.
 */
export async function assignThemes(cardId: string): Promise<void> {
  const [card] = await db
    .select({
      id: knowledgeCards.id,
      title: knowledgeCards.title,
      kern: knowledgeCards.kern,
      tags: knowledgeCards.tags,
      themes: knowledgeCards.themes,
    })
    .from(knowledgeCards)
    .where(eq(knowledgeCards.id, cardId))
    .limit(1);
  if (!card || (card.themes && card.themes.length > 0)) return;
  try {
    const themes = await suggestThemes(card);
    if (themes.length > 0) {
      await db
        .update(knowledgeCards)
        .set({ themes, updatedAt: new Date() })
        .where(eq(knowledgeCards.id, cardId));
    }
  } catch {
    // best-effort
  }
}
