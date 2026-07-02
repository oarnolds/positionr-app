import Link from "next/link";
import { ArrowLeft, Box, Zap, ClipboardList } from "lucide-react";
import { eq, desc } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { clients, icpProducts, markdownSnapshots, sessions } from "@/lib/db/schema";
import { ModeSelector } from "@/modules/icp-analyse/components/ModeSelector";

// Snelle analyse doet 2 LLM-calls (Phase 1 + Final) synchroon in de
// startSnelAnalyse-actie; default Vercel-timeout (60s) was net te krap
// → form bleef hangen terwijl DB-write al was gelukt. 300s geeft ruim
// marge tot we de actie naar het async fire-and-forget-patroon migreren.
export const maxDuration = 300;

export default async function ICPModeSelectPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { productId } = await params;
  const { error } = await searchParams;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [productData] = await db
    .select()
    .from(icpProducts)
    .where(eq(icpProducts.id, productId))
    .limit(1);
  if (!productData) notFound();

  const [clientData] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, productData.clientId))
    .limit(1);
  if (!clientData || clientData.userId !== user.id) notFound();

  // Markdown-bibliotheek van de user — als bronkeuze voor de markdown-modus.
  const snapshotRows = await db
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
  const snapshotOptions = snapshotRows.map((s) => ({
    id: s.id,
    label: `${s.title || s.sourceFilename || s.sourceUrl} (${new Date(
      s.fetchedAt
    ).toLocaleDateString("nl-NL")})`,
  }));

  // Eerdere sessies voor dit product
  const previousSessions = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      input: sessions.input,
      output: sessions.output,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.productId, productId))
    .orderBy(desc(sessions.createdAt))
    .limit(10);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/modules/icp-analyse?clientId=${clientData.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar catalogus
      </Link>

      {/* Product context-card */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="rounded-xl bg-blue-100 p-2.5 text-blue-600">
          <Box className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-gray-900">
              {productData.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                productData.prominentie === "hoog"
                  ? "bg-blue-100 text-blue-700"
                  : productData.prominentie === "middel"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {productData.prominentie}
            </span>
          </div>
          {productData.description && (
            <p className="mt-1 text-sm text-gray-600">
              {productData.description}
            </p>
          )}
        </div>
      </div>

      <h2 className="mt-8 text-xl font-bold">Kies analysemodus</h2>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4">
        <ModeSelector productId={productId} snapshots={snapshotOptions} />
      </div>

      {previousSessions.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-gray-700">
            Eerdere analyses ({previousSessions.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {previousSessions.map((s) => {
              const input = (s.input ?? {}) as { analysisMode?: string };
              const date = s.createdAt
                ? new Date(s.createdAt).toLocaleString("nl-NL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "";
              const isFailed = s.status === "failed";
              let link: string | null = null;
              if (!isFailed) {
                if (input.analysisMode === "snel" && s.status === "approved") {
                  link = `/modules/icp-analyse/${productId}/snel/${s.id}`;
                } else if (input.analysisMode === "volledig") {
                  if (s.status === "approved")
                    link = `/modules/icp-analyse/${productId}/volledig/${s.id}/profiel`;
                  else if (s.status === "review")
                    link = `/modules/icp-analyse/${productId}/volledig/${s.id}/phase1`;
                }
              }
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-gray-700">
                    {input.analysisMode === "snel" ? (
                      <Zap className="h-3.5 w-3.5 text-cyan-600" />
                    ) : (
                      <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    <span className="capitalize">
                      {input.analysisMode ?? "onbekend"}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span>{date}</span>
                    <span className="text-gray-400">·</span>
                    <span
                      className={`text-xs ${
                        s.status === "approved"
                          ? "text-green-700"
                          : s.status === "failed"
                          ? "text-red-700"
                          : "text-gray-500"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  {link ? (
                    <Link
                      href={link}
                      className="text-xs font-semibold text-cyan-700 hover:underline"
                    >
                      Bekijk →
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
