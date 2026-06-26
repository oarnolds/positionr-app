import Link from "next/link";
import { BookMarked, Globe, FileText, Upload, Trash2 } from "lucide-react";
import type { MarkdownSnapshot } from "@/lib/db/schema";
import {
  createUrlSnapshotAction,
  createFileSnapshotAction,
  deleteSnapshotAction,
} from "@/app/(app)/modules/markdown/actions";

export type MarkdownLibraryCardProps = {
  defaultWebsiteUrl?: string;
  snapshots: MarkdownSnapshot[];
};

function kindLabel(kind: MarkdownSnapshot["kind"]): string {
  switch (kind) {
    case "website":
      return "Website";
    case "pdf":
      return "PDF";
    case "docx":
      return "Word";
  }
}

function kindIcon(kind: MarkdownSnapshot["kind"]) {
  switch (kind) {
    case "website":
      return <Globe className="h-4 w-4" />;
    case "pdf":
    case "docx":
      return <FileText className="h-4 w-4" />;
  }
}

function formatAge(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min geleden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} uur geleden`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "dag" : "dagen"} geleden`;
}

export function MarkdownLibraryCard({
  defaultWebsiteUrl,
  snapshots,
}: MarkdownLibraryCardProps) {
  return (
    <section
      aria-labelledby="markdown-bib-heading"
      className="mb-10 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-white p-2.5 text-purple-600 shadow-sm">
          <BookMarked className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 id="markdown-bib-heading" className="text-xl font-bold text-gray-900">
            Markdown bibliotheek
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Maak markdown van een website-URL, PDF of Word-document. Deze
            markdown wordt later door de analyses gebruikt als invoer, zodat ze
            betere resultaten geven.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {/* URL → markdown */}
        <form
          action={createUrlSnapshotAction}
          className="rounded-xl border border-purple-100 bg-white p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Globe className="h-4 w-4 text-purple-600" />
            Vanuit een URL
          </div>
          <input
            name="websiteUrl"
            type="text"
            defaultValue={defaultWebsiteUrl ?? ""}
            placeholder="bijv. https://uwbedrijf.nl"
            className="mt-2 w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            required
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              name="includeImages"
              defaultChecked
              className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Afbeeldingen en logo&apos;s ook beschrijven (langzamer, hogere kosten)
          </label>
          <button
            type="submit"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
          >
            Maak markdown
          </button>
        </form>

        {/* File upload → markdown */}
        <form
          action={createFileSnapshotAction}
          encType="multipart/form-data"
          className="rounded-xl border border-purple-100 bg-white p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Upload className="h-4 w-4 text-purple-600" />
            Vanuit PDF of Word
          </div>
          <input
            name="file"
            type="file"
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            className="mt-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-200"
            required
          />
          <p className="mt-1 text-xs text-gray-500">Max 10 MB. PDF of .docx.</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              name="includeImages"
              defaultChecked
              className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Afbeeldingen en logo&apos;s ook beschrijven (langzamer, hogere kosten)
          </label>
          <button
            type="submit"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
          >
            Maak markdown
          </button>
        </form>
      </div>

      {snapshots.length > 0 ? (
        <div className="mt-6">
          <div className="text-sm font-semibold text-gray-700">
            Eerder gemaakt ({snapshots.length})
          </div>
          <ul className="mt-2 space-y-2">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-purple-100 bg-white p-3 text-sm"
              >
                <Link
                  href={`/modules/markdown/${s.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:text-purple-700"
                >
                  <span className="shrink-0 rounded bg-purple-50 p-1.5 text-purple-600">
                    {kindIcon(s.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">
                      {s.title || s.sourceFilename || s.sourceUrl}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {kindLabel(s.kind)} · {formatAge(s.fetchedAt)} ·{" "}
                      {s.markdown.length.toLocaleString("nl-NL")} tekens
                    </span>
                  </span>
                </Link>
                <form action={deleteSnapshotAction}>
                  <input type="hidden" name="snapshotId" value={s.id} />
                  <button
                    type="submit"
                    aria-label="Verwijderen"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
