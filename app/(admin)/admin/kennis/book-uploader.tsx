"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createBookUploadUrl, startBookExtraction } from "./actions";

const BUCKET = "knowledge-books";

/**
 * Upload-flow voor boeken. Het bestand gaat RECHTSTREEKS van de browser naar
 * Supabase Storage (via een signed URL) omdat Vercel server-uploads op 4,5 MB
 * capt. Daarna krijgt de server-action alleen het pad en doet de extractie.
 */
export function BookUploader() {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError("Geen bestand gekozen");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Bestand te groot (max 50 MB)");
      return;
    }

    setBusy(true);
    try {
      setPhase("Upload voorbereiden…");
      const signed = await createBookUploadUrl(file.name, file.type);
      if (!signed.ok) {
        setError(signed.error);
        setBusy(false);
        return;
      }

      setPhase("Boek uploaden…");
      const supabase = createClient();
      const up = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: signed.contentType,
        });
      if (up.error) {
        setError(up.error.message);
        setBusy(false);
        return;
      }

      setPhase("Tekst extraheren…");
      // Bij succes redirect deze action server-side naar de bron-pagina;
      // alleen bij een fout keert 'ie terug met {error}.
      const result = await startBookExtraction(signed.path, signed.kind, file.name);
      if (result && "error" in result) {
        setError(result.error);
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload mislukt");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-xl border bg-white p-4">
      <input
        name="file"
        type="file"
        accept="application/pdf,application/epub+zip,.pdf,.epub"
        required
        disabled={busy}
        className="block w-full text-sm"
      />
      <p className="mt-1 text-xs text-gray-500">
        Max 50 MB. Auteur en taal worden automatisch herkend.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? phase || "Bezig…" : "Boek distilleren"}
      </button>
    </form>
  );
}
