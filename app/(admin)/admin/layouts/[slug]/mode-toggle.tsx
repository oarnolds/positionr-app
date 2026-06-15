"use client";

import { Edit3, Eye } from "lucide-react";

export type EditorMode = "edit" | "preview";

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (next: EditorMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-300 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("edit")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
          mode === "edit"
            ? "bg-purple-600 text-white"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Edit3 size={14} /> Bewerken
      </button>
      <button
        type="button"
        onClick={() => onChange("preview")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
          mode === "preview"
            ? "bg-purple-600 text-white"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Eye size={14} /> Voorbeeld
      </button>
    </div>
  );
}
