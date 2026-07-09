// Generieke module-pagina: formulier + geschiedenis voor elke module die op
// de generieke runner draait (zie GENERIC_MODULES). Statische routes zoals
// /modules/website-check en /modules/icp-analyse winnen van deze dynamische
// route, dus die behouden hun eigen flows.

import Link from "next/link";
import { ArrowLeft, BookMarked } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { markdownSnapshots, profiles, sessions } from "@/lib/db/schema";
import { getModule } from "@/lib/modules/registry";
import {
  GENERIC_MODULES,
  isGenericModule,
  moduleSourceTypes,
} from "@/modules/generic/schema";
import { cn } from "@/lib/utils";
import { startGenericAnalysisAction } from "./actions";
import { SubmitButton } from "../_components/submit-button";
import { DeleteSessionButton } from "../_components/delete-session-button";
import { SourcePicker } from "../_components/source-picker";

export const maxDuration = 300;

export default async function GenericModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  if (!isGenericModule(slug)) notFound();
  const moduleMeta = getModule(slug);
  if (!moduleMeta) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/${slug}`);

  const [profile] = await db
    .select({
      companyName: profiles.companyName,
      websiteUrl: profiles.websiteUrl,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const previousSessions = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      input: sessions.input,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(eq(sessions.moduleSlug, slug), eq(sessions.userId, user.id)))
    .orderBy(desc(sessions.createdAt))
    .limit(10);

  // Bibliotheek-snapshots als bronkeuze (alle kinds: website, PDF, Word).
  const snapshots = await db
    .select({
      id: markdownSnapshots.id,
      title: markdownSnapshots.title,
      sourceFilename: markdownSnapshots.sourceFilename,
      sourceUrl: markdownSnapshots.sourceUrl,
      kind: markdownSnapshots.kind,
      fetchedAt: markdownSnapshots.fetchedAt,
    })
    .from(markdownSnapshots)
    .where(eq(markdownSnapshots.userId, user.id))
    .orderBy(desc(markdownSnapshots.fetchedAt))
    .limit(20);

  const Icon = moduleMeta.icon;
  const sourceTypes = moduleSourceTypes(slug);
  const moduleConfig = GENERIC_MODULES[slug];
  // Alleen-bibliotheek-modules houden de klassieke select in het formulier;
  // alle andere combinaties lopen via de SourcePicker.
  const libraryOnly = sourceTypes.length === 1 && sourceTypes[0] === "library";
  const snapshotOptions = snapshots.map((s) => ({
    id: s.id,
    label: `${s.title || s.sourceFilename || s.sourceUrl} (${new Date(
      s.fetchedAt,
    ).toLocaleDateString("nl-NL")})`,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-start gap-3">
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
          <p className="mt-1 text-gray-600">{moduleMeta.description}</p>
        </div>
      </div>

      {moduleConfig?.steps && moduleConfig.steps.length > 0 && (
        <ol className="mt-6 space-y-2 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
          {moduleConfig.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {snapshots.length === 0 && libraryOnly ? (
        <div className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <BookMarked className="h-4 w-4" />
            Je markdown-bibliotheek is nog leeg
          </div>
          <p className="mt-2">
            Deze analyse draait op een markdown-snapshot van je website, PDF of
            Word-document. Maak er eerst één aan via de{" "}
            <Link href="/modules" className="font-semibold underline">
              Markdown bibliotheek
            </Link>{" "}
            en kom daarna terug.
          </p>
        </div>
      ) : (
      <form
        action={startGenericAnalysisAction}
        encType="multipart/form-data"
        className={cn(
          "mt-8 rounded-2xl border-2 p-6",
          moduleMeta.borderColor,
          moduleMeta.bgLight,
        )}
      >
        <input type="hidden" name="moduleSlug" value={slug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Bedrijfsnaam</span>
            <input
              name="companyName"
              type="text"
              defaultValue={profile?.companyName ?? ""}
              placeholder="bijv. Uw Bedrijf B.V."
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </label>
          {libraryOnly && (
            <label className="block text-sm">
              <span className="font-semibold text-gray-700">
                Markdown-bron uit je bibliotheek
              </span>
              <select
                name="snapshotId"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {snapshotOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!libraryOnly && (
          <div className="mt-4 text-sm">
            <span className="font-semibold text-gray-700">
              Bron voor de analyse
            </span>
            <div className="mt-2">
              <SourcePicker
                sourceTypes={sourceTypes}
                snapshots={snapshotOptions}
                urlLabel={moduleConfig?.urlLabel}
                urlPlaceholder={moduleConfig?.urlPlaceholder}
                fileHint={moduleConfig?.fileHint}
              />
            </div>
          </div>
        )}

        <label className="mt-4 block text-sm">
          <span className="font-semibold text-gray-700">
            {moduleConfig?.sectorLabel ?? "Sector"}{" "}
            <span className="font-normal text-gray-500">(optioneel)</span>
          </span>
          <input
            name="sector"
            type="text"
            placeholder={
              moduleConfig?.sectorPlaceholder ?? "bijv. IT-dienstverlening"
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </label>

        <label className="mt-4 block text-sm">
          <span className="font-semibold text-gray-700">
            {moduleConfig?.descriptionLabel ?? "Korte beschrijving van je bedrijf"}{" "}
            <span className="font-normal text-gray-500">(optioneel)</span>
          </span>
          <textarea
            name="description"
            rows={2}
            placeholder={
              moduleConfig?.descriptionPlaceholder ?? "Wat doen jullie, voor wie?"
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </label>

        <div className="mt-5">
          <SubmitButton label="Analyse starten" pendingLabel="Bezig met starten…" />
        </div>
        {sourceTypes.includes("library") && (
          <p className="mt-2 text-xs text-gray-500">
            De analyse gebruikt het gekozen markdown-snapshot als bron. Nieuwe
            of verse markdown maak je in de{" "}
            <Link href="/modules" className="underline">
              Markdown bibliotheek
            </Link>
            .
          </p>
        )}
      </form>
      )}

      {previousSessions.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-gray-700">
            Eerdere analyses ({previousSessions.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {previousSessions.map((s) => {
              const input = (s.input ?? {}) as {
                websiteUrl?: string;
                companyName?: string;
              };
              const date = s.createdAt
                ? new Date(s.createdAt).toLocaleString("nl-NL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "";
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2 text-gray-700">
                    <span className="truncate">
                      {input.companyName ?? input.websiteUrl ?? "—"}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="shrink-0">{date}</span>
                    <span className="text-gray-400">·</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        s.status === "approved"
                          ? "text-green-700"
                          : s.status === "failed"
                            ? "text-red-700"
                            : "text-gray-500",
                      )}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/modules/${slug}/${s.id}`}
                      className="text-xs font-semibold text-purple-700 hover:underline"
                    >
                      Bekijk →
                    </Link>
                    <DeleteSessionButton
                      sessionId={s.id}
                      path={`/modules/${slug}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
