"use client";

import { useState } from "react";
import { BookMarked, Link2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenericSourceType } from "@/modules/generic/schema";

export type SnapshotOption = { id: string; label: string };

/**
 * Bronkeuze voor de generieke runner: bibliotheek-snapshot, één specifieke
 * URL (single-page scrape) en/of een PDF/Word-upload — welke tabs zichtbaar
 * zijn bepaalt de module-config (sourceTypes). URL en upload worden
 * server-side eerst een bibliotheek-snapshot, daarna draait de analyse
 * gewoon op dat snapshot. Alleen het actieve invoerveld wordt gerenderd
 * zodat `required` nooit op een verborgen veld blokkeert.
 */
export function SourcePicker({
  sourceTypes,
  snapshots,
  urlLabel,
  urlPlaceholder,
  fileHint,
}: {
  sourceTypes: GenericSourceType[];
  snapshots: SnapshotOption[];
  urlLabel?: string;
  urlPlaceholder?: string;
  fileHint?: string;
}) {
  // Bibliotheek-tab heeft alleen zin als er snapshots zijn.
  const available = sourceTypes.filter(
    (t) => t !== "library" || snapshots.length > 0,
  );
  const [source, setSource] = useState<GenericSourceType>(
    available[0] ?? "url",
  );

  const TAB_META: Record<
    GenericSourceType,
    { label: string; icon: typeof Link2 }
  > = {
    library: { label: "Uit bibliotheek", icon: BookMarked },
    url: { label: urlLabel ?? "Specifieke URL", icon: Link2 },
    file: { label: "PDF, Word of spreadsheet", icon: Upload },
  };

  return (
    <div>
      <input type="hidden" name="sourceType" value={source} />
      {available.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {available.map((key) => {
            const { label, icon: Icon } = TAB_META[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSource(key)}
                aria-pressed={source === key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  source === key
                    ? "border-purple-500 bg-purple-100 text-purple-800"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      )}

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
          {available.length === 1 && urlLabel && (
            <span className="block font-semibold text-gray-700">
              {urlLabel}
            </span>
          )}
          <input
            name="caseUrl"
            type="text"
            required
            placeholder={urlPlaceholder ?? "bijv. https://uwbedrijf.nl/klantcase-x"}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,.pdf,.docx,.xlsx,.xls,.csv"
            className="mt-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-200"
          />
          {fileHint && (
            <p className="mt-1 text-xs font-medium text-gray-600">{fileHint}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Max 10 MB. PDF, .docx of spreadsheet (.xlsx/.xls/.csv). Het bestand
            wordt als snapshot in je bibliotheek bewaard. Converteren kan even
            duren — niet sluiten.
          </p>
        </>
      )}
    </div>
  );
}
