import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

/**
 * Toont het resultaat van een Website Check sessie als gerenderde markdown.
 * De AI heeft de template (modules.format_example) gevuld; wij renderen 1-op-1.
 */
export function WebsiteCheckResultView({
  markdown,
}: {
  markdown: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <MarkdownBlock markdown={markdown} />
    </div>
  );
}
