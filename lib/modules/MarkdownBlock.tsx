import { marked } from "marked";

/**
 * Rendert een vrij Markdown-blok in de result-view.
 * `marked` produceert HTML — admin is vertrouwd, geen sanitization-laag.
 * Synchrone parse (marked.parse zonder async-flag).
 */
export function MarkdownBlock({ markdown }: { markdown: string }) {
  if (!markdown || !markdown.trim()) return null;
  const html = marked.parse(markdown, { async: false }) as string;
  return (
    <div
      className="prose prose-slate prose-sm max-w-none rounded-xl border border-slate-200 bg-slate-50/60 p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
