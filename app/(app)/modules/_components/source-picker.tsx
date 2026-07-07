"use client";

import { useState } from "react";
import { BookMarked, Link2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenericSourceType } from "@/modules/generic/schema";

export type SnapshotOption = { id: string; label: string };

/**
 * Bronkeuze voor modules met `extraSources`: bestaand bibliotheek-snapshot,
 * één specifieke URL (single-page scrape) of een PDF/Word-upload. De twee
 * nieuwe varianten worden server-side eerst een bibliotheek-snapshot, daarna
 * draait de analyse gewoon op dat snapshot. Alleen het actieve invoerveld
 * wordt gerenderd zodat `required` nooit op een verborgen veld blokkeert.
 */
export function SourcePicker({ snapshots }: { snapshots: SnapshotOption[] }) {
  const hasLibrary = snapshots.length > 0;
  const [source, setSource] = useState<GenericSourceType>(
    hasLibrary ? "library" : "url",
  );

  const tabs: { key: GenericSourceType; label: string; icon: typeof Link2 }[] = [
    ...(hasLibrary
      ? [{ key: "library" as const, label: "Uit bibliotheek", icon: BookMarked }]
      : []),
    { key: "url" as const, label: "Specifieke URL", icon: Link2 },
    { key: "file" as const, label: "PDF of Word", icon: Upload },
  ];

  return (
    <div>
      <input type="hidden" name="sourceType" value={source} />
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSource(t.key)}
              aria-pressed={source === t.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                source === t.key
                  ? "border-purple-500 bg-purple-100 text-purple-800"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {source === "library" && (
        <select
          name="snapshotId"
          required
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {snapshots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {source === "url" && (
        <>
          <input
            name="caseUrl"
            type="text"
            required
            placeholder="bijv. https://uwbedrijf.nl/klantcase-x"
            className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Alleen deze ene pagina wordt opgehaald en als snapshot in je
            bibliotheek bewaard.
          </p>
        </>
      )}

      {source === "file" && (
        <>
          <input
            name="file"
            type="file"
            required
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
            className="mt-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-200"
          />
          <p className="mt-1 text-xs text-gray-500">
            Max 10 MB, PDF of .docx. Het document wordt als snapshot in je
            bibliotheek bewaard. Converteren kan even duren — niet sluiten.
          </p>
        </>
      )}
    </div>
  );
}
