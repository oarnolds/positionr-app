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
import { SectionItem } from "./section-item";
import { BlockItem } from "./block-item";
import { HoverInsert } from "./hover-insert";

function itemKey(item: LayoutItem): string {
  return `${item.kind}-${item.id}`;
}

export function EditorTab({
  layout,
  onChange,
}: {
  layout: LayoutConfig;
  onChange: (next: LayoutConfig) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  function removeItem(idx: number) {
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
          <HoverInsert onInsert={() => insertBlock(0)} />
          {layout.items.map((item, idx) => (
            <div key={itemKey(item)}>
              {item.kind === "section" ? (
                <SectionItem
                  item={item}
                  onChange={(patch) =>
                    updateItem(idx, patch as Partial<LayoutItem>)
                  }
                />
              ) : (
                <BlockItem
                  item={item}
                  onChange={(patch) =>
                    updateItem(idx, patch as Partial<LayoutItem>)
                  }
                  onRemove={() => removeItem(idx)}
                />
              )}
              <HoverInsert onInsert={() => insertBlock(idx + 1)} />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
