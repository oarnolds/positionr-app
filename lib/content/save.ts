"use server";

import { and, desc, eq, ne, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { siteContent, siteContentHistory } from "@/lib/db/schema";
import { CONTENT_META, type ContentKey } from "./registry";
import { requireAdmin } from "./require-admin";
import { sanitizeRich } from "./sanitize";

const KEEP_HISTORY = 20;

type Result<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/** Bewaar de laatste KEEP_HISTORY entries per key, verwijder oudere. */
async function pruneHistory(key: string): Promise<void> {
  const keep = await db
    .select({ id: siteContentHistory.id })
    .from(siteContentHistory)
    .where(eq(siteContentHistory.key, key))
    .orderBy(desc(siteContentHistory.savedAt))
    .limit(KEEP_HISTORY);
  if (keep.length === 0) return;
  await db
    .delete(siteContentHistory)
    .where(
      and(
        eq(siteContentHistory.key, key),
        notInArray(
          siteContentHistory.id,
          keep.map((r) => r.id),
        ),
      ),
    );
}

/**
 * Sla een content-waarde op.
 * - Admin-only (throwt anders).
 * - Sanitize rich-velden (strip script/iframe/event-handlers).
 * - Upsert op site_content.
 * - Insert history-entry.
 * - Prune history naar laatste KEEP_HISTORY.
 * - Revalidate homepage-cache.
 */
export async function saveContent(
  key: ContentKey,
  value: string,
  note: string | null = null,
): Promise<Result> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const meta = CONTENT_META[key];
  if (!meta) return { ok: false, error: `Onbekende content-key: ${key}` };

  const clean = meta.kind === "rich" ? sanitizeRich(value) : value.trim();

  await db
    .insert(siteContent)
    .values({ key, value: clean, updatedBy: userId })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { value: clean, updatedBy: userId, updatedAt: new Date() },
    });

  await db.insert(siteContentHistory).values({
    key,
    value: clean,
    savedBy: userId,
    note,
  });

  await pruneHistory(key);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Draai de allerlaatste save terug naar de een-na-laatste history-entry
 * (of naar de default als er geen vorige is). Maakt zelf ook een nieuwe
 * history-entry met note "Undo" zodat het pad naar voor+na traceerbaar
 * blijft.
 */
export async function undoLast(): Promise<Result<{ key: ContentKey }>> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const [latest] = await db
    .select({
      id: siteContentHistory.id,
      key: siteContentHistory.key,
      value: siteContentHistory.value,
    })
    .from(siteContentHistory)
    .orderBy(desc(siteContentHistory.savedAt))
    .limit(1);
  if (!latest) return { ok: false, error: "Nog niks om ongedaan te maken" };

  const [prev] = await db
    .select({ value: siteContentHistory.value })
    .from(siteContentHistory)
    .where(
      and(
        eq(siteContentHistory.key, latest.key),
        ne(siteContentHistory.id, latest.id),
      ),
    )
    .orderBy(desc(siteContentHistory.savedAt))
    .limit(1);

  const restored =
    prev?.value ?? CONTENT_META[latest.key as ContentKey].default;
  const r = await saveContent(latest.key as ContentKey, restored, "Undo");
  if (!r.ok) return r;
  return { ok: true, data: { key: latest.key as ContentKey } };
}
