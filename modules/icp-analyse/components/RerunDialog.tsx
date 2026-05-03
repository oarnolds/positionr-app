"use client";

export function RerunDialog({
  previousRunAt,
  product,
  onChoose,
  onCancel,
}: {
  previousRunAt: string;
  product: string;
  onChoose: (intent: "replace" | "version" | "topic") => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">Bestaande ICP gevonden</h2>
        <p className="mt-2 text-sm text-gray-600">
          Voor &ldquo;{product}&rdquo; is er al een analyse op{" "}
          {new Date(previousRunAt).toLocaleString("nl-NL")}. Wat wil je doen?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => onChoose("replace")}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white text-left"
          >
            <div className="font-semibold">Vervangen (correctie)</div>
            <div className="text-xs opacity-80">
              Vorige output was niet goed — overschrijf met deze run.
            </div>
          </button>
          <button
            onClick={() => onChoose("version")}
            className="rounded-lg bg-cyan-500 px-3 py-2 text-sm text-white text-left"
          >
            <div className="font-semibold">Nieuwe versie over tijd</div>
            <div className="text-xs opacity-80">
              Bedrijf is veranderd — nieuwste versie wordt canoniek.
            </div>
          </button>
          <button
            onClick={() => onChoose("topic")}
            className="rounded-lg border px-3 py-2 text-sm text-left"
          >
            <div className="font-semibold">Nieuw onderwerp</div>
            <div className="text-xs text-gray-600">
              Andere doelgroep/scenario voor zelfde product — bewaar beide.
            </div>
          </button>
          <button
            onClick={onCancel}
            className="mt-2 text-xs text-gray-500 hover:underline"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}
