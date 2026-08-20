import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SharedMarketingFooter } from "./_layout/shared-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink-high">
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-cream/70 backdrop-blur-xl saturate-150 supports-[not_(backdrop-filter:blur(0))]:bg-cream/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-ink-high"
          >
            Positionr<span className="text-primary">.</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/prijzen">
              <Button variant="ghost" size="sm">
                Prijzen
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Inloggen
              </Button>
            </Link>
            <Link href="/gratis-check" className="ml-2">
              <Button size="sm">Gratis check</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <SharedMarketingFooter />
    </div>
  );
}
