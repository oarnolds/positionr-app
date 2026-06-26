"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  className?: string;
};

/**
 * Submit-knop die automatisch een spinner + disabled state toont zodra
 * de form de bijbehorende server-action heeft afgevuurd. Werkt mee met
 * formAction-attribuut op meerdere knoppen binnen dezelfde form.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className = "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingLabel ?? "Bezig…"}
        </>
      ) : (
        label
      )}
    </button>
  );
}
