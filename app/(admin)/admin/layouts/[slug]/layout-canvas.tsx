"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import type { LayoutConfig, LayoutItem } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";

import type { EditorMode } from "./mode-toggle";
import { InlineSection } from "./inline-section";
import { InlineBlock } from "./inline-block";
import { InsertStrip } from "./insert-strip";

function itemKey(item: LayoutItem): string {
  return `${item.kind}-${item.id}`;
}

export function LayoutCanvas({
  mode,
  layout,
  data,
  onChange,
}: {
  mode: EditorMode;
  layout: LayoutConfig;
  data: WebsiteCheckOutput;
  onChange: (next: LayoutConfig) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (mode === "preview") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
          Live preview met huidige edit-state. Wijzigingen worden pas zichtbaar
          voor klanten na <strong>Opslaan</strong>.
        </div>
        <WebsiteCheckResultView data={data} layout={layout} readOnly />
      </div>
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = layout.items.findIndex((i) => itemKey(i) === active.id);
    const newIdx = layout.items.findIndex((i) => itemKey(i) === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange({ ...layout, items: arrayMove(layout.items, oldIdx, newIdx) });
  }

  function updateItem(idx: number, patch: Partial<LayoutItem>) {
    const next = [...layout.items];
    next[idx] = { ...next[idx], ...patch } as LayoutItem;
    onChange({ ...layout, items: next });
  }

  function removeBlock(idx: number) {
    onChange({ ...layout, items: layout.items.filter((_, i) => i !== idx) });
  }

  function insertBlock(atIdx: number) {
    const newBlock: LayoutItem = {
      kind: "block",
      id: crypto.randomUUID(),
      markdown: "",
    };
    onChange({
      ...layout,
      items: [
        ...layout.items.slice(0, atIdx),
        newBlock,
        ...layout.items.slice(atIdx),
      ],
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={layout.items.map(itemKey)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          <InsertStrip onInsert={() => insertBlock(0)} />
          {layout.items.map((item, idx) => (
            <div key={itemKey(item)}>
              {item.kind === "section" ? (
                <InlineSection
                  item={item}
                  data={data}
                  onChange={(patch) => updateItem(idx, patch)}
                />
              ) : (
                <InlineBlock
                  item={item}
                  onChange={(patch) => updateItem(idx, patch)}
                  onRemove={() => removeBlock(idx)}
                />
              )}
              <InsertStrip onInsert={() => insertBlock(idx + 1)} />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
