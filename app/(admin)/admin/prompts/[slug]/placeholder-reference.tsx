// app/(admin)/admin/prompts/[slug]/placeholder-reference.tsx
//
// Globale referentietabel met alle placeholders die in prompts gebruikt kunnen
// worden. Deze lijst is statisch — universele variabelen die door modules
// gevuld worden uit het bedrijfsprofiel + module-specifieke input.
//
// De *per-module* chip-lijst (uit modules/<slug>/index.ts PLACEHOLDERS-export)
// blijft naast deze tabel bestaan voor klikbare invoeg.

import { cn } from "@/lib/utils";

type Scope = "global" | "linkedin" | "competitors" | "website-check";

const SCOPE_LABEL: Record<Scope, string> = {
  global: "Alle modules",
  linkedin: "LinkedIn modules",
  competitors: "Concurrenten modules",
  "website-check": "Website Check",
};

const PLACEHOLDER_TABLE: Array<{
  key: string;
  description: string;
  scope: Scope;
}> = [
  {
    key: "companyName",
    description: "Naam van het bedrijf (bijv. \"Blendr B.V.\")",
    scope: "global",
  },
  {
    key: "sector",
    description: "Sector van het bedrijf (bijv. \"Zorgtechnologie\")",
    scope: "global",
  },
  {
    key: "websiteUrl",
    description: "Website URL van het bedrijf",
    scope: "global",
  },
  {
    key: "businessDescription",
    description: "KVK-omschrijving van de bedrijfsactiviteit",
    scope: "global",
  },
  {
    key: "description",
    description: "Gecombineerd blok: website URL + bedrijfsomschrijving",
    scope: "global",
  },
  {
    key: "linkedinUrl",
    description: "LinkedIn-pagina URL van het bedrijf",
    scope: "linkedin",
  },
  {
    key: "competitors",
    description:
      "Genummerde lijst van concurrenten met naam, website en LinkedIn-URL",
    scope: "competitors",
  },
  {
    key: "scrapedContent",
    description: "Gescrapte HTML-tekst van de website",
    scope: "website-check",
  },
];

export function PlaceholderReference() {
  return (
    <div className="mt-8 rounded-xl border bg-white p-5">
      <h2 className="text-base font-bold text-gray-900">
        Beschikbare Placeholders
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Gebruik deze placeholders in je prompts — ze worden automatisch
        vervangen door de gegevens die de klant heeft ingevuld of die door de
        module worden geleverd.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="pb-2 text-left font-medium text-gray-700">
                Placeholder
              </th>
              <th className="pb-2 text-left font-medium text-gray-700">
                Wordt vervangen door
              </th>
              <th className="pb-2 text-left font-medium text-gray-700">
                Module
              </th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_TABLE.map((row) => (
              <tr
                key={row.key}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="py-2">
                  <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">
                    {`{${row.key}}`}
                  </code>
                </td>
                <td className="py-2 text-gray-700">{row.description}</td>
                <td className="py-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      row.scope === "global"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-emerald-100 font-medium text-emerald-700",
                    )}
                  >
                    {SCOPE_LABEL[row.scope]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
