import Link from "next/link";
import { ArrowLeft, BookMarked, Globe, FileText } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { markdownSnapshots } from "@/lib/db/schema";

function kindLabel(kind: string): string {
  if (kind === "website") return "Website";
  if (kind === "pdf") return "PDF";
  if (kind === "docx") return "Word";
  if (kind === "xlsx") return "Spreadsheet";
  return kind;
}

export default async function MarkdownSnapshotPage({
  params,
}: {
  params: Promise<{ snapshotId: string }>;
}) {
  const { snapshotId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/markdown/${snapshotId}`);

  const [snapshot] = await db
    .select()
    .from(markdownSnapshots)
    .where(
      and(
        eq(markdownSnapshots.id, snapshotId),
        eq(markdownSnapshots.userId, user.id)
      )
    )
    .limit(1);
  if (!snapshot) notFound();

  const IconForKind = snapshot.kind === "website" ? Globe : FileText;
  const sourceDisplay =
    snapshot.kind === "website"
      ? snapshot.sourceUrl
      : snapshot.sourceFilename ?? snapshot.sourceUrl;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
          <BookMarked className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">
            {snapshot.title || sourceDisplay}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            <IconForKind className="h-4 w-4" />
            <span>{kindLabel(snapshot.kind)}</span>
            <span>·</span>
            <span className="truncate">{sourceDisplay}</span>
          </div>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5">
        <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <span className="font-semibold">Gemaakt:</span>{" "}
            {new Date(snapshot.fetchedAt).toLocaleString("nl-NL")}
          </div>
          <div>
            <span className="font-semibold">Lengte:</span>{" "}
            {snapshot.markdown.length.toLocaleString("nl-NL")} tekens
          </div>
          {snapshot.kind === "website" ? (
            <div className="sm:col-span-2">
              <span className="font-semibold">Pagina&apos;s:</span>{" "}
              {snapshot.pages.filter((p) => p.status === "ok").length} /{" "}
              {snapshot.pages.length}
            </div>
          ) : null}
        </div>
      </section>

      <h2 className="mt-8 text-lg font-bold">Markdown</h2>
      <pre className="mt-2 max-h-[60vh] overflow-auto rounded-2xl border bg-white p-5 text-sm leading-relaxed">
        <code>{snapshot.markdown}</code>
      </pre>
    </div>
  );
}
