"use client";
import type { LayoutConfig } from "@/lib/modules/layout";

// Placeholder — wordt in T5/T6 ingevuld met dnd-kit + per-item form.
export function EditorTab({
  layout,
}: {
  layout: LayoutConfig;
  onChange: (next: LayoutConfig) => void;
}) {
  return (
    <div className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
      Editor placeholder — {layout.items.length} items in config.
    </div>
  );
}
