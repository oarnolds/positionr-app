import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  markdownSnapshots,
  type MarkdownSnapshot,
} from "@/lib/db/schema";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeBaseUrl, urlToMarkdown, type UrlToMarkdownOptions } from "./url-to-markdown";
import { pdfToMarkdown } from "./pdf-to-markdown";
import { docxToMarkdown } from "./docx-to-markdown";
import { indexSnapshot } from "@/lib/rag/index-snapshot";

export type MarkdownSnapshotKind = "website" | "pdf" | "docx";
export type FileSnapshotKind = "pdf" | "docx";

const STORAGE_BUCKET = "markdown-sources";

/** Mime-type → kind + bestand-extensie (consistent met de Storage bucket-allow-list). */
const MIME_TO_KIND: Record<string, { kind: FileSnapshotKind; ext: string }> = {
  "application/pdf": { kind: "pdf", ext: "pdf" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    kind: "docx",
    ext: "docx",
  },
};

export function mimeTypeToFileKind(
  mimeType: string
): { kind: FileSnapshotKind; ext: string } | null {
  return MIME_TO_KIND[mimeType] ?? null;
}

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

  // Auto-indexeer voor RAG. Faalt zacht — als embeddings stuk zijn (bv. OpenAI
  // key ontbreekt) blijft de snapshot zelf gewoon werken voor andere modules.
  try {
    await indexSnapshot(snapshot);
  } catch (err) {
    console.warn("indexSnapshot mislukt (snapshot blijft bruikbaar):", err);
  }

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

/**
 * Zelfde lookup als findFreshSnapshot maar zónder TTL-filter.
 * Bedoeld voor "gebruik de markdown uit mijn bibliotheek"-flows waarin de
 * gebruiker expliciet z'n eerder gemaakte snapshot wil hergebruiken,
 * ongeacht hoe oud die is.
 */
export async function findAnySnapshot(
  userId: string,
  kind: MarkdownSnapshotKind,
  sourceUrl: string
): Promise<MarkdownSnapshot | null> {
  const rows = await db
    .select()
    .from(markdownSnapshots)
    .where(
      and(
        eq(markdownSnapshots.userId, userId),
        eq(markdownSnapshots.kind, kind),
        eq(markdownSnapshots.sourceUrl, normalizeKey(kind, sourceUrl))
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export type CreateFileSnapshotInput = {
  userId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  /**
   * Default true: stuur images door Claude vision om beschrijvingen toe te
   * voegen aan de markdown. Voor PDF heeft dit geen extra effect (Claude leest
   * embedded images al via het PDF document-block). Voor DOCX worden images
   * via mammoth onderschept en apart beschreven.
   */
  includeImages?: boolean;
};

/**
 * Verwerkt een door de gebruiker geüpload bestand (PDF of DOCX):
 *   1. Schrijft het origineel naar de 'markdown-sources' Supabase Storage bucket.
 *   2. Converteert naar markdown (Claude API voor PDF, mammoth voor DOCX).
 *   3. Slaat de snapshot op met source_storage_path + source_filename.
 *
 * In tegenstelling tot URL-snapshots vervallen file-snapshots niet automatisch
 * (bestand zit in Storage, markdown is al af). expires_at wordt ver in de
 * toekomst gezet alleen om de NOT NULL constraint te bedienen.
 */
export async function createFileSnapshot(
  input: CreateFileSnapshotInput
): Promise<MarkdownSnapshot> {
  const meta = mimeTypeToFileKind(input.mimeType);
  if (!meta) {
    throw new Error(`Niet-ondersteund bestandstype: ${input.mimeType}`);
  }

  const storagePath = `${input.userId}/${randomUUID()}.${meta.ext}`;
  const supabase = createServiceClient();

  const uploadRes = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.buffer, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (uploadRes.error) {
    throw new Error(`Upload naar Storage mislukt: ${uploadRes.error.message}`);
  }

  const includeImages = input.includeImages !== false;
  let markdown: string;
  let title: string | null = input.filename;
  try {
    if (meta.kind === "pdf") {
      const result = await pdfToMarkdown(input.buffer);
      markdown = result.markdown;
    } else {
      const result = await docxToMarkdown(input.buffer, { includeImages });
      markdown = result.markdown;
    }
  } catch (err) {
    // Rollback de Storage-upload zodat we geen weeskinderen achterlaten.
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw err;
  }

  const headingMatch = /^#\s+(.+)$/m.exec(markdown);
  if (headingMatch) title = headingMatch[1].trim();

  const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);

  const rows = await db
    .insert(markdownSnapshots)
    .values({
      userId: input.userId,
      kind: meta.kind,
      sourceUrl: storagePath,
      sourceFilename: input.filename,
      sourceStoragePath: storagePath,
      title,
      metaDescription: null,
      markdown,
      pages: [],
      fetchedAt: new Date(),
      expiresAt,
    })
    .returning();
  const snapshot = rows[0];

  // Auto-indexeer voor RAG. Faalt zacht.
  try {
    await indexSnapshot(snapshot);
  } catch (err) {
    console.warn("indexSnapshot mislukt (snapshot blijft bruikbaar):", err);
  }

  return snapshot;
}
