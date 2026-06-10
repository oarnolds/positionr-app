"use server";

import { eq, desc, and, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules, moduleLayoutHistory } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { LayoutConfig } from "./layout";
import type { LayoutConfig as LayoutConfigType } from "./layout";

const KEEP_HISTORY = 5;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function ensureModuleExists(slug: string): Promise<void> {
  const rows = await db
    .select({ slug: modules.slug })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(`Module ${slug} niet in DB`);
  }
}

async function pruneHistory(slug: string): Promise<void> {
  // Hou de meest recente KEEP_HISTORY rijen, verwijder de rest.
  const keep = await db
    .select({ id: moduleLayoutHistory.id })
    .from(moduleLayoutHistory)
    .where(eq(moduleLayoutHistory.moduleSlug, slug))
    .orderBy(desc(moduleLayoutHistory.savedAt))
    .limit(KEEP_HISTORY);
  const keepIds = keep.map((r) => r.id);
  if (keepIds.length === 0) return;
  await db
    .delete(moduleLayoutHistory)
    .where(
      and(
        eq(moduleLayoutHistory.moduleSlug, slug),
        notInArray(moduleLayoutHistory.id, keepIds),
      ),
    );
}

/**
 * Slaat een nieuwe layout op:
 *  - Valideert met Zod
 *  - Update `modules.layout_config`
 *  - Voegt history-rij toe
 *  - Prunet history naar laatste KEEP_HISTORY (=5)
 */
export async function saveModuleLayout(
  slug: string,
  config: LayoutConfigType,
  note: string | null = null,
): Promise<void> {
  const parsed = LayoutConfig.parse(config);
  await ensureModuleExists(slug);
  const userId = await currentUserId();

  await db
    .update(modules)
    .set({ layoutConfig: parsed })
    .where(eq(modules.slug, slug));

  await db.insert(moduleLayoutHistory).values({
    moduleSlug: slug,
    layoutConfig: parsed,
    savedBy: userId,
    note,
  });

  await pruneHistory(slug);
}

/**
 * Reset naar default — zet `modules.layout_config` op NULL.
 * Voegt expliciet GEEN history-rij toe (NULL is geen versie).
 */
export async function resetModuleLayout(slug: string): Promise<void> {
  await ensureModuleExists(slug);
  await db
    .update(modules)
    .set({ layoutConfig: null })
    .where(eq(modules.slug, slug));
}

/**
 * Herstelt een eerder opgeslagen versie:
 *  - Pakt config uit de history-rij
 *  - Roept `saveModuleLayout` aan met note "Hersteld van versie xxxxxxx"
 *    zodat de restore zelf ook in de history zit (traceerbaar).
 */
export async function restoreModuleLayout(
  slug: string,
  historyId: string,
): Promise<void> {
  const rows = await db
    .select({ layoutConfig: moduleLayoutHistory.layoutConfig })
    .from(moduleLayoutHistory)
    .where(eq(moduleLayoutHistory.id, historyId))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(`History entry ${historyId} niet gevonden`);
  }
  const config = LayoutConfig.parse(rows[0].layoutConfig);
  const shortId = historyId.slice(0, 8);
  await saveModuleLayout(slug, config, `Hersteld van versie ${shortId}`);
}

export type LayoutHistoryEntry = {
  id: string;
  layoutConfig: LayoutConfigType;
  savedAt: Date;
  note: string | null;
};

/**
 * Haalt de laatste KEEP_HISTORY history-entries op voor een module,
 * gesorteerd op savedAt desc. Parsed elke config.
 */
export async function getModuleLayoutHistory(
  slug: string,
): Promise<LayoutHistoryEntry[]> {
  const rows = await db
    .select({
      id: moduleLayoutHistory.id,
      layoutConfig: moduleLayoutHistory.layoutConfig,
      savedAt: moduleLayoutHistory.savedAt,
      note: moduleLayoutHistory.note,
    })
    .from(moduleLayoutHistory)
    .where(eq(moduleLayoutHistory.moduleSlug, slug))
    .orderBy(desc(moduleLayoutHistory.savedAt))
    .limit(KEEP_HISTORY);
  return rows.map((r) => ({
    id: r.id,
    layoutConfig: LayoutConfig.parse(r.layoutConfig),
    savedAt: r.savedAt,
    note: r.note,
  }));
}
