"use client";

import type { LayoutConfig, LayoutItem } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

import type { EditorMode } from "./mode-toggle";
import { PreviewTab } from "./preview-tab";
import { InlineSection } from "./inline-section";
import { InlineBlock } from "./inline-block";
import { InsertStrip } from "./insert-strip";

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
  if (mode === "preview") {
    return <PreviewTab layout={layout} data={data} />;
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
    <div className="space-y-1">
      <InsertStrip onInsert={() => insertBlock(0)} />
      {layout.items.map((item, idx) => (
        <div key={item.kind === "section" ? `section-${item.id}` : `block-${item.id}`}>
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
  );
}
