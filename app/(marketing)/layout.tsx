import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="sticky top-0 z-50 border-b border-purple-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-xl font-bold text-transparent"
          >
            Positionr
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/prijzen">
              <Button variant="ghost" size="sm">
                Prijzen
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Inloggen
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-purple-100 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <span>© Positionr</span>
          <nav className="flex gap-4">
            <Link href="/voorwaarden" className="hover:text-foreground">
              Voorwaarden
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Inloggen
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
