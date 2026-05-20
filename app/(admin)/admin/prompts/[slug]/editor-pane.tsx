// app/(admin)/admin/prompts/[slug]/editor-pane.tsx
//
// Client component: TipTap-editor + provider-dropdown + placeholders +
// save/reset acties. Houd zelf de dirty-state bij.

"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  RichPromptEditor,
  type RichPromptEditorHandle,
} from "@/components/rich-prompt-editor";
import { savePrompt, resetPrompt } from "./actions";
import { cn } from "@/lib/utils";

type Provider = "claude" | "perplexity";
type Placeholder = { key: string; label: string; example: string };

interface Props {
  slug: string;
  moduleName: string;
  moduleStatus: "active" | "soon" | "disabled";
  initialPrompt: string;
  initialProvider: Provider;
  placeholders: readonly Placeholder[];
}

export function EditorPane({
  slug,
  moduleName,
  moduleStatus,
  initialPrompt,
  initialProvider,
  placeholders,
}: Props) {
  const router = useRouter();
  const editorHandleRef = useRef<RichPromptEditorHandle | null>(null);

  const [prompt, setPrompt] = useState(initialPrompt);
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Sync wanneer parent een andere module heeft (server-component refetch)
  useEffect(() => {
    setPrompt(initialPrompt);
    setProvider(initialProvider);
  }, [initialPrompt, initialProvider, slug]);

  const isDirty = prompt !== initialPrompt || provider !== initialProvider;

  // beforeunload-warning bij dirty state
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  async function handleSave() {
    if (!isDirty) return;
    setSaving(true);
    try {
      await savePrompt({ slug, prompt, provider });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetConfirmOpen(false);
    setSaving(true);
    try {
      await resetPrompt({ slug });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{moduleName}</h1>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            moduleStatus === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-700",
          )}
        >
          {moduleStatus === "active" ? "Actief" : "Binnenkort"}
        </span>
        {isDirty && (
          <span className="ml-auto text-xs font-medium text-amber-700">
            ● Onopgeslagen wijzigingen
          </span>
        )}
      </div>

      {moduleStatus !== "active" && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Deze module heeft nog geen runtime — je wijzigingen worden bewaard
          maar nog niet gebruikt totdat de module is geïmplementeerd.
        </div>
      )}

      <div className="mt-6">
        <label className="text-sm font-medium text-gray-700">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          className="ml-3 rounded-md border border-gray-300 px-3 py-1 text-sm"
        >
          <option value="claude">Claude</option>
          <option value="perplexity">Perplexity</option>
        </select>
      </div>

      {placeholders.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-medium text-gray-700">
            Beschikbare placeholders
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                title={`${p.label} — voorbeeld: ${p.example}`}
                onClick={() => {
                  editorHandleRef.current?.insertText(`{${p.key}}`);
                }}
                className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 font-mono text-xs text-purple-700 hover:bg-purple-100"
              >
                {`{${p.key}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <RichPromptEditor
          value={prompt}
          onChange={setPrompt}
          editorRef={editorHandleRef}
          minHeight={480}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!isDirty || saving}
          onClick={handleSave}
          className={cn(
            "rounded-lg px-4 py-2 font-semibold text-white",
            isDirty && !saving
              ? "bg-gradient-to-r from-purple-600 to-blue-600"
              : "bg-gray-300",
          )}
        >
          {saving ? "Bezig…" : "💾 Opslaan"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setResetConfirmOpen(true)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          ↺ Reset naar default
        </button>
      </div>

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[400px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Reset naar default?</h2>
            <p className="mt-2 text-sm text-gray-700">
              De huidige prompt wordt opgeslagen in version-history en
              vervangen door de fallback uit de code. Doorgaan?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
