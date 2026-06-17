import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

export function ReportBody({ markdown }: { markdown: string }) {
  if (!markdown || !markdown.trim()) return null;
  return <MarkdownBlock markdown={markdown} variant="report" />;
}
