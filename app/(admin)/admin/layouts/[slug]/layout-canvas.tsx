"use client";

import type { LayoutConfig } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

import type { EditorMode } from "./mode-toggle";
import { EditorTab } from "./editor-tab";
import { PreviewTab } from "./preview-tab";

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
  return <EditorTab layout={layout} onChange={onChange} />;
}
