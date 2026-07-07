"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles, sessions } from "@/lib/db/schema";
import {
  GenericInputSchema,
  isGenericModule,
  moduleAllowsExtraSources,
  parseSourceType,
  type GenericInput,
} from "@/modules/generic/schema";
import {
  createGenericSession,
  runGenericAnalysis,
} from "@/modules/generic/service";
import {
  createFileSnapshot,
  getOrCreateSnapshot,
  mimeTypeToFileKind,
} from "@/lib/scraping/snapshot-service";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB, gelijk aan de bibliotheek

async function requireUser(nextPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

function requireGenericSlug(raw: unknown): string {
  const slug = String(raw ?? "");
  if (!isGenericModule(slug)) redirect("/modules");
  return slug;
}

async function startRun(userId: string, slug: string, input: GenericInput) {
  let sessionId: string;
  try {
    sessionId = await createGenericSession({ userId, moduleSlug: slug, input });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyse mislukt";
    redirect(`/modules/${slug}?error=${encodeURIComponent(msg)}`);
  }
  after(() =>
    runGenericAnalysis({ sessionId, userId, moduleSlug: slug, input }),
  );
  revalidatePath(`/modules/${slug}`);
  redirect(`/modules/${slug}/${sessionId}`);
}

/**
 * Bepaalt het bron-snapshot voor de analyse. Voor modules met extraSources
 * kan dat naast een bestaand bibliotheek-snapshot ook een specifieke URL
 * (single-page scrape) of een PDF/Word-upload zijn — beide worden eerst een
 * bibliotheek-snapshot zodat de analyse altijd op een snapshot draait en de
 * bron herbruikbaar is. Geeft nooit een redirect; fouten komen terug als
 * leesbare melding voor de caller.
 */
async function resolveSourceSnapshotId(
  userId: string,
  slug: string,
  formData: FormData,
): Promise<{ snapshotId: string } | { error: string }> {
  const sourceType = moduleAllowsExtraSources(slug)
    ? parseSourceType(formData.get("sourceType"))
    : "library";

  if (sourceType === "url") {
    const caseUrl = String(formData.get("caseUrl") ?? "").trim();
    if (caseUrl.length < 4) return { error: "Vul een geldige URL in" };
    try {
      const { snapshot } = await getOrCreateSnapshot({
        userId,
        kind: "website",
        sourceUrl: caseUrl,
        scrapeOptions: { singlePage: true },
      });
      return { snapshotId: snapshot.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ophalen mislukt";
      return { error: `Pagina kon niet worden opgehaald: ${msg}` };
    }
  }

  if (sourceType === "file") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Geen bestand geselecteerd" };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: `Bestand te groot (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` };
    }
    if (!mimeTypeToFileKind(file.type)) {
      return { error: "Alleen PDF of DOCX bestanden worden ondersteund" };
    }
    try {
      const snapshot = await createFileSnapshot({
        userId,
        buffer: Buffer.from(await file.arrayBuffer()),
        filename: file.name,
        mimeType: file.type,
      });
      return { snapshotId: snapshot.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Conversie mislukt";
      return { error: `Bestand kon niet worden verwerkt: ${msg}` };
    }
  }

  return { snapshotId: String(formData.get("snapshotId") ?? "") };
}

export async function startGenericAnalysisAction(
  formData: FormData,
): Promise<void> {
  const slug = requireGenericSlug(formData.get("moduleSlug"));
  const user = await requireUser(`/modules/${slug}`);

  const resolved = await resolveSourceSnapshotId(user.id, slug, formData);
  if ("error" in resolved) {
    redirect(`/modules/${slug}?error=${encodeURIComponent(resolved.error)}`);
  }
  // Nieuwe URL-/upload-snapshots horen meteen zichtbaar te zijn in de
  // Markdown-bibliotheek op /modules.
  revalidatePath("/modules");

  let input: GenericInput;
  try {
    input = GenericInputSchema.parse({
      snapshotId: resolved.snapshotId,
      companyName: formData.get("companyName"),
      sector: formData.get("sector") ?? "",
      description: formData.get("description") ?? "",
      competitors: formData.get("competitors") ?? "",
    });
  } catch {
    redirect(
      `/modules/${slug}?error=${encodeURIComponent(
        "Kies een markdown-bron en vul een bedrijfsnaam in",
      )}`,
    );
  }

  // Bedrijfsnaam in profiel bijwerken (gedeeld voor alle modules).
  await db
    .update(profiles)
    .set({ companyName: input.companyName })
    .where(eq(profiles.id, user.id));

  await startRun(user.id, slug, input);
}

/** Draai een eerdere sessie opnieuw met dezelfde invoer. */
export async function regenerateGenericAnalysisAction(
  formData: FormData,
): Promise<void> {
  const slug = requireGenericSlug(formData.get("moduleSlug"));
  const user = await requireUser(`/modules/${slug}`);
  const sourceSessionId = String(formData.get("sourceSessionId") ?? "");

  const [src] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sourceSessionId))
    .limit(1);
  if (!src || src.userId !== user.id || src.moduleSlug !== slug) {
    redirect(`/modules/${slug}`);
  }

  let input: GenericInput;
  try {
    input = GenericInputSchema.parse(src.input);
  } catch {
    // Sessies van vóór de markdown-only-omschakeling hebben geen snapshotId
    // in hun input — die kunnen niet 1-op-1 opnieuw draaien.
    redirect(
      `/modules/${slug}?error=${encodeURIComponent(
        "Deze analyse is met een oudere invoer gemaakt — start een nieuwe analyse",
      )}`,
    );
  }
  await startRun(user.id, slug, input);
}
