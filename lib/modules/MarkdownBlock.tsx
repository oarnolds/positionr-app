import { marked } from "marked";

type Variant = "default" | "report";

const VARIANT_CLASSES: Record<Variant, string> = {
  default:
    "prose prose-slate prose-sm max-w-none rounded-xl border border-slate-200 bg-slate-50/60 p-4",
  report:
    "prose prose-slate max-w-none px-10 py-6 " +
    "prose-headings:font-medium " +
    "prose-h1:text-2xl prose-h1:border-b-2 prose-h1:border-purple-100 prose-h1:pb-2 prose-h1:mt-8 prose-h1:mb-4 " +
    "prose-h3:text-base prose-h3:font-semibold prose-h3:text-slate-700 prose-h3:mt-6 prose-h3:mb-2 " +
    "prose-h4:text-[11px] prose-h4:uppercase prose-h4:tracking-wider prose-h4:text-slate-500 prose-h4:font-semibold prose-h4:mt-4 prose-h4:mb-1 " +
    "prose-table:text-sm " +
    "prose-th:bg-purple-50 prose-th:text-purple-900 prose-th:font-medium prose-th:px-3 prose-th:py-2 prose-th:text-left " +
    "prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-slate-200",
};

/**
 * Rendert een vrij Markdown-blok.
 * `marked` produceert HTML — admin is vertrouwd, geen sanitization-laag.
 * Synchrone parse (marked.parse zonder async-flag).
 * `variant="report"` activeert de pro-rapport-typografie voor de
 * website-check eindgebruiker-render.
 */
export function MarkdownBlock({
  markdown,
  variant = "default",
}: {
  markdown: string;
  variant?: Variant;
}) {
  if (!markdown || !markdown.trim()) return null;
  const html = marked.parse(markdown, { async: false }) as string;
  return (
    <div
      className={VARIANT_CLASSES[variant]}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
