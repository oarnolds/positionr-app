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

export async function uploadBookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/kennis?error=" + encodeURIComponent("Geen bestand gekozen"));
  }
  const kind = MIME_TO_KIND[(file as File).type];
  if (!kind) {
    redirect("/admin/kennis?error=" + encodeURIComponent("Alleen PDF of EPUB"));
  }

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const storagePath = `${randomUUID()}.${kind}`;
  const supabase = createServiceClient();
  const up = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: (file as File).type,
    upsert: false,
  });
  if (up.error) {
    redirect("/admin/kennis?error=" + encodeURIComponent(up.error.message));
  }

  let sourceId: string;
  try {
    const book = await extractBook(buffer, kind);
    if (book.chapters.length === 0) throw new Error("Geen tekst gevonden in het boek");
    const [row] = await db
      .insert(knowledgeSources)
      .values({
        title: book.title ?? (file as File).name,
        author: book.author,
        language: book.language,
        kind,
        storagePath,
        status: "distilling",
        chapters: book.chapters,
        chaptersTotal: book.chapters.length,
        chaptersDone: 0,
      })
      .returning({ id: knowledgeSources.id });
    sourceId = row.id;
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    const msg = err instanceof Error ? err.message : "Extractie mislukt";
    redirect("/admin/kennis?error=" + encodeURIComponent(msg));
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
