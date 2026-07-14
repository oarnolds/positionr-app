"use client";

import { useFormStatus } from "react-dom";
import { Trash2, Loader2 } from "lucide-react";
import { deleteSourceAction } from "./actions";

function SubmitButton({ label }: { label?: string }) {
  const { pending } = useFormStatus();
  if (label) {
    return (
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {label}
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Verwijder boek"
      title="Verwijder boek"
      className="flex items-center rounded-lg border border-gray-200 bg-white px-3 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

/**
 * Verwijdert een boek (bron) inclusief het opgeslagen bestand en alle
 * bijbehorende kaarten (cascade). Vraagt eerst om bevestiging.
 */
export function DeleteSourceButton({
  sourceId,
  label,
}: {
  sourceId: string;
  label?: string;
}) {
  return (
    <form
      action={deleteSourceAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Dit boek en alle bijbehorende kaarten definitief verwijderen?",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex items-stretch"
    >
      <input type="hidden" name="sourceId" value={sourceId} />
      <SubmitButton label={label} />
    </form>
  );
}
