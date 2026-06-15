"use client";

import { Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { SECTIONS } from "@/modules/website-check/sections";
import type { LayoutItem } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

type SectionLayoutItem = Extract<LayoutItem, { kind: "section" }>;

export function InlineSection({
  item,
  data,
  onChange,
}: {
  item: SectionLayoutItem;
  data: WebsiteCheckOutput;
  onChange: (patch: Partial<SectionLayoutItem>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `section-${item.id}` });
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Alleen tijdens drag een inline opacity zetten — anders zou het de
    // Tailwind-class `opacity-50` voor verborgen secties overschrijven.
    ...(isDragging ? { opacity: 0.5 } : {}),
  };

  const def = SECTIONS.find((s) => s.id === item.id);

  if (!def) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        Sectie-id <span className="font-mono">{item.id}</span> bestaat niet
        meer in code.
      </div>
    );
  }

  const Component = def.Component;
  const titleValue = item.title ?? "";
  const introValue = item.intro ?? "";
  const isHidden = !item.visible;

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`group relative rounded-lg border-2 border-dashed border-slate-200 p-3 ${
        isHidden ? "opacity-50" : ""
      }`}
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
        <span className="font-mono text-xs text-slate-400">{def.id}</span>
        {isHidden && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
            verborgen
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => onChange({ visible: !item.visible })}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={item.visible ? "Verbergen" : "Tonen"}
            title={item.visible ? "Verbergen" : "Tonen"}
          >
            {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onChange({ visible: false })}
            className="rounded p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-600"
            aria-label="Sectie verbergen (prullenbak)"
            title="Sectie verbergen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={titleValue}
        placeholder={def.defaultTitle}
        onChange={(e) => onChange({ title: e.target.value || null })}
        className="mb-1 w-full border-0 bg-transparent text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-300"
      />
      <textarea
        value={introValue}
        placeholder="Optionele inleiding (laat leeg om over te slaan)"
        rows={1}
        onChange={(e) => onChange({ intro: e.target.value || null })}
        className="mb-3 w-full resize-none border-0 bg-transparent text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
      />

      <Component
        data={data}
        title={titleValue || def.defaultTitle}
        intro={null}
        hideHeader
      />
    </div>
  );
}
