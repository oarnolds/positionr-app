import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-slate-900"
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

      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <span>© Positionr</span>
          <nav className="flex gap-6">
            <Link href="/voorwaarden" className="hover:text-slate-900">
              Voorwaarden
            </Link>
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Inloggen
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
