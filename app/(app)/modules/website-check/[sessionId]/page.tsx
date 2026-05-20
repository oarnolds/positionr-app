// app/(app)/modules/website-check/[sessionId]/page.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
import { MODULE_SLUG } from "@/modules/website-check";
import { regenerateAnalysis } from "../actions";

export default async function WebsiteCheckResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/website-check/${sessionId}`);

  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!row || row.userId !== user.id || row.moduleSlug !== MODULE_SLUG) notFound();

  const header = (
    <div className="mx-auto max-w-4xl px-6 pt-6">
      <Link href="/modules/website-check" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
    </div>
  );

  if (row.status === "running") {
    return (
      <>
        {/* auto-refresh elke 3s tot status wijzigt */}
        <meta httpEquiv="refresh" content="3" />
        {header}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-lg font-semibold">Bezig met analyseren…</p>
          <p className="mt-1 text-sm text-gray-600">Dit duurt ongeveer 20-50 seconden. De pagina ververst zichzelf elke 3 seconden.</p>
        </div>
      </>
    );
  }

  if (row.status === "failed") {
    const input = row.input as { websiteUrl?: string };
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-lg font-semibold text-rose-700">Analyse mislukt</p>
          <p className="mt-1 text-sm text-gray-700">{row.errorMessage ?? "Onbekende fout."}</p>
          <form action={regenerateAnalysis} className="mt-4">
            <input type="hidden" name="sourceSessionId" value={row.id} />
            <button className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white">Opnieuw proberen</button>
          </form>
          <Link href="/modules/website-check" className="ml-3 text-sm text-purple-700 underline">
            Of: andere URL invoeren
          </Link>
          <p className="mt-3 text-xs text-gray-500">URL: {input.websiteUrl ?? "—"}</p>
        </div>
      </>
    );
  }

  // status === "approved"
  const parsed = WebsiteCheckOutputSchema.safeParse(row.output);
  if (!parsed.success) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center text-rose-700">
          Resultaat-output is ongeldig opgeslagen.
        </div>
      </>
    );
  }

  const shareUrl = row.shareSlug
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/r/${row.shareSlug}`
    : "";

  return (
    <>
      {header}
      <WebsiteCheckResultView data={parsed.data} />
      <div className="mx-auto mt-2 mb-12 flex max-w-4xl items-center gap-3 px-6">
        <form action={regenerateAnalysis}>
          <input type="hidden" name="sourceSessionId" value={row.id} />
          <button className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 font-semibold text-white">
            Opnieuw analyseren
          </button>
        </form>
        {shareUrl && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-4 py-2 font-semibold"
            title="Open deellink (kopieer URL uit adresbalk om te delen)"
          >
            Deel (read-only link)
          </a>
        )}
      </div>
    </>
  );
}
