import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards } from "@/lib/db/schema";
import { classifySections } from "./classify";
import { pickBlocks } from "./pick";
import { prefilter } from "./prefilter";
import type { ApprovedCard, KnowledgeBlock, MatchableSection } from "./types";

export type MatchingDeps = {
  loadApprovedCards: () => Promise<ApprovedCard[]>;
  classify: (sections: MatchableSection[]) => Promise<Record<string, string[]>>;
  pick: typeof pickBlocks;
};

export const defaultMatchingDeps: MatchingDeps = {
  loadApprovedCards: async () =>
    db
      .select({
        id: knowledgeCards.id,
        title: knowledgeCards.title,
        kern: knowledgeCards.kern,
        toepassing: knowledgeCards.toepassing,
        sourceLabel: knowledgeCards.sourceLabel,
        themes: knowledgeCards.themes,
      })
      .from(knowledgeCards)
      .where(
        and(
          eq(knowledgeCards.status, "goedgekeurd"),
          sql`array_length(${knowledgeCards.themes}, 1) >= 1`,
        ),
      ),
  classify: classifySections,
  pick: pickBlocks,
};

/**
 * classify → prefilter → pick → snapshot. Best-effort: elke fout of lege
 * tussenstap levert een lege lijst, zodat de module-run nooit faalt.
 */
export async function buildKnowledgeBlocks(
  sections: MatchableSection[],
  deps: MatchingDeps = defaultMatchingDeps,
): Promise<KnowledgeBlock[]> {
  try {
    if (sections.length === 0) return [];
    const cards = await deps.loadApprovedCards();
    if (cards.length === 0) return [];

    const sectionThemes = await deps.classify(sections);
    const candidates = prefilter(sectionThemes, cards);
    if (candidates.size === 0) return [];

    const picks = await deps.pick(sections, candidates);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const blocks: KnowledgeBlock[] = [];
    for (const p of picks) {
      const card = byId.get(p.cardId);
      if (!card) continue;
      blocks.push({
        sectionKey: p.sectionKey,
        rank: blocks.length + 1,
        bridge: p.bridge,
        cardId: card.id,
        card: {
          title: card.title,
          kern: card.kern,
          toepassing: card.toepassing,
          sourceLabel: card.sourceLabel,
        },
      });
    }
    return blocks;
  } catch {
    return [];
  }
}
