// app/(app)/modules/website-check/[sessionId]/page.tsx
import Link from "next/link";
import { ArrowLeft, Globe, Loader2, CheckCircle2, Circle } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
import { MODULE_SLUG } from "@/modules/website-check";
import { regenerateAnalysis } from "../actions";
import { RunningPoll } from "./running-poll";

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
    const input = (row.input as { websiteUrl?: string }) ?? {};
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 1000),
    );
    const elapsedLabel =
      elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    const steps = [
      { label: "Pagina ophalen", doneAt: 8 },
      { label: "Inhoud analyseren met AI", doneAt: 45 },
      { label: "Resultaat opmaken", doneAt: Number.POSITIVE_INFINITY },
    ];
    const currentStepIdx = steps.findIndex((s) => elapsed < s.doneAt);

    return (
      <>
        {/* Polling via client component (geen full page reload zoals <meta refresh>), zodat de gebruiker vrij kan weg navigeren. */}
        <RunningPoll />
        {header}
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Website Check</h1>
              <p className="text-gray-600">We analyseren je website — dit duurt 20-50 seconden.</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border-2 border-purple-200 bg-purple-50 p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              <span className="font-semibold text-gray-900">Bezig met analyseren…</span>
              <span className="ml-auto text-sm tabular-nums text-gray-600">{elapsedLabel}</span>
            </div>

            {input.websiteUrl && (
              <p className="mt-4 truncate text-sm text-gray-700">
                <span className="font-semibold">URL:</span>{" "}
                <span className="text-purple-700">{input.websiteUrl}</span>
              </p>
            )}

            <ul className="mt-5 space-y-2">
              {steps.map((step, i) => {
                const state =
                  i < currentStepIdx ? "done" : i === currentStepIdx ? "current" : "pending";
                return (
                  <li key={step.label} className="flex items-center gap-2 text-sm">
                    {state === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {state === "current" && (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    )}
                    {state === "pending" && <Circle className="h-4 w-4 text-gray-300" />}
                    <span
                      className={
                        state === "pending"
                          ? "text-gray-400"
                          : state === "current"
                            ? "font-semibold text-gray-900"
                            : "text-gray-700"
                      }
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Je kan vrij weg navigeren — de analyse loopt door op de achtergrond. Je vindt 'm
            terug onder &quot;Eerdere checks&quot; op de modulepagina.
          </p>
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
