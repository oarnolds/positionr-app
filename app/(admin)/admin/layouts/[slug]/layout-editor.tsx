"use client";

import type { LayoutConfig } from "@/lib/modules/layout";
import type { LayoutHistoryEntry } from "@/lib/modules/layout-actions";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

// Placeholder — wordt in T4 vervangen door echte editor met tabs/state/save.
export function LayoutEditor({
  slug,
  initialLayout,
  history,
}: {
  slug: string;
  initialLayout: LayoutConfig;
  history: LayoutHistoryEntry[];
  previewData: WebsiteCheckOutput;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Layout — {slug}</h1>
      <p className="text-sm text-slate-500">
        Editor in opbouw. {initialLayout.items.length} secties, {history.length} versies in historie.
      </p>
    </div>
  );
}
