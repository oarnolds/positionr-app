"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources, profiles } from "@/lib/db/schema";
import { extractBook } from "@/lib/knowledge/extract";
import { runDistillation } from "@/lib/knowledge/service";

const BUCKET = "knowledge-books";

const MIME_TO_KIND: Record<string, "pdf" | "epub"> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
};

const KIND_TO_MIME: Record<"pdf" | "epub", string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
};

/** Bepaalt het boektype uit mime-type óf bestandsextensie (browsers zetten
 *  voor .epub soms een lege of octet-stream mime). */
function detectKind(filename: string, mimeType: string): "pdf" | "epub" | null {
  if (MIME_TO_KIND[mimeType]) return MIME_TO_KIND[mimeType];
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".epub")) return "epub";
  return null;
}

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/kennis");
  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (p?.role !== "admin") redirect("/modules");
}

/**
 * Stap 1 van de upload: maak een signed upload-URL zodat de browser het boek
 * RECHTSTREEKS naar Storage uploadt. Boeken zijn te groot (Vercel capt
 * server-uploads op 4,5 MB), dus de bytes gaan nooit door de server-action.
 * Geeft alleen een klein JSON-antwoord terug.
 */
export async function createBookUploadUrl(
  filename: string,
  mimeType: string,
): Promise<
  | { ok: true; path: string; token: string; kind: "pdf" | "epub"; contentType: string }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const kind = detectKind(filename, mimeType);
  if (!kind) return { ok: false, error: "Alleen PDF of EPUB" };
  const path = `${randomUUID()}.${kind}`;
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Kon upload-URL niet maken" };
  }
  return { ok: true, path: data.path, token: data.token, kind, contentType: KIND_TO_MIME[kind] };
}

/**
 * Stap 2: de browser heeft het boek geüpload; wij downloaden het server-side
 * uit Storage, extraheren de hoofdstukken, maken de bron aan en starten de
 * distillatie op de achtergrond. Redirect bij succes; geeft {error} terug
 * zodat de uploader-component het kan tonen.
 */
export async function startBookExtraction(
  path: string,
  kind: "pdf" | "epub",
  filename: string,
): Promise<{ error: string } | void> {
  await requireAdmin();
  const supabase = createServiceClient();
  let sourceId: string;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw new Error(error?.message ?? "Bestand niet gevonden in opslag");
    const buffer = Buffer.from(await data.arrayBuffer());
    const book = await extractBook(buffer, kind);
    if (book.chapters.length === 0) throw new Error("Geen tekst gevonden in het boek");
    const [row] = await db
      .insert(knowledgeSources)
      .values({
        title: book.title ?? filename,
        author: book.author,
        language: book.language,
        kind,
        storagePath: path,
        status: "distilling",
        chapters: book.chapters,
        chaptersTotal: book.chapters.length,
        chaptersDone: 0,
      })
      .returning({ id: knowledgeSources.id });
    sourceId = row.id;
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    return { error: err instanceof Error ? err.message : "Extractie mislukt" };
  }

  after(() => runDistillation(sourceId));
  revalidatePath("/admin/kennis");
  redirect(`/admin/kennis/${sourceId}`);
}

export async function resumeDistillationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return;
  after(() => runDistillation(sourceId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}

export async function approveCardAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!cardId) return;
  await db
    .update(knowledgeCards)
    .set({ status: "goedgekeurd", updatedAt: new Date() })
    .where(eq(knowledgeCards.id, cardId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}

export async function updateCardAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!cardId) return;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  await db
    .update(knowledgeCards)
    .set({
      title: String(formData.get("title") ?? "").trim(),
      kern: String(formData.get("kern") ?? "").trim(),
      toepassing: String(formData.get("toepassing") ?? "").trim(),
      tags,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeCards.id, cardId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!cardId) return;
  await db.delete(knowledgeCards).where(eq(knowledgeCards.id, cardId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}

export async function deleteSourceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return;
  const [row] = await db
    .select({ storagePath: knowledgeSources.storagePath })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, sourceId))
    .limit(1);
  if (row?.storagePath) {
    createServiceClient()
      .storage.from(BUCKET)
      .remove([row.storagePath])
      .catch(() => undefined);
  }
  await db.delete(knowledgeSources).where(eq(knowledgeSources.id, sourceId));
  revalidatePath("/admin/kennis");
  redirect("/admin/kennis");
}
