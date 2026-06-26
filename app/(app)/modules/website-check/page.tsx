import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";
import { redirect } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles, sessions } from "@/lib/db/schema";
import { MODULE_SLUG } from "@/modules/website-check";
import { startAnalysis, startAnalysisFromMarkdown } from "./actions";
import { findAnySnapshot } from "@/lib/scraping/snapshot-service";

// Vercel Pro: max 300s. runAnalysis loopt via after() binnen dezelfde
// function-lifecycle, dus dit budget geldt ook voor de achtergrond-analyse.
// 60s was te krap voor grotere sites (de eerdere approved runs zaten 52-58s,
// gevaarlijk dicht bij het plafond).
export const maxDuration = 300;

export default async function WebsiteCheckHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/website-check");

  const [profile] = await db
    .select({ companyName: profiles.companyName, websiteUrl: profiles.websiteUrl })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const history = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      input: sessions.input,
      output: sessions.output,
      status: sessions.status,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), eq(sessions.moduleSlug, MODULE_SLUG)))
    .orderBy(desc(sessions.createdAt))
    .limit(20);

  const existingSnapshot = profile?.websiteUrl
    ? await findAnySnapshot(user.id, "website", profile.websiteUrl)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/modules" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Website Check</h1>
          <p className="text-gray-600">
            Analyseer uw B2B-website op waardepropositie, CTA&apos;s, content en verbeterpunten.
          </p>
        </div>
      </div>

      <form action={startAnalysis} className="mt-8 space-y-3 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Website-URL</span>
          <input
            name="websiteUrl"
            type="text"
            defaultValue={profile?.websiteUrl ?? ""}
            placeholder="bijv. https://uwbedrijf.nl"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Bedrijfsnaam (optioneel)</span>
          <input
            name="companyName"
            type="text"
            defaultValue={profile?.companyName ?? ""}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 font-semibold text-white"
          >
            Analyseer website
          </button>
          <button
            type="submit"
            formAction={startAnalysisFromMarkdown}
            className="rounded-lg border-2 border-purple-600 bg-white px-4 py-2 font-semibold text-purple-700 hover:bg-purple-50"
          >
            Analyseer obv markdown
          </button>
        </div>
        <p className="text-xs text-gray-600">
          <strong>Analyseer website</strong>: scrape live + bestaande prompt.{" "}
          <strong>Analyseer obv markdown</strong>: gebruikt de markdown-snapshot uit je bibliotheek
          (rijker, geen verse fetch).{" "}
          {existingSnapshot ? (
            <span className="text-green-700">
              ✓ Snapshot beschikbaar voor {profile?.websiteUrl}.
            </span>
          ) : (
            <span className="text-amber-700">
              Nog geen snapshot — maak er eerst één via{" "}
              <Link href="/modules" className="underline">
                Markdown bibliotheek
              </Link>
              .
            </span>
          )}
        </p>
      </form>

      <h2 className="mt-10 mb-2 text-lg font-bold">Eerdere checks</h2>
      {history.length === 0 ? (
        <p className="text-sm text-gray-500">Nog geen eerdere analyses.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => {
            const input = (h.input as { websiteUrl?: string }) ?? {};
            const out = (h.output as { overallScore?: number } | null) ?? null;
            return (
              <li key={h.id}>
                <Link
                  href={`/modules/website-check/${h.id}`}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
                >
                  <div>
                    <div className="text-sm font-semibold">{input.websiteUrl ?? "—"}</div>
                    <div className="text-xs text-gray-500">
                      {h.createdAt instanceof Date ? h.createdAt.toLocaleString("nl-NL") : String(h.createdAt)} · {h.status}
                    </div>
                  </div>
                  {out?.overallScore !== undefined && (
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 text-sm font-bold text-purple-700">
                      {out.overallScore.toFixed(1)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
