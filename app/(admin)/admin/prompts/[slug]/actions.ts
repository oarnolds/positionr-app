// app/(admin)/admin/prompts/[slug]/actions.ts
//
// Server actions voor de admin prompt editor:
//   - savePrompt: opslaan van prompt+provider (snapshot huidige naar history)
//   - resetPrompt: terugzetten naar FALLBACK_PROMPT uit code
//   - restoreVersion: oude versie uit history terugzetten
//
// Allemaal admin-only. RLS doet zijn werk; de requireAdmin-guard hier voorkomt
// dat een non-admin überhaupt de query kan triggeren.

"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import {
  modules,
  modulePromptHistory,
  profiles,
} from "@/lib/db/schema";
import { FALLBACK_PROMPTS } from "@/lib/modules/fallback-prompts";

// "both" bewust uit de selectable set gehaald — synthese-modus leverde
// geen betere rapportages tegenover ~3× kosten en runtime. DB-enum behoudt
// 'both' nog voor historische sessies/llm_model-display.
const ProviderSchema = z.enum(["claude", "perplexity"]);
const SaveInputSchema = z.object({
  slug: z.string().min(1),
  prompt: z.string(),
  provider: ProviderSchema,
});

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd");

  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!p || p.role !== "admin") throw new Error("Alleen admins");
  return { userId: user.id };
}

/** Snapshot huidige prompt+provider naar history. */
async function snapshotToHistory(slug: string, userId: string): Promise<void> {
  const [current] = await db
    .select({
      prompt: modules.defaultPrompt,
      provider: modules.provider,
    })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (!current) throw new Error(`Module ${slug} niet in DB`);
  await db.insert(modulePromptHistory).values({
    moduleSlug: slug,
    prompt: current.prompt ?? "",
    provider: current.provider,
    savedBy: userId,
  });
}

/** Sla een nieuwe prompt + provider op. */
export async function savePrompt(input: unknown): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = SaveInputSchema.parse(input);

  await snapshotToHistory(parsed.slug, userId);

  await db
    .update(modules)
    .set({ defaultPrompt: parsed.prompt, provider: parsed.provider })
    .where(eq(modules.slug, parsed.slug));

  revalidatePath(`/admin/prompts/${parsed.slug}`);
}

/** Zet de prompt terug naar de FALLBACK_PROMPT uit code (Reset-knop). */
export async function resetPrompt(input: { slug: string }): Promise<void> {
  const { userId } = await requireAdmin();
  const slug = z.string().min(1).parse(input.slug);

  const fallback = FALLBACK_PROMPTS[slug];
  if (!fallback) throw new Error(`Geen fallback prompt voor module ${slug}`);

  await snapshotToHistory(slug, userId);

  await db
    .update(modules)
    .set({ defaultPrompt: fallback })
    .where(eq(modules.slug, slug));

  revalidatePath(`/admin/prompts/${slug}`);
}

/** Zet een oude versie terug uit history. */
export async function restoreVersion(input: {
  slug: string;
  historyId: string;
}): Promise<void> {
  const { userId } = await requireAdmin();
  const slug = z.string().min(1).parse(input.slug);
  const historyId = z.string().uuid().parse(input.historyId);

  const [hist] = await db
    .select({
      prompt: modulePromptHistory.prompt,
      provider: modulePromptHistory.provider,
    })
    .from(modulePromptHistory)
    .where(
      and(
        eq(modulePromptHistory.id, historyId),
        eq(modulePromptHistory.moduleSlug, slug),
      ),
    )
    .limit(1);
  if (!hist) throw new Error(`History-entry ${historyId} niet gevonden`);

  await snapshotToHistory(slug, userId);

  await db
    .update(modules)
    .set({ defaultPrompt: hist.prompt, provider: hist.provider })
    .where(eq(modules.slug, slug));

  revalidatePath(`/admin/prompts/${slug}`);
}
