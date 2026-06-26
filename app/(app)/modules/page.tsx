import Link from "next/link";
import { desc, eq, sql, inArray } from "drizzle-orm";
import { MODULES } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { markdownSnapshots, profiles, snapshotChunks } from "@/lib/db/schema";
import { MarkdownLibraryCard } from "./_components/markdown-library-card";

// Reindex kan even duren bij veel snapshots — geef 'm ruimte op Vercel.
export const maxDuration = 180;

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profile] = user
    ? await db
        .select({ websiteUrl: profiles.websiteUrl })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)
    : [];

  const snapshots = user
    ? await db
        .select()
        .from(markdownSnapshots)
        .where(eq(markdownSnapshots.userId, user.id))
        .orderBy(desc(markdownSnapshots.fetchedAt))
        .limit(10)
    : [];

  // Bepaal hoeveel snapshots géén embeddings hebben (om de reindex-knop nuttig
  // te tonen). Goedkoop: één GROUP BY query.
  const snapshotIds = snapshots.map((s) => s.id);
  const chunkCounts =
    user && snapshotIds.length > 0
      ? await db
          .select({
            snapshotId: snapshotChunks.snapshotId,
            count: sql<number>`count(*)::int`,
          })
          .from(snapshotChunks)
          .where(inArray(snapshotChunks.snapshotId, snapshotIds))
          .groupBy(snapshotChunks.snapshotId)
      : [];
  const chunkBySnapshotId = new Map(chunkCounts.map((r) => [r.snapshotId, r.count]));
  const snapshotsWithoutChunks = snapshots.filter(
    (s) => !chunkBySnapshotId.has(s.id)
  ).length;

  const reindexedCount = typeof sp.reindexed === "string" ? sp.reindexed : null;
  const reindexedChunks = typeof sp.chunks === "string" ? sp.chunks : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-5xl font-bold text-transparent">
          Core Modules
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Kies een module om een AI-gedreven analyse te starten.
        </p>
      </div>

      {reindexedCount ? (
        <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-green-200 bg-green-50 p-3 text-center text-sm text-green-800">
          ✓ {reindexedCount} snapshot{reindexedCount === "1" ? "" : "s"} opnieuw
          geïndexeerd ({reindexedChunks ?? 0} chunks).
        </div>
      ) : null}

      <div className="mt-10">
        <MarkdownLibraryCard
          defaultWebsiteUrl={profile?.websiteUrl ?? undefined}
          snapshots={snapshots}
          snapshotsWithoutChunks={snapshotsWithoutChunks}
        />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.filter((m) => !m.parentSlug).map((module) => {
          const Icon = module.icon;
          const isActive = module.status === "active";

          const card = (
            <div
              className={cn(
                "group flex h-full flex-col rounded-2xl border-2 p-5 transition-all duration-200",
                module.borderColor,
                module.bgLight,
                isActive
                  ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg"
                  : "opacity-60"
              )}
            >
              <div className="flex flex-1 items-start gap-3">
                <div
                  className={cn(
                    "shrink-0 rounded-xl bg-white p-2.5 shadow-sm",
                    module.iconColor
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="mb-1 text-base font-bold leading-tight text-gray-900">
                    {module.name}
                  </h2>
                  <p className="text-xs leading-relaxed text-gray-600">
                    {module.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                {isActive ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-lg bg-gradient-to-r px-3 py-1.5 text-xs font-semibold text-white shadow-sm",
                      module.color
                    )}
                  >
                    Start →
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
                    Binnenkort
                  </span>
                )}
              </div>
            </div>
          );

          return isActive && module.href ? (
            <Link key={module.slug} href={module.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={module.slug}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
