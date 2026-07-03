"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles, sessions } from "@/lib/db/schema";
import {
  MODULE_SLUG,
  ConcurrentenInputSchema,
  ConfirmedCompetitor,
  type ConcurrentenInput,
  type ConcurrentenSessionInput,
} from "@/modules/concurrenten/schema";
import {
  createConcurrentenSession,
  runDiscovery,
  runDeepAnalysis,
} from "@/modules/concurrenten/service";

const BASE = "/modules/website-check-concurrenten";

async function requireUser(nextPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

async function startDiscoveryRun(userId: string, input: ConcurrentenInput) {
  let sessionId: string;
  try {
    sessionId = await createConcurrentenSession({ userId, input });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyse mislukt";
    redirect(`${BASE}?error=${encodeURIComponent(msg)}`);
  }
  after(() => runDiscovery({ sessionId, userId, input }));
  revalidatePath(BASE);
  redirect(`${BASE}/${sessionId}`);
}

export async function startConcurrentenAction(formData: FormData): Promise<void> {
  const user = await requireUser(BASE);

  let input: ConcurrentenInput;
  try {
    input = ConcurrentenInputSchema.parse({
      snapshotId: formData.get("snapshotId"),
      companyName: formData.get("companyName"),
      geografie: formData.get("geografie"),
      sector: formData.get("sector") ?? "",
      description: formData.get("description") ?? "",
    });
  } catch {
    redirect(
      `${BASE}?error=${encodeURIComponent(
        "Kies een markdown-bron en vul bedrijfsnaam + geografische focus in",
      )}`,
    );
  }

  await db
    .update(profiles)
    .set({ companyName: input.companyName })
    .where(eq(profiles.id, user.id));

  await startDiscoveryRun(user.id, input);
}

/**
 * Review-stap: gebruiker bevestigt kandidaten (en voegt eventueel eigen
 * concurrenten toe) → fase 2 start op de achtergrond.
 */
export async function confirmCompetitorsAction(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const user = await requireUser(`${BASE}/${sessionId}`);

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (
    !session ||
    session.userId !== user.id ||
    session.moduleSlug !== MODULE_SLUG ||
    session.status !== "review"
  ) {
    redirect(BASE);
  }

  // Aangevinkte kandidaten (value = JSON per kandidaat)
  const confirmed = formData
    .getAll("kandidaat")
    .map((raw) => {
      try {
        return ConfirmedCompetitor.parse(JSON.parse(String(raw)));
      } catch {
        return null;
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Handmatig toegevoegde concurrenten: naam/url-velden gepaird op index.
  const manualNames = formData.getAll("manualNaam").map(String);
  const manualUrls = formData.getAll("manualUrl").map(String);
  manualNames.forEach((naam, i) => {
    if (!naam.trim()) return;
    confirmed.push({ naam: naam.trim(), websiteUrl: (manualUrls[i] ?? "").trim() });
  });

  if (confirmed.length === 0) {
    redirect(
      `${BASE}/${sessionId}?error=${encodeURIComponent(
        "Selecteer minimaal één concurrent of voeg er zelf een toe",
      )}`,
    );
  }

  const input = session.input as ConcurrentenSessionInput;
  const updatedInput: ConcurrentenSessionInput = { ...input, confirmed };

  // Sessie terug naar 'running' vóór de achtergrond-run; updateSession in de
  // service guard op status='running'.
  await db
    .update(sessions)
    .set({
      status: "running",
      input: updatedInput as unknown as Record<string, unknown>,
    })
    .where(eq(sessions.id, sessionId));

  const phase1 = {
    promptUsed: session.promptUsed,
    llmInputTokens: session.llmInputTokens ?? 0,
    llmOutputTokens: session.llmOutputTokens ?? 0,
    llmCostCents: session.llmCostCents ?? 0,
  };

  after(() =>
    runDeepAnalysis({
      sessionId,
      userId: user.id,
      input: updatedInput,
      confirmed,
      phase1,
    }),
  );

  revalidatePath(`${BASE}/${sessionId}`);
  redirect(`${BASE}/${sessionId}`);
}

/** Start een nieuwe discovery met dezelfde invoer als een eerdere sessie. */
export async function regenerateConcurrentenAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser(BASE);
  const sourceSessionId = String(formData.get("sourceSessionId") ?? "");

  const [src] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sourceSessionId))
    .limit(1);
  if (!src || src.userId !== user.id || src.moduleSlug !== MODULE_SLUG) {
    redirect(BASE);
  }

  let input: ConcurrentenInput;
  try {
    input = ConcurrentenInputSchema.parse(src.input);
  } catch {
    redirect(
      `${BASE}?error=${encodeURIComponent(
        "Deze analyse is met een oudere invoer gemaakt — start een nieuwe analyse",
      )}`,
    );
  }
  await startDiscoveryRun(user.id, input);
}

