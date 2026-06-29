"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
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

async function requireAdmin(): Promise<{ userId: string }> {
  const user = await requireUser();
  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (!p || p.role !== "admin") throw new Error("Alleen admins kunnen checks verwijderen");
  return { userId: user.id };
}

export async function startAnalysis(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = WebsiteCheckInputSchema.parse({
    websiteUrl: formData.get("websiteUrl"),
    companyName: formData.get("companyName") ?? undefined,
  });

  // 1) Profiel bijwerken (gedeeld profiel voor alle modules)
  await db
    .update(profiles)
    .set({
      websiteUrl: parsed.websiteUrl,
      ...(parsed.companyName ? { companyName: parsed.companyName } : {}),
    })
    .where(eq(profiles.id, user.id));

  // 2) Sessie aanmaken
  const { sessionId } = await createWebsiteCheckSession({
    userId: user.id,
    websiteUrl: parsed.websiteUrl,
    companyName: parsed.companyName ?? "",
    analysisMode: "scrape",
  });

  // 3) Analyseren op de achtergrond ná het response (Next 15 unstable_after).
  //    Sessie staat al op 'running'; runAnalysis vangt fouten en zet 'failed'.
  after(() =>
    runAnalysis({
      sessionId,
      userId: user.id,
      websiteUrl: parsed.websiteUrl,
      companyName: parsed.companyName ?? "",
      bypassCache: true,
    }),
  );

  revalidatePath("/modules/website-check");
  redirect(`/modules/website-check/${sessionId}`);
}

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

/** Admin-only: verwijder een website-check sessie uit de geschiedenis. */
export async function deleteCheckAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.moduleSlug, MODULE_SLUG)));
  revalidatePath("/modules/website-check");
  redirect("/modules/website-check");
}

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
  const { sessionId } = await createWebsiteCheckSession({
    userId: user.id,
    websiteUrl: input.websiteUrl,
    companyName: input.companyName ?? "",
  });
  after(() =>
    runAnalysis({
      sessionId,
      userId: user.id,
      websiteUrl: input.websiteUrl,
      companyName: input.companyName ?? "",
    }),
  );
  revalidatePath("/modules/website-check");
  redirect(`/modules/website-check/${sessionId}`);
}
