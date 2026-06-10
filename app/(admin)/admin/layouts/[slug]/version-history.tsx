"use client";
import type { LayoutHistoryEntry } from "@/lib/modules/layout-actions";

// Placeholder — wordt in T8 ingevuld met accordion + restore.
export function VersionHistory({
  history,
}: {
  slug: string;
  history: LayoutHistoryEntry[];
}) {
  return (
    <div className="rounded border border-dashed border-slate-300 p-3 text-sm text-slate-500">
      Versie-historie ({history.length}) — placeholder
    </div>
  );
}
