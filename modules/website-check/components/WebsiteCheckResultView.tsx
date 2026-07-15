import { WebsiteCheckReport } from "../report/WebsiteCheckReport";
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";

/**
 * Entry-point voor het Website Check resultaat. Houdt de container-styling
 * (centered, padding) en delegeert naar de rapport-renderer.
 */
export function WebsiteCheckResultView({
  markdown,
  blocks = [],
}: {
  markdown: string;
  blocks?: KnowledgeBlock[];
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <WebsiteCheckReport markdown={markdown} blocks={blocks} />
    </div>
  );
}
