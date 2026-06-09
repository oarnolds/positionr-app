// app/(admin)/admin/prompts/[slug]/sidebar.tsx
//
// Vaste linkerkolom met alle modules uit de registry. Server component —
// volledig statisch behalve de active-state.
//
// Layout: top-level modules in registry-volgorde; sub-prompts (m.parentSlug)
// staan direct onder hun parent, met indent en kleinere tekst.

import Link from "next/link";
import { MODULES, type ModuleMeta } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";

/** Bouwt een platte render-lijst: parent → (sub, sub, …) → volgende parent. */
function buildOrderedList(): Array<ModuleMeta & { isSub: boolean }> {
  const topLevel = MODULES.filter((m) => !m.parentSlug);
  const subsByParent = new Map<string, ModuleMeta[]>();
  for (const m of MODULES) {
    if (m.parentSlug) {
      const list = subsByParent.get(m.parentSlug) ?? [];
      list.push(m);
      subsByParent.set(m.parentSlug, list);
    }
  }
  const out: Array<ModuleMeta & { isSub: boolean }> = [];
  for (const parent of topLevel) {
    out.push({ ...parent, isSub: false });
    const subs = subsByParent.get(parent.slug) ?? [];
    for (const sub of subs) out.push({ ...sub, isSub: true });
  }
  return out;
}

export function PromptsSidebar({ activeSlug }: { activeSlug: string }) {
  const items = buildOrderedList();
  return (
    <nav className="w-[280px] shrink-0 border-r border-gray-200 bg-gray-50">
      <div className="px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Modules
        </div>
      </div>
      <ul className="space-y-px px-2 pb-4">
        {items.map((m) => {
          const Icon = m.icon;
          const isActive = m.slug === activeSlug;
          return (
            <li key={m.slug}>
              <Link
                href={`/admin/prompts/${m.slug}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg transition-colors",
                  m.isSub
                    ? "ml-5 border-l-2 border-gray-200 py-1.5 pl-3 pr-3 text-xs"
                    : "px-3 py-2 text-sm",
                  isActive
                    ? "bg-purple-100 text-purple-900"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                <Icon
                  className={cn(
                    "shrink-0",
                    m.isSub ? "h-3.5 w-3.5" : "h-4 w-4",
                    m.iconColor,
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate",
                      m.isSub ? "font-normal" : "font-medium",
                    )}
                  >
                    {m.name}
                  </div>
                  {!m.isSub && (
                    <div className="text-xs text-gray-500">
                      {m.status === "active" ? "Actief" : "Binnenkort"}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
