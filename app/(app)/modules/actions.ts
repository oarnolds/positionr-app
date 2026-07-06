"use server";

// Gedeelde server-actions voor alle module-pagina's.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verwijder een analyse-sessie (rapport) van de ingelogde gebruiker.
 * Werkt voor elke module: de where-clause op userId zorgt dat je alleen
 * je eigen rapporten kunt verwijderen. Ook lopende sessies mogen weg —
 * de achtergrond-runner update daarna simpelweg nul rijen.
 */
export async function deleteSessionAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sessionId = String(formData.get("sessionId") ?? "");
  if (!UUID_RE.test(sessionId)) return;

  await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));

  const path = String(formData.get("path") ?? "");
  if (path.startsWith("/modules")) revalidatePath(path);
}
