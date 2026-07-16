# Robuuste generieke rapport-parsing — ontwerp

- **Datum:** 2026-07-16
- **Module:** generic (raakt alle prompt-gedreven modules, aanleiding: markttrends-rapport)
- **Status:** ontwerp goedgekeurd, klaar voor implementatieplan

## Doel

Voorkomen dat één gedrift veld in de LLM-output een compleet generiek rapport
laat terugvallen op een rauwe-JSON-weergave. Bestaande al-gedegradeerde rapporten
(zoals het huidige markttrends-rapport) alsnog als kaarten tonen, zonder opnieuw
te draaien.

## Achtergrond / oorzaak

De generieke runner (`modules/generic/service.ts`) laat de LLM een `GenericReport`
JSON produceren, valideert die met Zod (`toGenericOutput`), en slaat op als
`{kind:"report"}` bij succes of `{kind:"markdown"}` als vangnet. De resultaatpagina
(`app/(app)/modules/[slug]/[sessionId]/page.tsx`) rendert `report` als kaarten
(`GenericReportView`) en `markdown` als platte tekst.

Diagnose van het laatste markttrends-rapport (via DB): de output is geldige JSON,
11 nette secties, maar **één feit gebruikte de Engelse sleutel `"value"` in plaats
van het Nederlandse `"waarde"`**:

```json
{ "label": "Tickstar-partnerschap", "value": "Samenwerking met Tickstar (2023)..." }
```

`ReportSectie.feiten` is `z.array(z.object({ label: z.string(), waarde: z.string() }))`
— het enige veld zónder `.catch()`. Het ontbrekende `waarde` liet `GenericReport.parse`
het hele rapport afkeuren → `kind:"markdown"` → rauwe JSON op het scherm. Alle andere
velden (accent, layout, inhoud) degraderen wél netjes; `feiten` is per ongeluk streng
gebleven, tegen de eigen schema-filosofie in ("format-drift degradeert naar een default
in plaats van een failure").

## Scope

**Wel** (alles in `modules/generic/schema.ts`):
- `feiten`, `chips`, `volgendeStappen`, `eyebrow`, `titel`, `heroTekst` net zo tolerant
  maken als de rest: degraderen i.p.v. falen.
- `feiten` daarbij sleutel-aliassen laten herstellen (`value`→`waarde`, `key`→`label`).
- Render-upgrade: een opgeslagen `markdown`-envelope die eigenlijk geldige kaart-JSON
  bevat alsnog als rapport renderen.

**Niet (YAGNI):**
- Geen wijziging aan `service.ts` (profiteert automatisch van het tolerante schema).
- Geen DB-migratie of backfill van opgeslagen sessies.
- Geen prompt-/layout-instructie-aanpassing (leniency is de robuuste fix, niet de LLM
  dwingen).
- `secties` blijft `.min(1)`: een écht leeg rapport valt terecht terug op markdown.

## Wijziging 1 — Schema toleranter (`modules/generic/schema.ts`)

Nieuw `Feit`-schema met normalisatie vóór validatie:

```ts
const asText = (x: unknown): string =>
  x == null ? "" : typeof x === "string" ? x : String(x);

// Normaliseer sleutel-aliassen en coerce naar tekst, zodat één gedrift feit
// (bv. "value" i.p.v. "waarde") het rapport nooit meer laat falen.
const Feit = z.preprocess(
  (v) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { label: asText(o.label ?? o.key), waarde: asText(o.waarde ?? o.value) };
  },
  z.object({ label: z.string(), waarde: z.string() }),
);
```

`ReportSectie` — alle velden degraderen:

```ts
export const ReportSectie = z.object({
  titel: z.string().catch(""),
  eyebrow: z.string().optional().catch(undefined),
  accent: z.enum(REPORT_ACCENT_VALUES).catch("blue"),
  layout: z.enum(["volledig", "half"]).catch("volledig"),
  inhoud: z.string().catch(""),
  feiten: z
    .array(Feit)
    .transform((a) => a.filter((f) => f.label !== "" || f.waarde !== ""))
    .catch([])
    .optional(),
  chips: z.array(z.string()).catch([]).optional(),
});
```

`GenericReport`:

```ts
export const GenericReport = z.object({
  heroTekst: z.string().catch(""),
  secties: z.array(ReportSectie).min(1),
  volgendeStappen: z.array(z.string()).catch([]).optional(),
});
```

Noten:
- `.catch("")` op `titel`/`heroTekst` subsumeert het oude `.default("")` (dekt óók een
  verkeerd type, niet alleen `undefined`).
- De `feiten`-transform laat lege feiten (geen label én geen waarde) vallen zodat er
  geen blanco rijen ontstaan; gedrift-met-inhoud (zoals `value`) wordt juist gered.
- Alleen een leeg/ontbrekend `secties` laat de parse nog falen (bewust → markdown).

## Wijziging 2 — Render-upgrade (`modules/generic/schema.ts`)

Nieuwe, client-veilige helper (géén import uit `lib/ai/claude.ts`; spiegelt wel het
extractie-gedrag van `extractAndParseJson`: fences strippen + eerste `{` t/m laatste `}`):

```ts
/**
 * Haal een JSON-object uit tekst en parse als GenericReport. Null als het geen
 * (geldig genoeg) rapport is. Gebruikt door de render-upgrade in parseGenericOutput.
 */
export function tryParseGenericReport(text: string): GenericReport | null {
  try {
    let cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    cleaned = cleaned.slice(start, end + 1);
    return GenericReport.parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}
```

`parseGenericOutput` — upgrade in de markdown-tak én in de outer-catch:

```ts
export function parseGenericOutput(raw: string | null): GenericOutput | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GenericOutput;
    if (parsed.kind === "report") {
      return {
        kind: "report",
        report: sanitizeGenericReport(GenericReport.parse(parsed.report)),
      };
    }
    if (parsed.kind === "markdown" && typeof parsed.markdown === "string") {
      // Render-upgrade: een 'markdown'-envelope die eigenlijk geldige kaart-JSON
      // bevat (bv. door de oude strenge parsing) alsnog als rapport tonen.
      const upgraded = tryParseGenericReport(parsed.markdown);
      if (upgraded) {
        return { kind: "report", report: sanitizeGenericReport(upgraded) };
      }
      return { kind: "markdown", markdown: stripDashes(parsed.markdown) };
    }
    return null;
  } catch {
    const upgraded = tryParseGenericReport(raw);
    if (upgraded) {
      return { kind: "report", report: sanitizeGenericReport(upgraded) };
    }
    return { kind: "markdown", markdown: stripDashes(raw) };
  }
}
```

## Dataflow

- **Nieuwe rapporten:** `service.ts` → `toGenericOutput` gebruikt hetzelfde (nu tolerante)
  `GenericReport` → parse slaagt bij drift → opgeslagen als `kind:"report"` → kaarten.
  Geen wijziging in `service.ts`.
- **Bestaande `kind:"markdown"`-sessies:** render → `parseGenericOutput` detecteert dat de
  markdown eigenlijk kaart-JSON is → upgrade → kaarten. Geen regeneratie, geldt voor alle
  generieke modules.
- **Echte prose-markdown (geen JSON):** `tryParseGenericReport` geeft `null` → blijft
  markdown. Geen valse upgrades.

## Testplan (`modules/generic/schema.test.ts`)

- `Feit`-normalisatie: `{label, value}` → `waarde` gered; ontbrekend `waarde` → `""`;
  niet-string waarde → gecoerced.
- `GenericReport.parse` op een rapport met één `value`-gedrift feit → slaagt, rapport intact
  (regressie op de bug).
- `feiten` met een volledig leeg feit → gefilterd.
- `chips` / `volgendeStappen` met een niet-string element → degradeert naar `[]`, rapport blijft.
- `tryParseGenericReport`: geldige kaart-JSON (met fences en zonder) → rapport; prose → `null`;
  leeg `secties` → `null`.
- `parseGenericOutput`: `{kind:"markdown", markdown:"<kaart-JSON met value-gedrift>"}` →
  `kind:"report"` (upgrade); `{kind:"markdown", markdown:"gewone tekst"}` → blijft markdown;
  `{kind:"report", report:{…}}` → ongewijzigd `kind:"report"`.

## Geraakte bestanden

| Bestand | Wijziging |
|---|---|
| `modules/generic/schema.ts` | tolerant schema (`Feit`, `ReportSectie`, `GenericReport`) + `tryParseGenericReport` + render-upgrade in `parseGenericOutput` |
| `modules/generic/schema.test.ts` | nieuwe/bijgewerkte tests (zie testplan) |

## Risico's

- **Valse upgrades:** nihil. Alleen inhoud die als volledig `GenericReport` met ≥1 sectie
  parset wordt opgewaardeerd; prose faalt op `secties.min(1)` → blijft markdown.
- **`String(x)` op een object-waarde** geeft `"[object Object]"` bij extreme drift — lelijk
  maar niet-fataal, en zeldzaam. Bewust geen verdere afhandeling (YAGNI).
- **Bestaande tests** in `schema.test.ts` kunnen op `.default`→`.catch` wijzigingen leunen;
  worden in het plan meegenomen.
