"use client";

import type { LayoutConfig } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";

/**
 * Preview-tab van de layout-editor. Rendert dezelfde `WebsiteCheckResultView`
 * die in productie de result-pagina aandrijft, maar dan met de huidige
 * (mogelijk onopgeslagen) edit-state als layout. Data komt uit
 * `getPreviewData()` — meest recente echte sessie of fallback fixture.
 */
export function PreviewTab({
  layout,
  data,
}: {
  layout: LayoutConfig;
  data: WebsiteCheckOutput;
}) {
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
