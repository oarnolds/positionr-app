// Resultaatpagina van de generieke runner — zelfde mechaniek als
// website-check: polling zolang 'running', auto-fail na timeout, en bij
// succes het rapport in de ICP-designtaal (of markdown-fallback).

import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, Circle } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { getModule } from "@/lib/modules/registry";
import { isGenericModule, parseGenericOutput } from "@/modules/generic/schema";
import { GenericReportView } from "@/modules/generic/components/GenericReportView";
import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";
import { cn } from "@/lib/utils";
import { regenerateGenericAnalysisAction } from "../actions";
import { RunningPoll } from "../../_components/running-poll";

export const maxDuration = 300;

const STUCK_THRESHOLD_SECONDS = 6 * 60; // maxDuration=300s + 1 min grace

export default async function GenericModuleResultPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;
  if (!isGenericModule(slug)) notFound();
  const moduleMeta = getModule(slug);
  if (!moduleMeta) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/${slug}/${sessionId}`);

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (
    rows.length === 0 ||
    rows[0].userId !== user.id ||
    rows[0].moduleSlug !== slug
  ) {
    notFound();
  }
  let row = rows[0];

  // Auto-fail: 'running' ouder dan de drempel is verloren (serverless
  // function gekilled). WHERE-guard op status voorkomt een race met een
  // late background-update.
  if (row.status === "running") {
    const elapsedSec = Math.floor(
      (Date.now() - new Date(row.createdAt).getTime()) / 1000,
    );
    if (elapsedSec > STUCK_THRESHOLD_SECONDS) {
      const failedAt = new Date();
      const msg = "Analyse onderbroken (timeout). Probeer opnieuw.";
      await db
        .update(sessions)
        .set({ status: "failed", errorMessage: msg, completedAt: failedAt })
        .where(and(eq(sessions.id, row.id), eq(sessions.status, "running")));
      row = { ...row, status: "failed", errorMessage: msg, completedAt: failedAt };
    }
  }

  const header = (
    <div className="mx-auto max-w-4xl px-6 pt-6">
      <Link
        href={`/modules/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
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
      { label: "Bron ophalen", doneAt: 8 },
      { label: "Inhoud analyseren met AI", doneAt: 45 },
      { label: "Rapport opmaken", doneAt: Number.POSITIVE_INFINITY },
    ];
    const currentStepIdx = steps.findIndex((s) => elapsed < s.doneAt);
    const Icon = moduleMeta.icon;

    return (
      <>
        <RunningPoll />
        {header}
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-xl bg-white p-3 shadow-sm",
                moduleMeta.iconColor,
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{moduleMeta.name}</h1>
              <p className="text-gray-600">
                We draaien de analyse — dit duurt 20-60 seconden.
              </p>
            </div>
          </div>

          <div
            className={cn(
              "mt-8 rounded-2xl border-2 p-6",
              moduleMeta.borderColor,
              moduleMeta.bgLight,
            )}
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              <span className="font-semibold text-gray-900">
                Bezig met analyseren…
              </span>
              <span className="ml-auto text-sm tabular-nums text-gray-600">
                {elapsedLabel}
              </span>
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
                  i < currentStepIdx
                    ? "done"
                    : i === currentStepIdx
                      ? "current"
                      : "pending";
                return (
                  <li key={step.label} className="flex items-center gap-2 text-sm">
                    {state === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {state === "current" && (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    )}
                    {state === "pending" && (
                      <Circle className="h-4 w-4 text-gray-300" />
                    )}
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
            Je kan vrij weg navigeren — de analyse loopt door op de achtergrond.
            Je vindt &apos;m terug onder &quot;Eerdere analyses&quot; op de
            modulepagina.
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
          <p className="mt-1 text-sm text-gray-700">
            {row.errorMessage ?? "Onbekende fout."}
          </p>
          <form action={regenerateGenericAnalysisAction} className="mt-4">
            <input type="hidden" name="moduleSlug" value={slug} />
            <input type="hidden" name="sourceSessionId" value={row.id} />
            <button className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white">
              Opnieuw proberen
            </button>
          </form>
          <Link
            href={`/modules/${slug}`}
            className="ml-3 text-sm text-purple-700 underline"
          >
            Of: andere invoer
          </Link>
          <p className="mt-3 text-xs text-gray-500">URL: {input.websiteUrl ?? "—"}</p>
        </div>
      </>
    );
  }

  // status === "approved"
  const output = parseGenericOutput(row.output);

  return (
    <>
      {header}
      <div className="mx-auto max-w-4xl px-6 py-8">
        {output?.kind === "report" ? (
          <GenericReportView
            moduleName={moduleMeta.name}
            report={output.report}
            blocks={row.knowledgeBlocks ?? []}
          />
        ) : (
          <MarkdownBlock markdown={output?.markdown ?? ""} variant="report" />
        )}

        <div className="mt-6 flex items-center gap-3">
          <form action={regenerateGenericAnalysisAction}>
            <input type="hidden" name="moduleSlug" value={slug} />
            <input type="hidden" name="sourceSessionId" value={row.id} />
            <button className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 font-semibold text-white">
              Opnieuw analyseren
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
