// Generieke module-pagina: formulier + geschiedenis voor elke module die op
// de generieke runner draait (zie GENERIC_MODULES). Statische routes zoals
// /modules/website-check en /modules/icp-analyse winnen van deze dynamische
// route, dus die behouden hun eigen flows.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles, sessions } from "@/lib/db/schema";
import { getModule } from "@/lib/modules/registry";
import { GENERIC_MODULES, isGenericModule } from "@/modules/generic/schema";
import { cn } from "@/lib/utils";
import { startGenericAnalysisAction } from "./actions";
import { SubmitButton } from "../_components/submit-button";

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

  const { needsCompetitors } = GENERIC_MODULES[slug];
  const Icon = moduleMeta.icon;

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

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        action={startGenericAnalysisAction}
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
          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Website-URL</span>
            <input
              name="websiteUrl"
              type="text"
              defaultValue={profile?.websiteUrl ?? ""}
              placeholder="bijv. https://uwbedrijf.nl"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-semibold text-gray-700">
            Sector <span className="font-normal text-gray-500">(optioneel)</span>
          </span>
          <input
            name="sector"
            type="text"
            placeholder="bijv. IT-dienstverlening"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </label>

        <label className="mt-4 block text-sm">
          <span className="font-semibold text-gray-700">
            Korte beschrijving van je bedrijf{" "}
            <span className="font-normal text-gray-500">(optioneel)</span>
          </span>
          <textarea
            name="description"
            rows={2}
            placeholder="Wat doen jullie, voor wie?"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </label>

        {needsCompetitors ? (
          <label className="mt-4 block text-sm">
            <span className="font-semibold text-gray-700">Concurrenten</span>
            <textarea
              name="competitors"
              rows={3}
              required
              placeholder={"Eén concurrent per regel (naam of URL)\nbijv. https://concurrent1.nl"}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </label>
        ) : null}

        <fieldset className="mt-4 text-sm">
          <legend className="font-semibold text-gray-700">Bron</legend>
          <label className="mt-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="analysisMode"
              value="scrape"
              defaultChecked
              className="h-3.5 w-3.5 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-gray-700">
              Live website scrapen (of recente cache)
            </span>
          </label>
          <label className="mt-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="analysisMode"
              value="markdown"
              className="h-3.5 w-3.5 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-gray-700">
              Markdown-snapshot uit je bibliotheek (moet al bestaan voor deze URL)
            </span>
          </label>
        </fieldset>

        <div className="mt-5">
          <SubmitButton label="Analyse starten" pendingLabel="Bezig met starten…" />
        </div>
      </form>

      {previousSessions.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-gray-700">
            Eerdere analyses ({previousSessions.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {previousSessions.map((s) => {
              const input = (s.input ?? {}) as { websiteUrl?: string };
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
                    <span className="truncate">{input.websiteUrl ?? "—"}</span>
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
                  <Link
                    href={`/modules/${slug}/${s.id}`}
                    className="shrink-0 text-xs font-semibold text-purple-700 hover:underline"
                  >
                    Bekijk →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
