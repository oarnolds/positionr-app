"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { modules, profiles } from "@/lib/db/schema";

const SLUG_RE = /^[a-z0-9-]+$/;

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd");
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (profile?.role !== "admin") throw new Error("Geen admin-rechten");
}

export async function saveFormatExample(slug: string, markdown: string): Promise<void> {
  if (!SLUG_RE.test(slug)) throw new Error("Ongeldige slug");
  await requireAdmin();
  await db
    .update(modules)
    .set({ formatExample: markdown.length === 0 ? null : markdown })
    .where(eq(modules.slug, slug));
  revalidatePath(`/admin/layouts/${slug}`);
}
