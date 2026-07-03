"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type Row = { naam: string; websiteUrl: string };

/**
 * Handmatige concurrent-invoer in de review-stap: expliciete
 * bedrijfsnaam + website-velden per rij, met toevoegen/verwijderen.
 * De velden submitten mee met het omliggende form (manualNaam/manualUrl,
 * gepaird op index in de server action).
 */
export function ManualCompetitors({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-6">
      <span className="text-sm font-semibold text-gray-700">
        Mis je een concurrent? Voeg zelf toe
      </span>

      {rows.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="text"
                name="manualNaam"
                value={row.naam}
                onChange={(e) => updateRow(i, { naam: e.target.value })}
                placeholder="Bedrijfsnaam"
                aria-label="Bedrijfsnaam concurrent"
                className="w-2/5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <input
                type="text"
                name="manualUrl"
                value={row.websiteUrl}
                onChange={(e) => updateRow(i, { websiteUrl: e.target.value })}
                placeholder="https://website.nl (optioneel)"
                aria-label="Website concurrent"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Verwijder deze concurrent"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { naam: "", websiteUrl: "" }])}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Concurrent toevoegen
      </button>
    </div>
  );
}
