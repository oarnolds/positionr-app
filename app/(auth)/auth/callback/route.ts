import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic link callback. Ondersteunt twee flows:
 *  - token_hash + type : robuust, werkt vanaf elk apparaat/browser (geen verifier-cookie nodig)
 *  - code              : PKCE, behouden voor backward-compat
 * Supabase redirect: /auth/callback?token_hash=...&type=...&next=/modules
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const next = searchParams.get("next") ?? "/modules";

  const supabase = await createClient();

  if (tokenHash) {
    // Normaliseer type-varianten naar supabase-js EmailOtpType
    const type = (rawType === "magic_link" ? "magiclink" : rawType ?? "email") as EmailOtpType;
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback-failed`);
}
