import { notFound } from "next/navigation";
import { MODULES } from "@/lib/modules/registry";
import { getFormatExample } from "@/lib/modules/format-examples";
import { LayoutEditor } from "./layout-editor";

export default async function LayoutEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const moduleMeta = MODULES.find((m) => m.slug === slug && !m.parentSlug);
  if (!moduleMeta) notFound();

  const initialMarkdown = (await getFormatExample(slug)) ?? "";

  return (
    <div className="mx-auto max-w-7xl">
      <LayoutEditor
        slug={slug}
        moduleName={moduleMeta.name}
        initialMarkdown={initialMarkdown}
      />
    </div>
  );
}
