import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources } from "@/lib/db/schema";
import { RunningPoll } from "@/app/(app)/modules/_components/running-poll";
import {
  approveCardAction,
  updateCardAction,
  deleteCardAction,
  resumeDistillationAction,
} from "../actions";
import { DeleteSourceButton } from "../delete-source-button";

export default async function KennisSourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const [source] = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, sourceId))
    .limit(1);
  if (!source) notFound();

  const cards = await db
    .select()
    .from(knowledgeCards)
    .where(eq(knowledgeCards.sourceId, sourceId))
    .orderBy(asc(knowledgeCards.chapterIndex), asc(knowledgeCards.createdAt));

  const busy = source.status === "distilling" || source.status === "extracting";
  // Consolidatie is fase 2: alle hoofdstukken gedistilleerd, status nog niet done.
  const consolidating =
    busy && source.chaptersTotal > 0 && source.chaptersDone >= source.chaptersTotal;

  return (
    <div className="mx-auto max-w-3xl">
      {busy && <RunningPoll />}
      <Link href="/admin/kennis" className="inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{source.title}</h1>
          <p className="text-sm text-gray-600">
            {source.author ?? "onbekende auteur"} · {source.chaptersDone}/
            {source.chaptersTotal} hoofdstukken · {cards.length} kaarten
          </p>
        </div>
        <DeleteSourceButton sourceId={source.id} label="Verwijder boek" />
      </div>

      {busy && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <span>
            {consolidating
              ? "Consolideren tot de sterkste ~10-20 kaarten…"
              : `Bezig met distilleren… (${source.chaptersDone}/${source.chaptersTotal})`}
          </span>
          <form action={resumeDistillationAction}>
            <input type="hidden" name="sourceId" value={source.id} />
            <button
              type="submit"
              className="rounded border bg-white px-3 py-1 text-xs font-semibold text-blue-700"
            >
              Ga door
            </button>
          </form>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {cards.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4">
            <form action={updateCardAction} className="space-y-2">
              <input type="hidden" name="cardId" value={c.id} />
              <input type="hidden" name="sourceId" value={source.id} />
              <div className="flex items-center justify-between gap-2">
                <input
                  name="title"
                  defaultValue={c.title}
                  className="w-full rounded border px-2 py-1 text-sm font-semibold"
                />
                <span
                  className={
                    c.status === "goedgekeurd"
                      ? "shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
                      : "shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                  }
                >
                  {c.status}
                </span>
              </div>
              <textarea name="kern" defaultValue={c.kern} rows={3} className="w-full rounded border px-2 py-1 text-sm" />
              <input name="toepassing" defaultValue={c.toepassing} className="w-full rounded border px-2 py-1 text-sm" />
              <input
                name="tags"
                defaultValue={c.tags.join(", ")}
                placeholder="tags, komma-gescheiden"
                className="w-full rounded border px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button type="submit" className="rounded border px-3 py-1 text-xs font-semibold">
                  Bewaar
                </button>
              </div>
            </form>
            <div className="mt-2 flex gap-2 border-t pt-2">
              <form action={approveCardAction}>
                <input type="hidden" name="cardId" value={c.id} />
                <input type="hidden" name="sourceId" value={source.id} />
                <button
                  type="submit"
                  className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  Goedkeuren
                </button>
              </form>
              <form action={deleteCardAction}>
                <input type="hidden" name="cardId" value={c.id} />
                <input type="hidden" name="sourceId" value={source.id} />
                <button type="submit" className="rounded border px-3 py-1 text-xs text-red-600">
                  Verwijderen
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {cards.length === 0 && !busy && (
        <p className="mt-6 text-sm text-gray-500">Nog geen kaarten gedistilleerd.</p>
      )}
    </div>
  );
}
