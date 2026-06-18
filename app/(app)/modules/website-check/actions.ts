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
  });

  // 3) Analyseren op de achtergrond ná het response (Next 15 unstable_after).
  //    Sessie staat al op 'running'; runAnalysis vangt fouten en zet 'failed'.
  after(() =>
    runAnalysis({
      sessionId,
      userId: user.id,
      websiteUrl: parsed.websiteUrl,
      companyName: parsed.companyName ?? "",
    }),
  );

  revalidatePath("/modules/website-check");
  redirect(`/modules/website-check/${sessionId}`);
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
