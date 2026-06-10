"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

import { RichPromptEditor } from "@/components/rich-prompt-editor";
import type { LayoutItem } from "@/lib/modules/layout";

type BlockLayoutItem = Extract<LayoutItem, { kind: "block" }>;

/**
 * Vrij Markdown-blok in de EditorTab. Hergebruikt RichPromptEditor
 * (TipTap → Markdown via turndown). Output landt als markdown in
 * `item.markdown` en wordt door MarkdownBlock-component gerenderd in
 * de result-view.
 */
export function BlockItem({
  item,
  onChange,
  onRemove,
}: {
  item: BlockLayoutItem;
  onChange: (patch: Partial<BlockLayoutItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `block-${item.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-700"
          aria-label="Sleep om te herordenen"
        >
          <GripVertical size={16} />
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          Vrij blok
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
          aria-label="Blok verwijderen"
        >
          <X size={16} />
        </button>
      </div>
      <div className="rounded border border-amber-200 bg-white">
        <RichPromptEditor
          value={item.markdown}
          onChange={(markdown) => onChange({ markdown })}
          placeholder="Schrijf vrije content (Markdown ondersteund)…"
        />
      </div>
    </div>
  );
}
