"use client";
import type { LayoutConfig } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

// Placeholder — wordt in T7 ingevuld met live ResultView.
export function PreviewTab({
  layout,
}: {
  layout: LayoutConfig;
  data: WebsiteCheckOutput;
}) {
  return (
    <div className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
      Preview placeholder — {layout.items.length} items zouden hier gerenderd worden.
    </div>
  );
}
