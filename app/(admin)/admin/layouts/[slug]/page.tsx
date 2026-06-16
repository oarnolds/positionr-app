import { notFound } from "next/navigation";
import { getModuleLayout } from "@/lib/modules/layouts";
import { getModuleLayoutHistory } from "@/lib/modules/layout-actions";
import { getPreviewData } from "@/lib/modules/preview-data";
import { getFormatExample } from "@/lib/modules/format-examples";
import { LayoutsSidebar } from "./sidebar";
import { LayoutEditor } from "./layout-editor";

/**
 * Modules waarvoor een layout-editor beschikbaar is. v1: alleen Website Check.
 * Onbekende slugs renderen een 404 zodat er geen lege editor verschijnt.
 */
const ALLOWED_SLUGS = new Set(["website-check"]);

export default async function LayoutEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.has(slug)) notFound();

  const [layout, history, previewData, formatExample] = await Promise.all([
    getModuleLayout(slug),
    getModuleLayoutHistory(slug),
    getPreviewData(slug),
    getFormatExample(slug),
  ]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <LayoutsSidebar activeSlug={slug} />
      <main className="flex-1 overflow-y-auto p-6">
        <LayoutEditor
          slug={slug}
          initialLayout={layout}
          history={history}
          previewData={previewData}
          formatExample={formatExample}
        />
      </main>
    </div>
  );
}
