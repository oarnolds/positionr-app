import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  UserCheck,
} from "lucide-react";
import { and, eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions, icpProducts } from "@/lib/db/schema";
import { FinalIcpView } from "@/modules/icp-analyse/components/FinalIcpView";
import { FinalIcp } from "@/modules/icp-analyse/schema";
import { RunningPoll } from "./running-poll";

// Snel-analyse doet 2 LLM-calls. maxDuration op de mode-selectpagina is 300s,
// hier auto-failen we wat ruimer voor het geval er iets vastloopt.
const STUCK_THRESHOLD_SECONDS = 7 * 60;

export default async function ICPSnelResultPage({
  params,
}: {
  params: Promise<{ productId: string; sessionId: string }>;
}) {
  const { productId, sessionId } = await params;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) notFound();
  if (session.userId !== user.id) notFound();
  if (session.moduleSlug !== "icp-analyse") notFound();

  const [product] = await db
    .select()
    .from(icpProducts)
    .where(eq(icpProducts.id, productId))
    .limit(1);
  if (!product || product.id !== session.productId) notFound();

  let row = session;

  // Auto-fail bij hangende running-sessie (idem als Website Check).
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
      row = {
        ...row,
        status: "failed",
        errorMessage: msg,
        completedAt: failedAt,
      };
    }
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href={`/modules/icp-analyse/${productId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Modus-keuze
      </Link>
      <Link
        href={`/modules/icp-analyse?clientId=${product.clientId}`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Catalogus →
      </Link>
    </div>
  );

  // ── Running ──────────────────────────────────────────────────────
  if (row.status === "running") {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 1000),
    );
    const elapsedLabel =
      elapsed < 60
        ? `${elapsed}s`
        : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    const steps = [
      { label: "Website scannen", doneAt: 10 },
      { label: "ICP-inschatting opbouwen (Phase 1)", doneAt: 60 },
      { label: "Profiel verfijnen (Final ICP)", doneAt: Number.POSITIVE_INFINITY },
    ];
    const currentStepIdx = steps.findIndex((s) => elapsed < s.doneAt);
    const productUrl = product.websiteUrl ?? undefined;

    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <RunningPoll />
        {header}
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-100 p-3 text-cyan-700">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Ideale Klant — Snelle analyse</h1>
              <p className="text-gray-600">
                We bouwen een ICP-profiel voor <strong>{product.name}</strong> —
                dit duurt ongeveer 1-2 minuten.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-700" />
              <span className="font-semibold text-gray-900">
                Bezig met analyseren…
              </span>
              <span className="ml-auto text-sm tabular-nums text-gray-600">
                {elapsedLabel}
              </span>
            </div>

            {productUrl && (
              <p className="mt-4 truncate text-sm text-gray-700">
                <span className="font-semibold">URL:</span>{" "}
                <span className="text-cyan-700">{productUrl}</span>
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
                  <li
                    key={step.label}
                    className="flex items-center gap-2 text-sm"
                  >
                    {state === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {state === "current" && (
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-700" />
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
            Je vindt 'm terug onder de productkaart in de catalogus.
          </p>
        </div>
      </div>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────
  if (row.status === "failed") {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        {header}
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-bold text-red-900">Analyse mislukt</h2>
          <p className="mt-2 text-sm text-red-800">
            {row.errorMessage ?? "Onbekende fout"}
          </p>
          <Link
            href={`/modules/icp-analyse/${productId}`}
            className="mt-4 inline-block text-sm text-red-700 underline"
          >
            Probeer opnieuw
          </Link>
        </div>
      </div>
    );
  }

  // ── Approved ─────────────────────────────────────────────────────
  const output = (row.output ? JSON.parse(row.output) : {}) as {
    finalIcp?: unknown;
    betrouwbaarheid?: number;
  };
  const parsed = output.finalIcp ? FinalIcp.safeParse(output.finalIcp) : null;
  if (!parsed?.success) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        {header}
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-bold text-red-900">Resultaat onleesbaar</h2>
          <p className="mt-2 text-sm text-red-800">
            De analyse is wel afgerond, maar de output-data is incompleet.
          </p>
          <Link
            href={`/modules/icp-analyse/${productId}`}
            className="mt-4 inline-block text-sm text-red-700 underline"
          >
            Probeer opnieuw
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {header}
      <div className="mt-6">
        <FinalIcpView
          productName={product.name}
          data={parsed.data}
          betrouwbaarheid={output.betrouwbaarheid ?? 0}
        />
      </div>
    </div>
  );
}
