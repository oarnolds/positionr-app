"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, Loader2, BookOpen } from "lucide-react";

import type { LayoutConfig } from "@/lib/modules/layout";
import type { LayoutHistoryEntry } from "@/lib/modules/layout-actions";
import {
  saveModuleLayout,
  resetModuleLayout,
} from "@/lib/modules/layout-actions";

import { VersionHistory } from "./version-history";
import { ModeToggle, type EditorMode } from "./mode-toggle";
import { LayoutCanvas } from "./layout-canvas";
import { FormatExampleDrawer } from "./format-example-drawer";

export function LayoutEditor({
  slug,
  initialLayout,
  history,
  formatExample,
}: {
  slug: string;
  initialLayout: LayoutConfig;
  history: LayoutHistoryEntry[];
  formatExample: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<EditorMode>("edit");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [layout, setLayout] = useState<LayoutConfig>(initialLayout);
  const [isPending, startTransition] = useTransition();

  // Baseline = laatst opgeslagen versie. Dirty = state ≠ baseline.
  const baselineRef = useRef<string>(JSON.stringify(initialLayout));
  const dirty = JSON.stringify(layout) !== baselineRef.current;

  // beforeunload-prompt bij dirty state.
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
      await saveModuleLayout(slug, layout, null);
      baselineRef.current = JSON.stringify(layout);
      router.refresh(); // history herladen vanaf de server
    });
  }

  function handleReset() {
    if (
      !confirm(
        "Layout herstellen naar standaard? Huidige aanpassingen worden vervangen door de default.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      await resetModuleLayout(slug);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Layout — {slug}</h1>
          {dirty && (
            <p className="text-xs text-amber-700">Niet-opgeslagen wijzigingen</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Opslaan
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <RotateCcw size={16} /> Reset
          </button>
          {formatExample !== null && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <BookOpen size={16} /> Voorbeeld
            </button>
          )}
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      <LayoutCanvas
        mode={mode}
        layout={layout}
        onChange={setLayout}
      />

      <VersionHistory slug={slug} history={history} />

      {formatExample !== null && (
        <FormatExampleDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Voorbeeld — ${slug}`}
          markdown={formatExample}
        />
      )}
    </div>
  );
}
