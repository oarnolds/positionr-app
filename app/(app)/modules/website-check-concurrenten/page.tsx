// Startpagina van de concurrentie-analyse (twee fases). Deze statische
// route wint van de dynamische generieke /modules/[slug]-route.

import Link from "next/link";
import { ArrowLeft, Globe, BookMarked } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { desc, eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { markdownSnapshots, profiles, sessions } from "@/lib/db/schema";
import { getModule } from "@/lib/modules/registry";
import { MODULE_SLUG } from "@/modules/concurrenten/schema";
import { cn } from "@/lib/utils";
import { startConcurrentenAction } from "./actions";
import { SubmitButton } from "../_components/submit-button";

export const maxDuration = 300;

export default async function ConcurrentenStartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const moduleMeta = getModule(MODULE_SLUG);
  if (!moduleMeta) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/${MODULE_SLUG}`);

  const [profile] = await db
    .select({ companyName: profiles.companyName })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const snapshots = await db
    .select({
      id: markdownSnapshots.id,
      title: markdownSnapshots.title,
      sourceFilename: markdownSnapshots.sourceFilename,
      sourceUrl: markdownSnapshots.sourceUrl,
      fetchedAt: markdownSnapshots.fetchedAt,
    })
    .from(markdownSnapshots)
    .where(eq(markdownSnapshots.userId, user.id))
    .orderBy(desc(markdownSnapshots.fetchedAt))
    .limit(20);

  const previousSessions = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      input: sessions.input,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(eq(sessions.moduleSlug, MODULE_SLUG), eq(sessions.userId, user.id)))
    .orderBy(desc(sessions.createdAt))
    .limit(10);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="rounded-xl bg-teal-100 p-3 text-teal-600">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{moduleMeta.name}</h1>
          <p className="mt-1 text-gray-600">
            De AI zoekt eerst kandidaat-concurrenten op basis van je aanbod en
            geografie. Jij bevestigt welke kloppen, daarna volgt de diepe
            vergelijkende analyse.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <BookMarked className="h-4 w-4" />
            Je markdown-bibliotheek is nog leeg
          </div>
          <p className="mt-2">
            Deze analyse draait op een markdown-snapshot van je website. Maak
            er eerst één aan via de{" "}
            <Link href="/modules" className="font-semibold underline">
              Markdown bibliotheek
            </Link>{" "}
            en kom daarna terug.
          </p>
        </div>
      ) : (
        <form
          action={startConcurrentenAction}
          className={cn(
            "mt-8 rounded-2xl border-2 p-6",
            moduleMeta.borderColor,
            moduleMeta.bgLight,
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold text-gray-700">Bedrijfsnaam</span>
              <input
                name="companyName"
                type="text"
                defaultValue={profile?.companyName ?? ""}
                placeholder="bijv. Uw Bedrijf B.V."
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-gray-700">
                Markdown-bron uit je bibliotheek
              </span>
              <select
                name="snapshotId"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.sourceFilename || s.sourceUrl} (
                    {new Date(s.fetchedAt).toLocaleDateString("nl-NL")})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm">
            <span className="font-semibold text-gray-700">
              Geografische focus
            </span>
            <input
              name="geografie"
              type="text"
              defaultValue="Nederland"
              placeholder="bijv. Nederland, Benelux of Randstad"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold text-gray-700">
                Sector{" "}
                <span className="font-normal text-gray-500">(optioneel)</span>
              </span>
              <input
                name="sector"
                type="text"
                placeholder="bijv. IT-dienstverlening"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-gray-700">
                Extra context{" "}
                <span className="font-normal text-gray-500">(optioneel)</span>
              </span>
              <input
                name="description"
                type="text"
                placeholder="bijv. focus op mkb-klanten"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </label>
          </div>

          <div className="mt-5">
            <SubmitButton
              label="Zoek concurrenten"
              pendingLabel="Bezig met starten…"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            De AI zoekt live op het web (30-90 sec). Daarna kies jij welke
            kandidaten meegaan in de diepe analyse.
          </p>
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
                companyName?: string;
                geografie?: string;
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
                      {input.companyName ?? "—"}
                      {input.geografie ? ` · ${input.geografie}` : ""}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="shrink-0">{date}</span>
                    <span className="text-gray-400">·</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        s.status === "approved"
                          ? "text-green-700"
                          : s.status === "review"
                            ? "text-amber-700"
                            : s.status === "failed"
                              ? "text-red-700"
                              : "text-gray-500",
                      )}
                    >
                      {s.status === "review" ? "wacht op review" : s.status}
                    </span>
                  </div>
                  <Link
                    href={`/modules/${MODULE_SLUG}/${s.id}`}
                    className="shrink-0 text-xs font-semibold text-teal-700 hover:underline"
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
