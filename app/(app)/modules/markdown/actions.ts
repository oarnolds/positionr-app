"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { db } from "@/lib/db/client";
import { markdownSnapshots } from "@/lib/db/schema";
import {
  createFileSnapshot,
  getOrCreateSnapshot,
  mimeTypeToFileKind,
} from "@/lib/scraping/snapshot-service";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (matched aan bucket-limit)
const STORAGE_BUCKET = "markdown-sources";

const UrlSchema = z.object({
  websiteUrl: z.string().trim().min(3, "URL is verplicht"),
  includeImages: z.boolean(),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules");
  return user;
}

export async function createUrlSnapshotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = UrlSchema.parse({
    websiteUrl: formData.get("websiteUrl"),
    includeImages: formData.get("includeImages") === "on",
  });
  const { snapshot } = await getOrCreateSnapshot({
    userId: user.id,
    kind: "website",
    sourceUrl: parsed.websiteUrl,
    forceRefresh: true,
    scrapeOptions: { includeImages: parsed.includeImages },
  });
  revalidatePath("/modules");
  redirect(`/modules/markdown/${snapshot.id}`);
}

export async function createFileSnapshotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Geen bestand geselecteerd");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Bestand te groot (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`);
  }
  if (!mimeTypeToFileKind(file.type)) {
    throw new Error("Alleen PDF of DOCX bestanden worden ondersteund");
  }

  const includeImages = formData.get("includeImages") === "on";
  const buffer = Buffer.from(await file.arrayBuffer());
  const snapshot = await createFileSnapshot({
    userId: user.id,
    buffer,
    filename: file.name,
    mimeType: file.type,
    includeImages,
  });

  revalidatePath("/modules");
  redirect(`/modules/markdown/${snapshot.id}`);
}

export async function deleteSnapshotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const snapshotId = String(formData.get("snapshotId") ?? "");
  if (!snapshotId) return;

  const [row] = await db
    .select()
    .from(markdownSnapshots)
    .where(
      and(
        eq(markdownSnapshots.id, snapshotId),
        eq(markdownSnapshots.userId, user.id)
      )
    )
    .limit(1);
  if (!row) return;

  if (row.sourceStoragePath) {
    const supabase = createServiceClient();
    await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([row.sourceStoragePath])
      .catch(() => undefined);
  }

  await db.delete(markdownSnapshots).where(eq(markdownSnapshots.id, snapshotId));
  revalidatePath("/modules");
  redirect("/modules");
}
