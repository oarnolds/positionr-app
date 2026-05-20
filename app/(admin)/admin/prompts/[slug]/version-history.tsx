// app/(admin)/admin/prompts/[slug]/version-history.tsx
//
// Accordion onderin de editor met saves van deze module. Klik "Terugzetten"
// → server action → router.refresh.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreVersion } from "./actions";
import { cn } from "@/lib/utils";

export type HistoryEntry = {
  id: string;
  savedAt: string; // ISO string
  savedByName: string;
  provider: "claude" | "perplexity";
  promptPreview: string; // eerste 80 chars
};

interface Props {
  slug: string;
  entries: HistoryEntry[];
}

export function VersionHistory({ slug, entries }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleRestore(historyId: string) {
    setConfirmId(null);
    setBusyId(historyId);
    try {
      await restoreVersion({ slug, historyId });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700"
      >
        <span
          className={cn("transition-transform", open && "rotate-90")}
          aria-hidden
        >
          ▸
        </span>
        Versie-historie ({entries.length})
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {entries.length === 0 && (
            <li className="text-xs text-gray-500">Nog geen saves.</li>
          )}
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {new Date(e.savedAt).toLocaleString("nl-NL")}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {e.savedByName} · {e.provider} · &quot;{e.promptPreview}…&quot;
                </div>
              </div>
              <button
                type="button"
                disabled={busyId === e.id}
                onClick={() => setConfirmId(e.id)}
                className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-50"
              >
                {busyId === e.id ? "Bezig…" : "Terugzetten"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[420px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Versie terugzetten?</h2>
            <p className="mt-2 text-sm text-gray-700">
              De huidige prompt wordt opgeslagen in history en vervangen door
              deze oude versie. Doorgaan?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => handleRestore(confirmId)}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Terugzetten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
