"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

export function FormatExampleDrawer({
  open,
  onClose,
  title,
  markdown,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  markdown: string;
}) {
  // Esc-sluit-toets (alleen actief als drawer open is).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay (klik sluit) */}
      <div
        className="flex-1 bg-slate-900/20"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={title}
        className="flex h-full w-[50vw] min-w-[480px] max-w-[720px] flex-col border-l border-slate-200 bg-white shadow-lg"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Sluiten"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <MarkdownBlock markdown={markdown} />
        </div>
      </aside>
    </div>
  );
}
