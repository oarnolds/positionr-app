"use client";

import { Plus } from "lucide-react";

/**
 * Smalle hover-strip die tussen items een "+ Vrij blok invoegen"-knop
 * tevoorschijn brengt. Out-of-the-flow zodat de items strak op elkaar
 * blijven; alleen bij hover wordt de + zichtbaar.
 */
export function HoverInsert({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group relative h-3">
      <button
        type="button"
        onClick={onInsert}
        className="absolute inset-x-0 top-1/2 mx-auto flex w-fit -translate-y-1/2 items-center gap-1 rounded-full border border-dashed border-transparent bg-white px-2.5 py-0.5 text-xs text-slate-500 opacity-0 transition-opacity hover:border-purple-300 hover:text-purple-700 group-hover:opacity-100"
      >
        <Plus size={12} />
        Vrij blok invoegen
      </button>
    </div>
  );
}
