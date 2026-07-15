import Link from "next/link";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources } from "@/lib/db/schema";
import { BookUploader } from "./book-uploader";
import { DeleteSourceButton } from "./delete-source-button";

export const maxDuration = 300;

export default async function KennisPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const sources = await db
    .select()
    .from(knowledgeSources)
    .orderBy(desc(knowledgeSources.createdAt));

  // Goedgekeurde kaarten zonder thema — de gap waar auto-toewijzing stil kan
  // falen. themes is NOT NULL default '{}', dus leeg = array_length(...) is null.
  const [{ untagged }] = await db
    .select({ untagged: count() })
    .from(knowledgeCards)
    .where(
      and(
        eq(knowledgeCards.status, "goedgekeurd"),
        sql`array_length(${knowledgeCards.themes}, 1) is null`,
      ),
    );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Kennisbibliotheek</h1>
      <p className="mt-1 text-sm text-gray-600">
        Lever een boek (PDF of EPUB) aan. Het wordt gedistilleerd tot concept-kaarten
        die je daarna per stuk goedkeurt.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {untagged > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {untagged} goedgekeurde {untagged === 1 ? "kaart" : "kaarten"} zonder
            thema.{" "}
            <span className="text-amber-700">
              Draai de backfill (
              <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
                pnpm exec tsx scripts/backfill-card-themes.ts
              </code>
              ) om ze te taggen.
            </span>
          </span>
        </div>
      )}

      <BookUploader />

      <h2 className="mt-8 mb-2 text-lg font-bold">Aangeleverde boeken</h2>
      {sources.length === 0 ? (
        <p className="text-sm text-gray-500">Nog geen boeken.</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="flex items-stretch gap-2">
              <Link
                href={`/admin/kennis/${s.id}`}
                className="flex flex-1 items-center justify-between rounded-lg border bg-white px-4 py-3 hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.title}</span>
                  <span className="block text-xs text-gray-500">
                    {s.author ?? "onbekende auteur"} · {s.language ?? "?"} ·{" "}
                    {s.chaptersDone}/{s.chaptersTotal} hoofdstukken
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-purple-700">
                  {s.status}
                </span>
              </Link>
              <DeleteSourceButton sourceId={s.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
