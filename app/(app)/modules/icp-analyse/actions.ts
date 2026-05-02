"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { runICPAnalysis, findExistingICP } from "@/modules/icp-analyse/service";
import { ICPInput } from "@/modules/icp-analyse/schema";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Maakt een nieuwe klant voor de huidige gebruiker.
 * Gebruikt door InputForm wanneer "+ Nieuwe klant" gekozen is.
 */
export async function createClientForUser(
  formData: FormData
): Promise<{ id: string }> {
  const user = await getUser();
  const name = String(formData.get("name") ?? "").trim();
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();

  if (name.length < 2) throw new Error("Bedrijfsnaam is verplicht");
  if (!websiteUrl) throw new Error("Website-URL is verplicht");

  const normalizedUrl = /^https?:\/\//i.test(websiteUrl)
    ? websiteUrl
    : `https://${websiteUrl}`;

  const [client] = await db
    .insert(clients)
    .values({
      userId: user.id,
      name,
      websiteUrl: normalizedUrl,
    })
    .returning({ id: clients.id });

  revalidatePath("/modules/icp-analyse");
  return { id: client.id };
}

/**
 * Detecteer bestaande ICP voor (clientId, product). Voor RerunDialog op de form.
 */
export async function checkExistingICP(
  clientId: string,
  product: string
): Promise<{ exists: boolean; runAt?: string }> {
  await getUser();
  const existing = await findExistingICP(clientId, product);
  return existing ? { exists: true, runAt: existing.runAt } : { exists: false };
}

/**
 * Start ICP-analyse. Redirect naar resultaatpagina (running of done).
 */
export async function startICPAnalysis(formData: FormData) {
  const user = await getUser();

  const parsed = ICPInput.parse({
    clientId: formData.get("clientId"),
    product: formData.get("product"),
    productDescription: formData.get("productDescription"),
    runIntent: formData.get("runIntent") ?? "new",
  });

  let sessionId: string;
  try {
    sessionId = await runICPAnalysis(user.id, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    redirect(`/modules/icp-analyse?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/modules/icp-analyse/${sessionId}`);
}
