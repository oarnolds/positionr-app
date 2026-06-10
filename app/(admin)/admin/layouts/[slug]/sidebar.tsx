import Link from "next/link";
import { Layout } from "lucide-react";

/**
 * Modules die een aanpasbare layout hebben. v1: alleen Website Check.
 * Uitbreidbaar zodra meer modules layout-customization krijgen
 * (zie ook lib/modules/layouts.ts SECTIONS_META_BY_SLUG).
 */
const LAYOUT_MODULES: Array<{ slug: string; title: string }> = [
  { slug: "website-check", title: "Website Check" },
];

export function LayoutsSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50/60 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Layout size={14} />
        Layouts
      </h2>
      <ul className="space-y-1">
        {LAYOUT_MODULES.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/admin/layouts/${m.slug}`}
              className={`block rounded-md px-3 py-2 text-sm ${
                m.slug === activeSlug
                  ? "bg-purple-100 font-semibold text-purple-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {m.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
