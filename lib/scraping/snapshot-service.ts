import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  markdownSnapshots,
  type MarkdownSnapshot,
} from "@/lib/db/schema";
import { normalizeBaseUrl, urlToMarkdown, type UrlToMarkdownOptions } from "./url-to-markdown";

export type MarkdownSnapshotKind = "website";

const DEFAULT_TTL_HOURS = 24;

export type GetOrCreateSnapshotInput = {
  userId: string;
  kind: MarkdownSnapshotKind;
  sourceUrl: string;
  /** Time-to-live van de cache in uren. Default 24. */
  ttlHours?: number;
  /** Forceer een refresh, ook als er nog een verse cache is. */
  forceRefresh?: boolean;
  /** Doorgegeven aan urlToMarkdown bij het maken van een verse snapshot. */
  scrapeOptions?: UrlToMarkdownOptions;
};

export type SnapshotWithFreshness = {
  snapshot: MarkdownSnapshot;
  /** True als de snapshot in deze call werd opgehaald, false als-ie uit cache komt. */
  fresh: boolean;
};

function normalizeKey(kind: MarkdownSnapshotKind, sourceUrl: string): string {
  if (kind === "website") return normalizeBaseUrl(sourceUrl);
  return sourceUrl.trim();
}

async function findCached(
  userId: string,
  kind: MarkdownSnapshotKind,
  sourceUrl: string
): Promise<MarkdownSnapshot | null> {
  const now = new Date();
  const rows = await db
    .select()
    .from(markdownSnapshots)
    .where(
      and(
        eq(markdownSnapshots.userId, userId),
        eq(markdownSnapshots.kind, kind),
        eq(markdownSnapshots.sourceUrl, sourceUrl),
        gt(markdownSnapshots.expiresAt, now)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function upsertSnapshot(input: {
  userId: string;
  kind: MarkdownSnapshotKind;
  sourceUrl: string;
  title: string;
  metaDescription: string;
  markdown: string;
  pages: MarkdownSnapshot["pages"];
  expiresAt: Date;
}): Promise<MarkdownSnapshot> {
  const rows = await db
    .insert(markdownSnapshots)
    .values({
      userId: input.userId,
      kind: input.kind,
      sourceUrl: input.sourceUrl,
      title: input.title,
      metaDescription: input.metaDescription,
      markdown: input.markdown,
      pages: input.pages,
      fetchedAt: new Date(),
      expiresAt: input.expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        markdownSnapshots.userId,
        markdownSnapshots.kind,
        markdownSnapshots.sourceUrl,
      ],
      set: {
        title: input.title,
        metaDescription: input.metaDescription,
        markdown: input.markdown,
        pages: input.pages,
        fetchedAt: new Date(),
        expiresAt: input.expiresAt,
      },
    })
    .returning();
  return rows[0];
}

/**
 * Haalt een markdown-snapshot op of maakt 'm vers aan.
 * - Default TTL: 24u.
 * - Bij `forceRefresh: true` wordt de bestaande rij overschreven.
 */
export async function getOrCreateSnapshot(
  input: GetOrCreateSnapshotInput
): Promise<SnapshotWithFreshness> {
  const sourceUrl = normalizeKey(input.kind, input.sourceUrl);
  const ttlHours = input.ttlHours ?? DEFAULT_TTL_HOURS;

  if (!input.forceRefresh) {
    const cached = await findCached(input.userId, input.kind, sourceUrl);
    if (cached) return { snapshot: cached, fresh: false };
  }

  const result = await urlToMarkdown(sourceUrl, input.scrapeOptions);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const snapshot = await upsertSnapshot({
    userId: input.userId,
    kind: input.kind,
    sourceUrl,
    title: result.title,
    metaDescription: result.metaDescription,
    markdown: result.markdown,
    pages: result.pages,
    expiresAt,
  });

  return { snapshot, fresh: true };
}

/**
 * Variant zonder fallback naar fetch: returnt alleen een rij als-ie in cache zit
 * en nog niet verlopen is. Handig voor "is er al een snapshot?"-checks in de UI.
 */
export async function findFreshSnapshot(
  userId: string,
  kind: MarkdownSnapshotKind,
  sourceUrl: string
): Promise<MarkdownSnapshot | null> {
  return findCached(userId, kind, normalizeKey(kind, sourceUrl));
}
