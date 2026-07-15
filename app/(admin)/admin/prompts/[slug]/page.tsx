// app/(admin)/admin/prompts/[slug]/page.tsx
//
// Hoofdpagina van de admin prompt editor. Layout: sidebar (alle modules)
// links, editor + version history rechts. Server component die de huidige
// prompt + provider + history uit de DB haalt.

import { notFound, redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import {
  modules,
  modulePromptHistory,
  profiles,
} from "@/lib/db/schema";
import { getModule } from "@/lib/modules/registry";
import { PromptsSidebar } from "./sidebar";
import { EditorPane } from "./editor-pane";
import { VersionHistory, type HistoryEntry } from "./version-history";
import { PlaceholderReference } from "./placeholder-reference";

type Placeholder = { key: string; label: string; example: string };

// Per-module placeholders dynamisch ophalen — niet elke module exporteert 'm
async function loadPlaceholders(slug: string): Promise<Placeholder[]> {
  try {
    const mod = (await import(`@/modules/${slug}/index`)) as {
      PLACEHOLDERS?: readonly Placeholder[];
    };
    return mod.PLACEHOLDERS ? [...mod.PLACEHOLDERS] : [];
  } catch {
    return [];
  }
}

export default async function PromptEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Auth: admin-only
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/prompts/${slug}`);

  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (!p || p.role !== "admin") notFound();

  // Module-bestaan check
  const meta = getModule(slug);
  if (!meta) notFound();

  // Huidige prompt + provider
  const [row] = await db
    .select({
      defaultPrompt: modules.defaultPrompt,
      provider: modules.provider,
      strictness: modules.strictness,
    })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (!row) notFound();

  // History (max 50, nieuwste eerst)
  const histRows = await db
    .select({
      id: modulePromptHistory.id,
      savedAt: modulePromptHistory.savedAt,
      savedBy: modulePromptHistory.savedBy,
      prompt: modulePromptHistory.prompt,
      provider: modulePromptHistory.provider,
    })
    .from(modulePromptHistory)
    .where(eq(modulePromptHistory.moduleSlug, slug))
    .orderBy(desc(modulePromptHistory.savedAt))
    .limit(50);

  // Naam-lookup voor savedBy (toon "Olivier" i.p.v. UUID)
  const ids = Array.from(new Set(histRows.map((h) => h.savedBy)));
  const nameMap = new Map<string, string>();
  if (ids.length > 0) {
    const profs = await db
      .select({ id: profiles.id, fullName: profiles.fullName })
      .from(profiles);
    for (const pr of profs) {
      if (ids.includes(pr.id)) nameMap.set(pr.id, pr.fullName ?? "—");
    }
  }

  const historyEntries: HistoryEntry[] = histRows.map((h) => ({
    id: h.id,
    savedAt: h.savedAt.toISOString(),
    savedByName: nameMap.get(h.savedBy) ?? "—",
    provider: h.provider as "claude" | "perplexity",
    promptPreview: h.prompt.slice(0, 80),
  }));

  const placeholders = await loadPlaceholders(slug);

  return (
    <div className="flex h-[calc(100vh-60px)]">
      <PromptsSidebar activeSlug={slug} />
      <div className="flex-1 overflow-y-auto">
        <EditorPane
          slug={slug}
          moduleName={meta.name}
          moduleStatus={meta.status}
          initialPrompt={row.defaultPrompt ?? ""}
          initialProvider={row.provider as "claude" | "perplexity"}
          initialStrictness={row.strictness ?? 3}
          placeholders={placeholders}
        />
        <div className="border-t border-gray-200 px-8 py-4">
          <VersionHistory slug={slug} entries={historyEntries} />
        </div>
        <div className="px-8 pb-8">
          <PlaceholderReference />
        </div>
      </div>
    </div>
  );
}
