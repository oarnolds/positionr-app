import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeSources } from "@/lib/db/schema";
import { uploadBookAction } from "./actions";

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

      <form
        action={uploadBookAction}
        encType="multipart/form-data"
        className="mt-6 rounded-xl border bg-white p-4"
      >
        <input
          name="file"
          type="file"
          accept="application/pdf,application/epub+zip,.pdf,.epub"
          required
          className="block w-full text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Max 50 MB. Auteur en taal worden automatisch herkend.
        </p>
        <button
          type="submit"
          className="mt-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Boek distilleren
        </button>
      </form>

      <h2 className="mt-8 mb-2 text-lg font-bold">Aangeleverde boeken</h2>
      {sources.length === 0 ? (
        <p className="text-sm text-gray-500">Nog geen boeken.</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/kennis/${s.id}`}
                className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 hover:bg-slate-50"
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
