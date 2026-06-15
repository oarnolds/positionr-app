"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { RichPromptEditor } from "@/components/rich-prompt-editor";
import type { LayoutItem } from "@/lib/modules/layout";

type BlockLayoutItem = Extract<LayoutItem, { kind: "block" }>;

export function InlineBlock({
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
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.5 } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className="group relative rounded-lg border-2 border-dashed border-slate-200 p-3"
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
        <span className="text-xs font-mono uppercase tracking-wide text-slate-400">
          Vrij blok
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-600"
          aria-label="Blok verwijderen"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <RichPromptEditor
        value={item.markdown}
        onChange={(markdown) => onChange({ markdown })}
        placeholder="Schrijf vrije content (Markdown ondersteund)…"
      />
    </div>
  );
}
