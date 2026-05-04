"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { clients, icpProducts } from "@/lib/db/schema";
import {
  scanWebsiteForProducts as scanService,
  runSnelAnalysis,
  runVolledigPhase1,
  saveWebformAnswersPartial,
  runVolledigPhase3,
} from "@/modules/icp-analyse/service";
import { Prominentie, WebformAnswers } from "@/modules/icp-analyse/schema";

async function getUser() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

// ── Klanten ─────────────────────────────────────────────────────────────────

const CreateClientSchema = z.object({
  name: z.string().trim().min(2),
  websiteUrl: z.string().trim().min(3),
});

export async function createClientForUser(
  formData: FormData
): Promise<{ id: string }> {
  const user = await getUser();
  const parsed = CreateClientSchema.parse({
    name: formData.get("name"),
    websiteUrl: formData.get("websiteUrl"),
  });
  const normalizedUrl = /^https?:\/\//i.test(parsed.websiteUrl)
    ? parsed.websiteUrl
    : `https://${parsed.websiteUrl}`;
  const [client] = await db
    .insert(clients)
    .values({
      userId: user.id,
      name: parsed.name,
      websiteUrl: normalizedUrl,
    })
    .returning({ id: clients.id });
  revalidatePath("/modules/icp-analyse");
  return { id: client.id };
}

// ── Producten ───────────────────────────────────────────────────────────────

export async function scanWebsiteAction(
  clientId: string,
  url: string
): Promise<{ saved: number }> {
  const user = await getUser();
  const result = await scanService(user.id, clientId, url);
  revalidatePath("/modules/icp-analyse");
  return { saved: result.saved };
}

const CreateProductSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional(),
  prominentie: Prominentie.default("middel"),
});

export async function createProduct(input: unknown): Promise<{ id: string }> {
  const user = await getUser();
  const parsed = CreateProductSchema.parse(input);
  // Verifieer dat client van deze user is
  const [client] = await db
    .select({ userId: clients.userId, websiteUrl: clients.websiteUrl })
    .from(clients)
    .where(eq(clients.id, parsed.clientId))
    .limit(1);
  if (!client || client.userId !== user.id) {
    throw new Error("Klant niet gevonden");
  }
  const [row] = await db
    .insert(icpProducts)
    .values({
      clientId: parsed.clientId,
      name: parsed.name,
      description: parsed.description ?? null,
      websiteUrl: client.websiteUrl,
      prominentie: parsed.prominentie,
    })
    .returning({ id: icpProducts.id });
  revalidatePath("/modules/icp-analyse");
  return { id: row.id };
}

const UpdateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  prominentie: Prominentie.optional(),
});

export async function updateProduct(input: unknown): Promise<void> {
  const user = await getUser();
  const parsed = UpdateProductSchema.parse(input);

  // Verify ownership through join
  const [row] = await db
    .select({ clientUserId: clients.userId })
    .from(icpProducts)
    .innerJoin(clients, eq(clients.id, icpProducts.clientId))
    .where(eq(icpProducts.id, parsed.id))
    .limit(1);
  if (!row || row.clientUserId !== user.id) {
    throw new Error("Geen toegang tot dit product");
  }

  const updates: Record<string, unknown> = {};
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.prominentie !== undefined) updates.prominentie = parsed.prominentie;

  if (Object.keys(updates).length > 0) {
    await db
      .update(icpProducts)
      .set(updates)
      .where(eq(icpProducts.id, parsed.id));
  }
  revalidatePath("/modules/icp-analyse");
}

export async function deleteProduct(productId: string): Promise<void> {
  const user = await getUser();
  const [row] = await db
    .select({ clientUserId: clients.userId })
    .from(icpProducts)
    .innerJoin(clients, eq(clients.id, icpProducts.clientId))
    .where(eq(icpProducts.id, productId))
    .limit(1);
  if (!row || row.clientUserId !== user.id) {
    throw new Error("Geen toegang tot dit product");
  }
  await db.delete(icpProducts).where(eq(icpProducts.id, productId));
  revalidatePath("/modules/icp-analyse");
}

// ── Analyse starten ─────────────────────────────────────────────────────────

export async function startSnelAnalyse(productId: string) {
  const user = await getUser();
  let sessionId: string;
  try {
    sessionId = await runSnelAnalysis(user.id, productId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyse mislukt";
    redirect(
      `/modules/icp-analyse/${productId}?error=${encodeURIComponent(msg)}`
    );
  }
  redirect(`/modules/icp-analyse/${productId}/snel/${sessionId}`);
}

// ── Volledige flow ───────────────────────────────────────────────────────────

export async function startVolledigAnalyse(productId: string) {
  const user = await getUser();
  let sessionId: string;
  try {
    sessionId = await runVolledigPhase1(user.id, productId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyse mislukt";
    redirect(
      `/modules/icp-analyse/${productId}?error=${encodeURIComponent(msg)}`
    );
  }
  redirect(
    `/modules/icp-analyse/${productId}/volledig/${sessionId}/phase1`
  );
}

export async function confirmPhase1(productId: string, sessionId: string) {
  await getUser();
  redirect(
    `/modules/icp-analyse/${productId}/volledig/${sessionId}/webform`
  );
}

export async function saveWebformStep(
  sessionId: string,
  partial: Partial<unknown>,
  step: number
): Promise<void> {
  const user = await getUser();
  // Tolerant: valideer alleen velden die aanwezig zijn (partial)
  await saveWebformAnswersPartial(
    user.id,
    sessionId,
    partial as Partial<import("@/modules/icp-analyse/schema").WebformAnswers>,
    step
  );
}

export async function submitWebform(
  productId: string,
  sessionId: string,
  finalAnswers: unknown
) {
  const user = await getUser();
  // Valideer volledig
  const parsed = WebformAnswers.parse(finalAnswers);
  // Sla eerst alle antwoorden op zodat phase3 ze kan lezen
  await saveWebformAnswersPartial(user.id, sessionId, parsed, 5);
  try {
    await runVolledigPhase3(user.id, sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyse mislukt";
    redirect(
      `/modules/icp-analyse/${productId}/volledig/${sessionId}/webform?error=${encodeURIComponent(msg)}`
    );
  }
  redirect(
    `/modules/icp-analyse/${productId}/volledig/${sessionId}/profiel`
  );
}
