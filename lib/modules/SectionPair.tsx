import type { ReactNode } from "react";
import type { KnowledgeBlock as KnowledgeBlockData } from "@/lib/knowledge/matching/types";
import { KnowledgeBlock } from "./KnowledgeBlock";

/**
 * Zet een sectie (children) en zijn kennisblokje naast elkaar (~60/40).
 * Afwisselend: oneven rank → blokje rechts, even rank → blokje links.
 * Mobiel (geen md): de sectie staat altijd boven het blokje.
 */
export function SectionPair({
  block,
  children,
}: {
  block: KnowledgeBlockData;
  children: ReactNode;
}) {
  const blockLeft = block.rank % 2 === 0;
  const cols = blockLeft
    ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]"
    : "md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]";
  return (
    <div className={`grid gap-5 md:items-start ${cols}`}>
      <div className={blockLeft ? "md:order-2" : "md:order-1"}>{children}</div>
      <div className={blockLeft ? "md:order-1" : "md:order-2"}>
        <KnowledgeBlock block={block} />
      </div>
    </div>
  );
}
