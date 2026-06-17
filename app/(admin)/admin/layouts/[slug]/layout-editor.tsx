"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";
import { saveFormatExample } from "./actions";

export function LayoutEditor({
  slug,
  moduleName,
  initialMarkdown,
}: {
  slug: string;
  moduleName: string;
  initialMarkdown: string;
}) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [isPending, startTransition] = useTransition();
  const baselineRef = useRef(initialMarkdown);
  const dirty = markdown !== baselineRef.current;

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function handleSave() {
    startTransition(async () => {
      await saveFormatExample(slug, markdown);
      baselineRef.current = markdown;
      router.refresh();
    });
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/layouts"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Modules
          </Link>
          <h1 className="text-xl font-bold">Layout — {moduleName}</h1>
          {dirty && (
            <span className="text-xs text-amber-700">● niet-opgeslagen</span>
          )}
        </div>
        <button
          type="button"
          disabled={!dirty || isPending}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Opslaan
        </button>
      </header>

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden">
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Markdown
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Begin met je format-voorbeeld…"
            className="flex-1 resize-none p-3 font-mono text-xs leading-relaxed text-slate-900 focus:outline-none"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <MarkdownBlock markdown={markdown} />
          </div>
        </div>
      </div>
    </div>
  );
}
