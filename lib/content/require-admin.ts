import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Guard voor content-mutaties (saveContent, undoLast).
 * Gooit als user niet ingelogd is of niet role='admin' heeft.
 * Returnt `auth.users.id` bij success.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Niet ingelogd");
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);
  if (profile?.role !== "admin") throw new Error("Geen admin-rechten");
  return data.user.id;
}
