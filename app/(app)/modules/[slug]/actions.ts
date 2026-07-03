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
  type GenericInput,
} from "@/modules/generic/schema";
import {
  createGenericSession,
  runGenericAnalysis,
} from "@/modules/generic/service";

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

export async function startGenericAnalysisAction(
  formData: FormData,
): Promise<void> {
  const slug = requireGenericSlug(formData.get("moduleSlug"));
  const user = await requireUser(`/modules/${slug}`);

  let input: GenericInput;
  try {
    input = GenericInputSchema.parse({
      snapshotId: formData.get("snapshotId"),
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
