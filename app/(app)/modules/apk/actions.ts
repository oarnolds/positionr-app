"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { startApkRun } from "@/modules/apk/service";

const StartApkSchema = z.object({
  websiteUrl: z.string().trim().min(3, "URL is verplicht"),
  selectedModules: z.array(z.string()).min(1, "Kies minstens één module"),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules");
  return user;
}

export async function startApkRunAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = StartApkSchema.parse({
    websiteUrl: formData.get("websiteUrl"),
    selectedModules: formData.getAll("modules").map(String),
  });

  const result = await startApkRun({
    userId: user.id,
    sourceUrl: parsed.websiteUrl,
    selectedModules: parsed.selectedModules,
  });

  // De LLM-calls op de achtergrond schedulen — response wacht niet.
  for (const s of result.startedSessions) {
    after(() => s.run());
  }

  revalidatePath("/modules");
  redirect(`/modules/apk/${result.runId}`);
}
