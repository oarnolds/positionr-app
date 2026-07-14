import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeSources } from "@/lib/db/schema";
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
