import Link from "next/link";

const COLS: Array<{
  heading: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    heading: "Product",
    links: [
      { label: "Modules", href: "/modules" },
      { label: "Pakketten", href: "/prijzen" },
      { label: "Gratis check", href: "/gratis-check" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    heading: "Bedrijf",
    links: [
      { label: "Over ons", href: "#" },
      { label: "Methodiek", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Juridisch",
    links: [
      { label: "Voorwaarden", href: "/voorwaarden" },
      { label: "Privacy", href: "/privacy" },
      { label: "Cookiebeleid", href: "#" },
    ],
  },
];

export function HomeFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-cream py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-mut">
                {col.heading}
              </h4>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-ink-mid hover:text-ink-high"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-black/[0.05] pt-6">
          <span className="font-display text-lg font-bold text-ink-high">
            Positionr
          </span>
          <span className="text-sm text-ink-mut">
            © 2026 Positionr · Gemaakt in Nederland
          </span>
        </div>
      </div>
    </footer>
  );
}
