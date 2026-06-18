import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { apkRuns, sessions, markdownSnapshots } from "@/lib/db/schema";
import { MODULES } from "@/lib/modules/registry";
import { RunningPoll } from "../../website-check/[sessionId]/running-poll";

// Vercel Pro: max 300s — geldt ook voor de after()-callbacks die de
// individuele module-runs uitvoeren.
export const maxDuration = 300;

function formatRelativeAge(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min geleden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} uur geleden`;
  return `${Math.floor(h / 24)} dag${Math.floor(h / 24) === 1 ? "" : "en"} geleden`;
}

function getModuleHref(slug: string, sessionId: string): string | undefined {
  if (slug === "website-check") return `/modules/website-check/${sessionId}`;
  return undefined;
}

function getModuleName(slug: string): string {
  return MODULES.find((m) => m.slug === slug)?.name ?? slug;
}

export default async function ApkRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/apk/${runId}`);

  const [run] = await db
    .select()
    .from(apkRuns)
    .where(eq(apkRuns.id, runId))
    .limit(1);
  if (!run || run.userId !== user.id) notFound();

  const [snapshot] = run.snapshotId
    ? await db
        .select()
        .from(markdownSnapshots)
        .where(eq(markdownSnapshots.id, run.snapshotId))
        .limit(1)
    : [];

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.apkRunId, runId), eq(sessions.userId, user.id)))
    .orderBy(asc(sessions.createdAt));

  const anyRunning = sessionRows.some((s) => s.status === "running");

  const okPages = snapshot?.pages.filter((p) => p.status === "ok") ?? [];

  return (
    <>
      {anyRunning ? <RunningPoll /> : null}

      <div className="mx-auto max-w-4xl px-6 pt-6">
        <Link
          href="/modules"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar modules
        </Link>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Je start APK</h1>
            <p className="text-gray-600">{run.sourceUrl}</p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <FileText className="h-5 w-5 text-purple-600" />
            Markdown-snapshot
          </h2>
          {snapshot ? (
            <div className="mt-3 space-y-1 text-sm text-gray-700">
              <div>
                <span className="font-semibold">Titel:</span>{" "}
                {snapshot.title || <em className="text-gray-500">geen titel</em>}
              </div>
              <div>
                <span className="font-semibold">Pagina&apos;s opgehaald:</span>{" "}
                {okPages.length} / {snapshot.pages.length}
              </div>
              <div>
                <span className="font-semibold">Markdown-lengte:</span>{" "}
                {snapshot.markdown.length.toLocaleString("nl-NL")} tekens
              </div>
              <div>
                <span className="font-semibold">Status:</span>{" "}
                {run.snapshotWasCached ? (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    Uit cache · {formatRelativeAge(snapshot.fetchedAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    Vers gemaakt
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-red-600">
              Snapshot niet beschikbaar (gefaald of verwijderd).
            </p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-base font-bold text-gray-900">
            Gestarte analyses
          </h2>
          <ul className="space-y-3">
            {sessionRows.map((s) => {
              const name = getModuleName(s.moduleSlug);
              const href = getModuleHref(s.moduleSlug, s.id);
              const StatusIcon =
                s.status === "running"
                  ? Loader2
                  : s.status === "failed"
                    ? XCircle
                    : CheckCircle2;
              const statusColor =
                s.status === "running"
                  ? "text-purple-600"
                  : s.status === "failed"
                    ? "text-red-600"
                    : "text-green-600";
              const statusLabel =
                s.status === "running"
                  ? "Bezig…"
                  : s.status === "failed"
                    ? "Mislukt"
                    : s.status === "approved"
                      ? "Klaar"
                      : s.status === "review"
                        ? "Wacht op review"
                        : s.status;

              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{name}</div>
                    <div
                      className={`mt-0.5 inline-flex items-center gap-1 text-sm ${statusColor}`}
                    >
                      <StatusIcon
                        className={`h-4 w-4 ${
                          s.status === "running" ? "animate-spin" : ""
                        }`}
                      />
                      {statusLabel}
                    </div>
                    {s.errorMessage ? (
                      <div className="mt-1 text-xs text-red-600">
                        {s.errorMessage}
                      </div>
                    ) : null}
                  </div>
                  {href ? (
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700"
                    >
                      Open
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
            {sessionRows.length === 0 ? (
              <li className="rounded-xl border bg-white p-4 text-sm text-gray-500">
                Geen sessies gevonden voor deze APK-run.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </>
  );
}
