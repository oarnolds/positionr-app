import Link from "next/link";
import { ArrowLeft, MessageSquare, FileText, Globe } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { answerFromLibrary } from "@/lib/rag/query";
import { askLibraryAction } from "../actions";

export const maxDuration = 60;

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function AskLibraryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/markdown/ask");

  const question = typeof sp.q === "string" ? sp.q.trim() : "";

  const result =
    question.length >= 3
      ? await answerFromLibrary(user.id, question, { topK: 6 }).catch((err) => ({
          error: err instanceof Error ? err.message : String(err),
        }))
      : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Vraag aan je bibliotheek</h1>
          <p className="text-gray-600">
            Doorzoekt al je markdown-snapshots (websites, PDFs, Word) en
            beantwoordt op basis van wat het vindt.
          </p>
        </div>
      </div>

      <form action={askLibraryAction} className="mt-6 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">
            Wat wil je weten?
          </span>
          <input
            name="q"
            type="text"
            defaultValue={question}
            placeholder="bijv. Wie zijn de klanten van Datapas? Of: wat is hun positionering?"
            className="mt-1 w-full rounded-lg border border-purple-200 bg-white px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            required
            minLength={3}
            autoFocus
          />
        </label>
        <button
          type="submit"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          Stel vraag
        </button>
      </form>

      {result && "error" in result ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </div>
      ) : null}

      {result && "answer" in result ? (
        <>
          <section className="mt-6 rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-bold">Antwoord</h2>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {result.answer}
            </div>
          </section>

          {result.matches.length > 0 ? (
            <section className="mt-6">
              <h2 className="mb-3 text-base font-bold">Bronnen</h2>
              <ul className="space-y-3">
                {result.matches.map((m, i) => (
                  <li
                    key={`${m.snapshotId}-${m.chunkIndex}`}
                    className="rounded-xl border bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/modules/markdown/${m.snapshotId}`}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-purple-700"
                      >
                        <span className="shrink-0 rounded bg-purple-50 p-1 text-purple-600">
                          {m.sourceKind === "website" ? (
                            <Globe className="h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span>
                          [Bron {i + 1}]{" "}
                          {m.sourceFilename ?? m.sourceUrl}
                          {m.headingPath.length > 0
                            ? ` › ${m.headingPath.join(" › ")}`
                            : ""}
                        </span>
                      </Link>
                      <span className="text-xs text-gray-500">
                        score {Math.round(m.similarity * 100)}
                      </span>
                    </div>
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs leading-relaxed text-gray-700">
                      {m.content}
                    </pre>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
