// Sessie-pagina van de concurrentie-analyse. Vier toestanden:
//   running + geen confirmed  → fase 1 bezig (discovery, polling)
//   review                    → kandidaten bevestigen
//   running + confirmed       → fase 2 bezig (diepe analyse, polling)
//   approved / failed         → rapport of foutmelding

import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  Loader2,
  CheckCircle2,
  Circle,
  Search,
  UserCheck,
} from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { getModule } from "@/lib/modules/registry";
import {
  MODULE_SLUG,
  parseConcurrentenOutput,
  type ConcurrentenSessionInput,
  type ConfirmedCompetitor,
} from "@/modules/concurrenten/schema";
import { GenericReportView } from "@/modules/generic/components/GenericReportView";
import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";
import { cn } from "@/lib/utils";
import {
  confirmCompetitorsAction,
  regenerateConcurrentenAction,
} from "../actions";
import { RunningPoll } from "../../_components/running-poll";
import { SubmitButton } from "../../_components/submit-button";
import { ManualCompetitors } from "./manual-competitors";

export const maxDuration = 300;

const STUCK_THRESHOLD_SECONDS = 6 * 60;

export default async function ConcurrentenSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { sessionId } = await params;
  const { error } = await searchParams;
  const moduleMeta = getModule(MODULE_SLUG);
  if (!moduleMeta) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/${MODULE_SLUG}/${sessionId}`);

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (
    rows.length === 0 ||
    rows[0].userId !== user.id ||
    rows[0].moduleSlug !== MODULE_SLUG
  ) {
    notFound();
  }
  let row = rows[0];
  const input = (row.input ?? {}) as ConcurrentenSessionInput;
  const isPhase2 = Array.isArray(input.confirmed) && input.confirmed.length > 0;

  // Auto-fail voor verloren 'running'-sessies (serverless function gekilled).
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
        href={`/modules/${MODULE_SLUG}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
    </div>
  );

  // ── Bezig (fase 1 of 2) ────────────────────────────────────────────────
  if (row.status === "running") {
    const phaseLabel = isPhase2
      ? "Diepe vergelijkende analyse — dit duurt 30-90 seconden."
      : "We zoeken concurrenten op het web — dit duurt 30-90 seconden.";
    const steps = isPhase2
      ? [
          { label: "Bevestigde concurrenten verzamelen", doneAt: 5 },
          { label: "Vergelijkende analyse met AI + web search", doneAt: 60 },
          { label: "Rapport opmaken", doneAt: Number.POSITIVE_INFINITY },
        ]
      : [
          { label: "Aanbod uit je snapshot halen", doneAt: 8 },
          { label: "Web search naar concurrenten", doneAt: 60 },
          { label: "Kandidatenlijst opstellen", doneAt: Number.POSITIVE_INFINITY },
        ];
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 1000),
    );
    const elapsedLabel =
      elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    const currentStepIdx = steps.findIndex((s) => elapsed < s.doneAt);

    return (
      <>
        <RunningPoll />
        {header}
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-100 p-3 text-teal-600">
              {isPhase2 ? <UserCheck className="h-6 w-6" /> : <Search className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{moduleMeta.name}</h1>
              <p className="text-gray-600">{phaseLabel}</p>
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
              <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
              <span className="font-semibold text-gray-900">
                {isPhase2 ? "Bezig met analyseren…" : "Bezig met zoeken…"}
              </span>
              <span className="ml-auto text-sm tabular-nums text-gray-600">
                {elapsedLabel}
              </span>
            </div>
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
                      <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
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
          </p>
        </div>
      </>
    );
  }

  // ── Mislukt ────────────────────────────────────────────────────────────
  if (row.status === "failed") {
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-lg font-semibold text-rose-700">Analyse mislukt</p>
          <p className="mt-1 text-sm text-gray-700">
            {row.errorMessage ?? "Onbekende fout."}
          </p>
          <form action={regenerateConcurrentenAction} className="mt-4">
            <input type="hidden" name="sourceSessionId" value={row.id} />
            <button className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white">
              Opnieuw proberen
            </button>
          </form>
          <Link
            href={`/modules/${MODULE_SLUG}`}
            className="ml-3 text-sm text-teal-700 underline"
          >
            Of: andere invoer
          </Link>
        </div>
      </>
    );
  }

  const output = parseConcurrentenOutput(row.output);

  // ── Review: kandidaten bevestigen ──────────────────────────────────────
  if (row.status === "review") {
    if (output?.kind !== "discovery") {
      // Output hoort discovery te zijn; zo niet, laat opnieuw draaien.
      redirect(`/modules/${MODULE_SLUG}?error=${encodeURIComponent("Sessie-data onleesbaar — start een nieuwe analyse")}`);
    }
    const { discovery } = output;

    // Prefill: bevestigde concurrenten uit de laatste afgeronde run.
    const lastConfirmedRows = await db
      .select({ input: sessions.input })
      .from(sessions)
      .where(
        and(
          eq(sessions.moduleSlug, MODULE_SLUG),
          eq(sessions.userId, user.id),
          eq(sessions.status, "approved"),
        ),
      )
      .orderBy(desc(sessions.createdAt))
      .limit(1);
    const lastConfirmed: ConfirmedCompetitor[] =
      (lastConfirmedRows[0]?.input as ConcurrentenSessionInput | undefined)
        ?.confirmed ?? [];
    const lastConfirmedNames = new Set(
      lastConfirmed.map((c) => c.naam.toLowerCase()),
    );
    const candidateNames = new Set(
      discovery.kandidaten.map((k) => k.naam.toLowerCase()),
    );
    const manualPrefill = lastConfirmed.filter(
      (c) => !candidateNames.has(c.naam.toLowerCase()),
    );

    // Groepeer kandidaten per segment (volgorde van eerste voorkomen).
    const segments: { naam: string; kandidaten: typeof discovery.kandidaten }[] = [];
    for (const kandidaat of discovery.kandidaten) {
      const existing = segments.find((s) => s.naam === kandidaat.segment);
      if (existing) existing.kandidaten.push(kandidaat);
      else segments.push({ naam: kandidaat.segment, kandidaten: [kandidaat] });
    }

    return (
      <>
        {header}
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-100 p-3 text-teal-600">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                Herken je deze concurrenten?
              </h1>
              <p className="text-sm text-gray-600">
                Vink aan wie je herkent als concurrent — die gaan mee in de
                diepe analyse.
              </p>
            </div>
          </div>

          {discovery.samenvatting ? (
            <p className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950">
              {discovery.samenvatting}
            </p>
          ) : null}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <form action={confirmCompetitorsAction} className="mt-6">
            <input type="hidden" name="sessionId" value={row.id} />

            {segments.map((segment) => (
              <div key={segment.naam} className="mt-5">
                <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  {segment.naam}
                </h2>
                <ul className="mt-2 space-y-2">
                  {segment.kandidaten.map((k, i) => (
                    <li key={`${segment.naam}-${i}`}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-teal-300 has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50">
                        <input
                          type="checkbox"
                          name="kandidaat"
                          value={JSON.stringify({
                            naam: k.naam,
                            websiteUrl: k.websiteUrl,
                          })}
                          defaultChecked={lastConfirmedNames.has(
                            k.naam.toLowerCase(),
                          )}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span className="font-semibold text-gray-900">
                              {k.naam}
                            </span>
                            {k.websiteUrl ? (
                              <span className="truncate text-xs text-teal-700">
                                {k.websiteUrl}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-sm text-gray-600">
                            {k.reden}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <ManualCompetitors initial={manualPrefill} />

            <div className="mt-5">
              <SubmitButton
                label="Analyseer geselecteerde concurrenten"
                pendingLabel="Bezig met starten…"
              />
            </div>
          </form>
        </div>
      </>
    );
  }

  // ── Klaar: rapport ─────────────────────────────────────────────────────
  return (
    <>
      {header}
      <div className="mx-auto max-w-4xl px-6 py-8">
        {output?.kind === "report" ? (
          <GenericReportView moduleName={moduleMeta.name} report={output.report} />
        ) : (
          <MarkdownBlock
            markdown={output?.kind === "markdown" ? output.markdown : ""}
            variant="report"
          />
        )}

        {isPhase2 && input.confirmed ? (
          <p className="mt-4 text-xs text-gray-500">
            Geanalyseerde concurrenten:{" "}
            {input.confirmed.map((c) => c.naam).join(", ")}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <form action={regenerateConcurrentenAction}>
            <input type="hidden" name="sourceSessionId" value={row.id} />
            <button className="rounded-lg bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-2 font-semibold text-white">
              Opnieuw zoeken & analyseren
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
