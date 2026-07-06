"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { deleteSessionAction } from "../actions";

function TrashButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Verwijder dit rapport"
      title="Verwijder dit rapport"
      className={className}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

/**
 * Prullenbak-knop bij een rapport in de geschiedenislijst. Vraagt om
 * bevestiging en verwijdert daarna de sessie van de ingelogde gebruiker
 * via de gedeelde deleteSessionAction. `path` is de lijstpagina die na
 * het verwijderen ge-revalidate wordt.
 */
export function DeleteSessionButton({
  sessionId,
  path,
  className = "flex items-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60",
}: {
  sessionId: string;
  path: string;
  className?: string;
}) {
  return (
    <form
      action={deleteSessionAction}
      onSubmit={(e) => {
        if (!window.confirm("Dit rapport definitief verwijderen?")) {
          e.preventDefault();
        }
      }}
      className="flex items-stretch"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="path" value={path} />
      <TrashButton className={className} />
    </form>
  );
}
