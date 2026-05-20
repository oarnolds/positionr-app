// app/(admin)/admin/prompts/[slug]/sidebar.tsx
//
// Vaste linkerkolom met alle 11 modules uit de registry. Server component —
// volledig statisch behalve de active-state.

import Link from "next/link";
import { MODULES } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";

export function PromptsSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <nav className="w-[280px] shrink-0 border-r border-gray-200 bg-gray-50">
      <div className="px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Modules
        </div>
      </div>
      <ul className="space-y-px px-2 pb-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const isActive = m.slug === activeSlug;
          return (
            <li key={m.slug}>
              <Link
                href={`/admin/prompts/${m.slug}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-purple-100 text-purple-900"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", m.iconColor)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">
                    {m.status === "active" ? "Actief" : "Binnenkort"}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
