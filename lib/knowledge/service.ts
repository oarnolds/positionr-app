import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources } from "@/lib/db/schema";
import { distillChapter } from "./distill";
import { consolidateCards } from "./consolidate";
import type { KnowledgeCardDraft } from "./schema";

export type DistillDeps = {
  loadSource: (id: string) => Promise<{
    id: string;
    chapters: string[];
    chaptersDone: number;
    chaptersTotal: number;
    author: string | null;
    title: string;
    language: string | null;
  } | null>;
  distillChapter: (args: {
    chapterText: string;
    sourceLabel: string;
    language: string | null;
  }) => Promise<KnowledgeCardDraft[]>;
  insertCards: (
    sourceId: string,
    sourceLabel: string,
    chapterIndex: number,
    cards: KnowledgeCardDraft[],
  ) => Promise<void>;
  updateSource: (
    id: string,
    patch: { chaptersDone: number; status: "distilling" | "done" | "failed" },
  ) => Promise<void>;
  /** Laadt de huidige (kandidaat-)kaarten van een bron als drafts. */
  loadCandidateCards: (sourceId: string) => Promise<KnowledgeCardDraft[]>;
  /** Ontdubbelt/knijpt de kandidaten terug tot de sterkste set. */
  consolidate: (cards: KnowledgeCardDraft[]) => Promise<KnowledgeCardDraft[]>;
  /** Vervangt alle kaarten van een bron door de geconsolideerde set. */
  replaceCards: (
    sourceId: string,
    sourceLabel: string,
    cards: KnowledgeCardDraft[],
  ) => Promise<void>;
  nowMs: () => number;
  budgetMs: number;
};

function sourceLabelOf(s: { author: string | null; title: string }): string {
  return s.author ? `${s.author}, ${s.title}` : s.title;
}

/**
 * Distilleert een bron in twee fasen:
 *   1. per hoofdstuk kandidaat-kaarten (resumebaar, budget-bewaakt);
 *   2. zodra alle hoofdstukken klaar zijn: één consolidatie-slotronde die
 *      ontdubbelt en terugknijpt tot de sterkste ~10-20 kaarten.
 * De status blijft 'distilling' tot de consolidatie klaar is (dan 'done'),
 * zodat een resume na een budget-stop of harde kill fase 2 alsnog uitvoert.
 */
export async function runDistillation(
  sourceId: string,
  deps: DistillDeps = defaultDeps,
): Promise<void> {
  const source = await deps.loadSource(sourceId);
  if (!source) return;
  const start = deps.nowMs();
  const label = sourceLabelOf(source);
  const total = source.chapters.length;
  let done = source.chaptersDone;

  try {
    // Fase 1 — per hoofdstuk.
    for (let i = source.chaptersDone; i < total; i++) {
      const cards = await deps.distillChapter({
        chapterText: source.chapters[i],
        sourceLabel: label,
        language: source.language,
      });
      await deps.insertCards(sourceId, label, i, cards);
      done = i + 1;
      // Nog niet 'done': consolidatie (fase 2) moet er eerst overheen.
      await deps.updateSource(sourceId, { chaptersDone: done, status: "distilling" });
      if (done < total && deps.nowMs() - start > deps.budgetMs) return;
    }

    // Budget op na fase 1? Consolideer in een volgende ronde (resume).
    if (deps.nowMs() - start > deps.budgetMs) return;

    // Fase 2 — consolidatie-slotronde.
    const candidates = await deps.loadCandidateCards(sourceId);
    const consolidated = await deps.consolidate(candidates);
    await deps.replaceCards(sourceId, label, consolidated);
    await deps.updateSource(sourceId, { chaptersDone: done, status: "done" });
  } catch (err) {
    await deps.updateSource(sourceId, { chaptersDone: done, status: "distilling" });
    throw err;
  }
}

export const defaultDeps: DistillDeps = {
  loadSource: async (id) => {
    const [row] = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      chapters: row.chapters,
      chaptersDone: row.chaptersDone,
      chaptersTotal: row.chaptersTotal,
      author: row.author,
      title: row.title,
      language: row.language,
    };
  },
  distillChapter,
  insertCards: async (sourceId, sourceLabel, chapterIndex, cards) => {
    if (cards.length === 0) return;
    await db.insert(knowledgeCards).values(
      cards.map((c) => ({
        sourceId,
        title: c.title,
        kern: c.kern,
        toepassing: c.toepassing,
        tags: c.tags,
        sourceLabel,
        chapterIndex,
      })),
    );
  },
  updateSource: async (id, patch) => {
    await db
      .update(knowledgeSources)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(knowledgeSources.id, id));
  },
  loadCandidateCards: async (sourceId) => {
    const rows = await db
      .select()
      .from(knowledgeCards)
      .where(eq(knowledgeCards.sourceId, sourceId));
    return rows.map((r) => ({
      title: r.title,
      kern: r.kern,
      toepassing: r.toepassing,
      tags: r.tags,
    }));
  },
  consolidate: consolidateCards,
  replaceCards: async (sourceId, sourceLabel, cards) => {
    await db.delete(knowledgeCards).where(eq(knowledgeCards.sourceId, sourceId));
    if (cards.length === 0) return;
    await db.insert(knowledgeCards).values(
      cards.map((c) => ({
        sourceId,
        title: c.title,
        kern: c.kern,
        toepassing: c.toepassing,
        tags: c.tags,
        sourceLabel,
        chapterIndex: 0,
      })),
    );
  },
  nowMs: () => Date.now(),
  budgetMs: 240_000,
};
