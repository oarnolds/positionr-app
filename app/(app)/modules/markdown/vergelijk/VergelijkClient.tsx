"use client";

import { useState, useTransition } from "react";
import { runComparison, type CompareResult } from "./actions";

export function VergelijkClient() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await runComparison(url);
        setResult(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-3 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5"
      >
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Website-URL</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="bijv. https://uwbedrijf.nl"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
            disabled={isPending}
          />
        </label>
        <button
          type="submit"
          disabled={isPending || url.length < 3}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Bezig… (kan enkele minuten duren)" : "Vergelijk 3 modellen"}
        </button>
        <p className="text-xs text-gray-600">
          Fetcht pages 1x, downloadt images 1x, laat vervolgens Haiku 4.5,
          Opus 5 en Fable 5 parallel dezelfde images beschrijven. Verwachte
          kost per run: <strong>~$5</strong>.
        </p>
      </form>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Fout:</strong> {error}
        </div>
      ) : null}

      {result ? <ResultView result={result} /> : null}
    </div>
  );
}

function ResultView({ result }: { result: CompareResult }) {
  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border bg-white p-4 text-sm">
        <div>
          <strong>URL:</strong> {result.websiteUrl}
        </div>
        <div>
          <strong>Totale wall-clock:</strong>{" "}
          {(result.totalWallClockMs / 1000).toFixed(1)}s
        </div>
        <div>
          <strong>Unique images in test-set:</strong> {result.totalImagesInSet}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {result.results.map((r) => (
          <div key={r.model} className="rounded-2xl border-2 bg-white p-4">
            <h3 className="text-base font-bold">{modelLabel(r.model)}</h3>
            <div className="mt-1 text-xs text-gray-500">{r.model}</div>
            {r.fatalError ? (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <strong>Fataal:</strong> {r.fatalError}
              </div>
            ) : (
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Kost:</dt>
                  <dd className="font-bold">
                    ${(r.costCents / 100).toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Wall-clock:</dt>
                  <dd>{(r.wallClockMs / 1000).toFixed(1)}s</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Images ok:</dt>
                  <dd>
                    {r.imagesOk} / {r.imagesAttempted}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Batches ok/fail:</dt>
                  <dd>
                    {r.batchesOk} / {r.batchesFailed}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">
        Kwaliteit-vergelijking (eerste 10 images)
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left">Image</th>
              {result.results.map((r) => (
                <th key={r.model} className="p-2 text-left">
                  {modelLabel(r.model)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.sampleImages.map((img) => (
              <tr key={img.key} className="border-b align-top">
                <td className="p-2">
                  <img
                    src={img.url}
                    alt={img.alt ?? ""}
                    className="h-16 w-16 rounded border object-contain"
                  />
                </td>
                {result.results.map((r) => (
                  <td key={r.model} className="max-w-xs p-2 text-xs">
                    {r.descriptionsByKey[img.key] ?? (
                      <span className="text-gray-400">— (SKIP of fail)</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function modelLabel(model: string): string {
  if (model === "claude-haiku-4-5-20251001") return "Haiku 4.5";
  if (model === "claude-opus-5") return "Opus 5";
  if (model === "claude-fable-5") return "Fable 5";
  return model;
}
