"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { SECTIONS } from "@/modules/website-check/sections";
import type { LayoutItem } from "@/lib/modules/layout";

type SectionLayoutItem = Extract<LayoutItem, { kind: "section" }>;

/**
 * Eén section-rij in de EditorTab — draggable + drie velden:
 *  - visible (checkbox)
 *  - title (input, placeholder = defaultTitle)
 *  - intro (textarea)
 *
 * `def` (uit SECTIONS-registry) kan undefined zijn als de admin een
 * config gebruikt met een sectie-id die niet meer in code bestaat.
 * In dat geval: minimale UI zonder beschrijving.
 */
export function SectionItem({
  item,
  onChange,
}: {
  item: SectionLayoutItem;
  onChange: (patch: Partial<SectionLayoutItem>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `section-${item.id}` });
  const def = SECTIONS.find((s) => s.id === item.id);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-slate-200 bg-white p-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-700"
          aria-label="Sleep om te herordenen"
        >
          <GripVertical size={16} />
        </button>
        <input
          type="checkbox"
          checked={item.visible}
          onChange={(e) => onChange({ visible: e.target.checked })}
          className="mt-1.5"
          title={item.visible ? "Zichtbaar" : "Verborgen"}
        />
        <div className="flex-1 space-y-2">
          <div>
            <label className="text-xs text-slate-500">
              Titel
              <span className="ml-1 text-slate-400">
                (leeg = standaard {def?.defaultTitle ? `"${def.defaultTitle}"` : ""})
              </span>
            </label>
            <input
              type="text"
              value={item.title ?? ""}
              onChange={(e) => onChange({ title: e.target.value || null })}
              placeholder={def?.defaultTitle ?? "(default)"}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Intro (optioneel)</label>
            <textarea
              value={item.intro ?? ""}
              onChange={(e) => onChange({ intro: e.target.value || null })}
              rows={2}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              placeholder="Korte inleidende tekst onder de titel"
            />
          </div>
          {def && (
            <p className="text-xs text-slate-500">
              <span className="font-mono">{def.id}</span> — {def.description}
            </p>
          )}
          {!def && (
            <p className="text-xs text-rose-600">
              Sectie-id <span className="font-mono">{item.id}</span> bestaat niet meer in code.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
