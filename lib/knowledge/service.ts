import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources } from "@/lib/db/schema";
import { distillChapter } from "./distill";
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
  nowMs: () => number;
  budgetMs: number;
};

function sourceLabelOf(s: { author: string | null; title: string }): string {
  return s.author ? `${s.author} — ${s.title}` : s.title;
}

/**
 * Distilleert de nog niet-verwerkte hoofdstukken van een bron, hoofdstuk voor
 * hoofdstuk. Voortgang wordt per hoofdstuk weggeschreven zodat de admin het
 * live ziet en een resume (na budget-stop of een harde Vercel-kill) exact
 * hervat vanaf chaptersDone. Klaar → status 'done'.
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
    for (let i = source.chaptersDone; i < total; i++) {
      const cards = await deps.distillChapter({
        chapterText: source.chapters[i],
        sourceLabel: label,
        language: source.language,
      });
      await deps.insertCards(sourceId, label, i, cards);
      done = i + 1;
      await deps.updateSource(sourceId, {
        chaptersDone: done,
        status: done >= total ? "done" : "distilling",
      });
      if (done < total && deps.nowMs() - start > deps.budgetMs) return;
    }
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
  nowMs: () => Date.now(),
  budgetMs: 240_000,
};
