import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ArrowRight, CheckCircle2, Circle, Globe, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
import { MODULE_SLUG } from "@/modules/website-check";
import { getModuleLayout } from "@/lib/modules/layouts";
import { RunningPoll } from "./running-poll";

const STUCK_THRESHOLD_SECONDS = 6 * 60; // 1 min grace boven Vercel maxDuration

export default async function GratisCheckResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (rows.length === 0) {
    redirect("/gratis-check?error=" + encodeURIComponent("Check niet gevonden."));
  }
  let row = rows[0];

  // Auto-fail bij hangende running-lead (zoals in /modules/website-check).
  if (row.status === "running") {
    const elapsedSec = Math.floor(
      (Date.now() - new Date(row.createdAt).getTime()) / 1000,
    );
    if (elapsedSec > STUCK_THRESHOLD_SECONDS) {
      const failedAt = new Date();
      const msg = "Analyse onderbroken (timeout). Probeer opnieuw.";
      await db
        .update(leads)
        .set({ status: "failed", errorMessage: msg, completedAt: failedAt })
        .where(and(eq(leads.id, row.id), eq(leads.status, "running")));
      row = {
        ...row,
        status: "failed",
        errorMessage: msg,
        completedAt: failedAt,
      };
    }
  }

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
      { label: "Pagina ophalen", doneAt: 8 },
      { label: "Inhoud analyseren met AI", doneAt: 45 },
      { label: "Resultaat opmaken", doneAt: Number.POSITIVE_INFINITY },
    ];
    const currentStepIdx = steps.findIndex((s) => elapsed < s.doneAt);

    return (
      <>
        <RunningPoll />
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Gratis Website Check</h1>
              <p className="text-gray-600">
                We analyseren je website — dit duurt 20–50 seconden.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border-2 border-purple-200 bg-purple-50 p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              <span className="font-semibold text-gray-900">
                Bezig met analyseren…
              </span>
              <span className="ml-auto text-sm tabular-nums text-gray-600">
                {elapsedLabel}
              </span>
            </div>
            <p className="mt-4 truncate text-sm text-gray-700">
              <span className="font-semibold">URL:</span>{" "}
              <span className="text-purple-700">{row.websiteUrl}</span>
            </p>
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
        </div>
      </>
    );
  }

  if (row.status === "failed") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-lg font-semibold text-rose-700">Analyse mislukt</p>
        <p className="mt-2 text-sm text-gray-700">
          {row.errorMessage ?? "Onbekende fout."}
        </p>
        <p className="mt-1 text-xs text-gray-500">URL: {row.websiteUrl}</p>
        <div className="mt-6">
          <Link href="/gratis-check">
            <Button size="lg">Opnieuw proberen</Button>
          </Link>
        </div>
      </div>
    );
  }

  // status === "completed"
  const parsed = WebsiteCheckOutputSchema.safeParse(row.result);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-rose-700">
        Resultaat-output is ongeldig opgeslagen.
      </div>
    );
  }

  const layout = await getModuleLayout(MODULE_SLUG);

  return (
    <>
      <WebsiteCheckResultView data={parsed.data} layout={layout} readOnly />

      {/* CTA-strip: word lid */}
      <section className="mx-auto mt-6 mb-16 max-w-4xl px-6">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-purple-50 to-blue-50 p-8 text-center">
          <h2 className="text-2xl font-bold">
            Wil je ook ICP-analyse, LinkedIn-check en meer?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Word lid voor alle Positionr-modules in één portal.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/prijzen">
              <Button size="lg">
                Bekijk de abonnementen <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Al lid? Inloggen
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
