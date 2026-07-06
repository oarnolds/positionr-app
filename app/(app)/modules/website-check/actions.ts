"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles, sessions } from "@/lib/db/schema";
import {
  createWebsiteCheckSession,
  runAnalysis,
} from "@/modules/website-check/service";
import { WebsiteCheckInputSchema, MODULE_SLUG } from "@/modules/website-check";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/website-check");
  return user;
}

// Live scraping is uit het proces gehaald (besluit juli 2026): de check
// draait altijd op de markdown-snapshot uit de bibliotheek.
export async function startAnalysisFromMarkdown(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = WebsiteCheckInputSchema.parse({
    websiteUrl: formData.get("websiteUrl"),
    companyName: formData.get("companyName") ?? undefined,
  });

  await db
    .update(profiles)
    .set({
      websiteUrl: parsed.websiteUrl,
      ...(parsed.companyName ? { companyName: parsed.companyName } : {}),
    })
    .where(eq(profiles.id, user.id));

  const { sessionId } = await createWebsiteCheckSession({
    userId: user.id,
    websiteUrl: parsed.websiteUrl,
    companyName: parsed.companyName ?? "",
    analysisMode: "markdown",
  });

  after(() =>
    runAnalysis({
      sessionId,
      userId: user.id,
      websiteUrl: parsed.websiteUrl,
      companyName: parsed.companyName ?? "",
      useExistingMarkdown: true,
    }),
  );

  revalidatePath("/modules/website-check");
  redirect(`/modules/website-check/${sessionId}`);
}

// Checks verwijderen loopt via de gedeelde deleteSessionAction
// (app/(app)/modules/actions.ts), net als bij de andere modules.

export async function regenerateAnalysis(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sourceSessionId = String(formData.get("sourceSessionId") ?? "");
  const [src] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sourceSessionId))
    .limit(1);
  if (!src || src.userId !== user.id || src.moduleSlug !== MODULE_SLUG) {
    redirect("/modules/website-check");
  }
  const input = src.input as { websiteUrl: string; companyName?: string };
  // Opnieuw draaien gebeurt ook altijd via de markdown-snapshot.
  const { sessionId } = await createWebsiteCheckSession({
    userId: user.id,
    websiteUrl: input.websiteUrl,
    companyName: input.companyName ?? "",
    analysisMode: "markdown",
  });
  after(() =>
    runAnalysis({
      sessionId,
      userId: user.id,
      websiteUrl: input.websiteUrl,
      companyName: input.companyName ?? "",
      useExistingMarkdown: true,
    }),
  );
  revalidatePath("/modules/website-check");
  redirect(`/modules/website-check/${sessionId}`);
}
