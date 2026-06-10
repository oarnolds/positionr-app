"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { restoreModuleLayout, type LayoutHistoryEntry } from "@/lib/modules/layout-actions";

export function VersionHistory({
  slug,
  history,
}: {
  slug: string;
  history: LayoutHistoryEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  function handleRestore(id: string) {
    if (
      !confirm(
        "Deze versie herstellen? Maakt een nieuwe save aan in de historie zodat de huidige config niet verloren gaat.",
      )
    ) {
      return;
    }
    setRestoringId(id);
    startTransition(async () => {
      await restoreModuleLayout(slug, id);
      setRestoringId(null);
      router.refresh();
    });
  }

  const fmt = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <History size={16} />
        Versie-historie ({history.length})
      </button>
      {open && (
        <ul className="space-y-1 border-t border-slate-200 p-2">
          {history.length === 0 && (
            <li className="px-2 py-1 text-sm text-slate-500">
              Nog geen versies opgeslagen.
            </li>
          )}
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded border border-slate-200 bg-white p-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium">{fmt.format(entry.savedAt)}</div>
                {entry.note && (
                  <div className="truncate text-xs text-slate-500">
                    {entry.note}
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  {entry.layoutConfig.items.length} items
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(entry.id)}
                disabled={isPending}
                className="ml-3 inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-40"
              >
                {restoringId === entry.id && isPending && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                Herstel
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
