import type { KnowledgeBlock as KnowledgeBlockData } from "@/lib/knowledge/matching/types";

export function KnowledgeBlock({ block }: { block: KnowledgeBlockData }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border-l-4 border-indigo-500 bg-indigo-50/60 p-5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">
        📖 Uit de theorie
      </p>
      {block.bridge && (
        <p className="mt-1.5 text-[13px] italic text-gray-600">{block.bridge}</p>
      )}
      <span className="-mb-3 text-3xl font-extrabold leading-none text-indigo-300">
        &ldquo;
      </span>
      <p className="text-base font-semibold leading-snug text-gray-900">
        {block.card.kern}
      </p>
      <p className="mt-2.5 text-xs text-gray-600">
        <span className="font-bold">{block.card.title}</span>
        {" — "}
        {block.card.sourceLabel}
      </p>
      {block.card.toepassing && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          → {block.card.toepassing}
        </p>
      )}
    </div>
  );
}
