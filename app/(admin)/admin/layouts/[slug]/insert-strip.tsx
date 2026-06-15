"use client";

import { Plus } from "lucide-react";

export function InsertStrip({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="relative h-6">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-200" />
      <button
        type="button"
        onClick={onInsert}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-slate-300 bg-white px-3 py-0.5 text-xs text-slate-500 hover:border-purple-400 hover:text-purple-700"
      >
        <span className="inline-flex items-center gap-1">
          <Plus size={12} />
          Vrij blok invoegen
        </span>
      </button>
    </div>
  );
}
