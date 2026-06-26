import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  markdownSnapshots,
  snapshotChunks,
  type MarkdownSnapshot,
} from "@/lib/db/schema";
import { embedTexts } from "@/lib/ai/embeddings";
import { chunkMarkdown } from "./chunk";

/**
 * Chunkt een markdown-snapshot, genereert embeddings, en slaat de chunks op
 * in snapshot_chunks. Verwijdert eerst eventuele bestaande chunks (idempotent
 * — re-runnable bij her-genereren van een snapshot).
 */
export async function indexSnapshot(snapshot: MarkdownSnapshot): Promise<{
  chunkCount: number;
}> {
  const chunks = chunkMarkdown(snapshot.markdown);
  if (chunks.length === 0) return { chunkCount: 0 };

  // Idempotent: drop bestaande chunks voor deze snapshot.
  await db.delete(snapshotChunks).where(eq(snapshotChunks.snapshotId, snapshot.id));

  const embeddings = await embedTexts(chunks.map((c) => c.content));

  // Bulk insert. Embedding wordt als pgvector literal string verstuurd
  // (drizzle's customType doet dat via toDriver).
  const rows = chunks.map((c, i) => ({
    snapshotId: snapshot.id,
    userId: snapshot.userId,
    chunkIndex: i,
    content: c.content,
    sourceKind: snapshot.kind,
    sourceUrl: snapshot.sourceUrl,
    sourceFilename: snapshot.sourceFilename,
    headingPath: c.headingPath,
    embedding: embeddings[i],
  }));

  // Drizzle insert in batches om SQL-statement-grootte te beperken.
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(snapshotChunks).values(rows.slice(i, i + BATCH));
  }

  return { chunkCount: rows.length };
}

/** Tellt het aantal chunks per snapshot van een user (voor UI-badges). */
export async function countChunksByUser(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(snapshotChunks)
    .where(eq(snapshotChunks.userId, userId));
  return rows[0]?.count ?? 0;
}

/** Reindexeert ALLE snapshots van een user (handig voor backfill). */
export async function reindexAllForUser(userId: string): Promise<{ total: number; chunkCount: number }> {
  const snapshots = await db
    .select()
    .from(markdownSnapshots)
    .where(eq(markdownSnapshots.userId, userId));
  let chunkCount = 0;
  for (const s of snapshots) {
    const { chunkCount: c } = await indexSnapshot(s);
    chunkCount += c;
  }
  return { total: snapshots.length, chunkCount };
}
