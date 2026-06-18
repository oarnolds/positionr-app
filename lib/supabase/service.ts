import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasst RLS). Alleen gebruiken in
 * server-context — NIET in client components of route handlers die
 * user-input direct doorgeven zonder eigen autorisatie-check.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ontbreekt");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
