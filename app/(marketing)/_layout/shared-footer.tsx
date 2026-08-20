"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Shared marketing-footer voor /prijzen, /voorwaarden, /privacy, /checkout,
 * /gratis-check. NIET tonen op de homepage `/` — die heeft een eigen,
 * uitgebreidere footer in `_home/footer.tsx`.
 */
export function SharedMarketingFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <footer className="border-t border-black/[0.06] bg-cream-tint/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-ink-mid sm:flex-row">
        <span>© Positionr</span>
        <nav className="flex gap-6">
          <Link href="/voorwaarden" className="hover:text-ink-high">
            Voorwaarden
          </Link>
          <Link href="/privacy" className="hover:text-ink-high">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-ink-high">
            Inloggen
          </Link>
        </nav>
      </div>
    </footer>
  );
}
