"use client";

import type { LayoutConfig, LayoutItem } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

import type { EditorMode } from "./mode-toggle";
import { PreviewTab } from "./preview-tab";
import { InlineSection } from "./inline-section";
import { BlockItem } from "./block-item";

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

  return (
    <div className="space-y-3">
      {layout.items.map((item, idx) => {
        if (item.kind === "section") {
          return (
            <InlineSection
              key={`section-${item.id}`}
              item={item}
              data={data}
              onChange={(patch) => updateItem(idx, patch)}
            />
          );
        }
        return (
          <BlockItem
            key={`block-${item.id}`}
            item={item}
            onChange={(patch) => updateItem(idx, patch)}
            onRemove={() => removeBlock(idx)}
          />
        );
      })}
    </div>
  );
}
