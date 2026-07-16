# Robuuste generieke rapport-parsing — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voorkomen dat één gedrift veld (zoals een feit met `value` i.p.v. `waarde`) een compleet generiek rapport op rauwe-JSON laat terugvallen, en bestaande al-gedegradeerde rapporten alsnog als kaarten tonen.

**Architecture:** Alles in `modules/generic/schema.ts`. Deel 1: het Zod-schema (`Feit`, `ReportSectie`, `GenericReport`) degradeert overal i.p.v. te falen, en herstelt sleutel-aliassen. Deel 2: een client-veilige `tryParseGenericReport` + een render-upgrade in `parseGenericOutput` die een opgeslagen `markdown`-envelope-die-eigenlijk-kaart-JSON-is als rapport rendert.

**Tech Stack:** TypeScript, Zod (v3), Vitest. Path-alias `@/` → repo-root.

**Ontwerp-spec:** `docs/superpowers/specs/2026-07-16-generieke-rapport-parsing-robuust-design.md`

**Volgorde-afhankelijkheid:** Task 2's render-upgrade leunt op het tolerante schema uit Task 1 (om gedrifte feiten te herstellen). Beide zijn losse, groen-blijvende commits in hetzelfde bestand.

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid |
|---|---|
| `modules/generic/schema.ts` (wijzig) | Tolerant `Feit`/`ReportSectie`/`GenericReport` + `tryParseGenericReport` + render-upgrade in `parseGenericOutput` |
| `modules/generic/schema.test.ts` (wijzig) | Nieuwe tests voor leniency, alias-herstel, en de render-upgrade |

---

## Task 1: Tolerant schema (leniency + alias-herstel)

**Files:**
- Modify: `modules/generic/schema.ts:22-45` (ReportSectie + GenericReport)
- Test: `modules/generic/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Voeg aan de import bovenaan `modules/generic/schema.test.ts` `GenericReport` toe:

```ts
import {
  GENERIC_MODULES,
  GenericReport,
  isGenericModule,
  moduleSourceTypes,
  parseGenericOutput,
  parseSourceType,
} from "./schema";
```

Voeg deze tests toe (onderaan het bestand):

```ts
test("GenericReport: feit met 'value'-alias wordt gered naar 'waarde'", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", feiten: [{ label: "Partner", value: "Tickstar (2023)" }] }],
  });
  expect(r.secties[0].feiten).toEqual([{ label: "Partner", waarde: "Tickstar (2023)" }]);
});

test("GenericReport: één gedrift feit sloopt het rapport niet meer", () => {
  // Regressie op de markttrends-bug: het model gebruikte 'value' i.p.v. 'waarde'.
  const parse = () =>
    GenericReport.parse({
      heroTekst: "H",
      secties: [
        {
          titel: "S",
          feiten: [
            { label: "Goed", waarde: "ok" },
            { label: "Gedrift", value: "gered" },
          ],
        },
      ],
    });
  expect(parse).not.toThrow();
  expect(parse().secties[0].feiten).toEqual([
    { label: "Goed", waarde: "ok" },
    { label: "Gedrift", waarde: "gered" },
  ]);
});

test("GenericReport: niet-string feit-waarde wordt gecoerced naar tekst", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", feiten: [{ label: "Aantal", waarde: 42 }] }],
  });
  expect(r.secties[0].feiten).toEqual([{ label: "Aantal", waarde: "42" }]);
});

test("GenericReport: volledig leeg feit wordt gefilterd", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", feiten: [{}, { label: "X", waarde: "y" }] }],
  });
  expect(r.secties[0].feiten).toEqual([{ label: "X", waarde: "y" }]);
});

test("GenericReport: rotte chips/stappen degraderen naar leeg, rapport blijft", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", chips: ["ok", 5] }],
    volgendeStappen: ["stap", { niet: "string" }],
  });
  expect(r.secties[0].chips).toEqual([]);
  expect(r.volgendeStappen).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run modules/generic/schema.test.ts`
Expected: FAIL — de gedrift-tests gooien nu (`waarde` ontbreekt / niet-string) omdat `feiten` nog streng is.

- [ ] **Step 3: Implement the tolerant schema**

In `modules/generic/schema.ts`, vervang het `ReportSectie`-blok (regel 22-38) en het `GenericReport`-blok (regel 40-45) door:

```ts
const asText = (x: unknown): string =>
  x == null ? "" : typeof x === "string" ? x : String(x);

// Normaliseer sleutel-aliassen (value→waarde, key→label) en coerce naar tekst,
// zodat één gedrift feit het rapport nooit meer laat falen.
const Feit = z.preprocess(
  (v) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { label: asText(o.label ?? o.key), waarde: asText(o.waarde ?? o.value) };
  },
  z.object({ label: z.string(), waarde: z.string() }),
);

export const ReportSectie = z.object({
  titel: z.string().catch(""),
  /** Korte uppercase-kop in plaats van titel (zoals "WAAROM KIEZEN KLANTEN VOOR ONS?"). */
  eyebrow: z.string().optional().catch(undefined),
  accent: z.enum(REPORT_ACCENT_VALUES).catch("blue"),
  /** "half" = twee-koloms grid op desktop; "volledig" = volle breedte. */
  layout: z.enum(["volledig", "half"]).catch("volledig"),
  /** Vrije markdown-inhoud binnen de kaart. */
  inhoud: z.string().catch(""),
  /** Label/waarde-rijen (zoals het firmografisch profiel in ICP). Volledig
   *  lege feiten worden gefilterd; drift met inhoud wordt gered. */
  feiten: z
    .array(Feit)
    .transform((a) => a.filter((f) => f.label !== "" || f.waarde !== ""))
    .catch([])
    .optional(),
  /** Korte tags als pills (zoals trigger-events in ICP). */
  chips: z.array(z.string()).catch([]).optional(),
});
export type ReportSectie = z.infer<typeof ReportSectie>;

export const GenericReport = z.object({
  heroTekst: z.string().catch(""),
  secties: z.array(ReportSectie).min(1),
  volgendeStappen: z.array(z.string()).catch([]).optional(),
});
export type GenericReport = z.infer<typeof GenericReport>;
```

Note: `.catch("")` op `titel`/`heroTekst` vervangt het oude `.default("")` (dekt óók een verkeerd type). Alleen een leeg `secties` laat de parse nog falen (bewust → markdown-fallback).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run modules/generic/schema.test.ts`
Expected: PASS — alle nieuwe tests én de bestaande (o.a. `parseGenericOutput: strip em-dashes`).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck 2>&1 | grep "generic/schema" || echo "schoon"`
Expected: `schoon`.

- [ ] **Step 6: Commit**

```bash
git add modules/generic/schema.ts modules/generic/schema.test.ts
git commit -m "fix(generic): tolerant rapport-schema, herstel feit-sleutelaliassen" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Render-upgrade (markdown-die-eigenlijk-rapport-is → kaarten)

**Files:**
- Modify: `modules/generic/schema.ts` (nieuwe `tryParseGenericReport` + `parseGenericOutput` regel 74-92)
- Test: `modules/generic/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Voeg `tryParseGenericReport` toe aan de import bovenaan `modules/generic/schema.test.ts`:

```ts
import {
  GENERIC_MODULES,
  GenericReport,
  isGenericModule,
  moduleSourceTypes,
  parseGenericOutput,
  parseSourceType,
  tryParseGenericReport,
} from "./schema";
```

Voeg deze tests toe (onderaan het bestand):

```ts
test("tryParseGenericReport: geldige kaart-JSON → rapport (met en zonder fences)", () => {
  const json = JSON.stringify({ secties: [{ titel: "S", inhoud: "x" }] });
  expect(tryParseGenericReport(json)?.secties[0].titel).toBe("S");
  expect(tryParseGenericReport("```json\n" + json + "\n```")?.secties[0].titel).toBe("S");
});

test("tryParseGenericReport: gewone prose → null", () => {
  expect(tryParseGenericReport("# Kop\n\nGewone tekst zonder JSON.")).toBeNull();
});

test("tryParseGenericReport: leeg secties → null", () => {
  expect(tryParseGenericReport(JSON.stringify({ secties: [] }))).toBeNull();
});

test("parseGenericOutput: markdown-envelope die eigenlijk kaart-JSON is → upgrade naar report", () => {
  const reportJson = JSON.stringify({
    heroTekst: "H",
    secties: [{ titel: "S", feiten: [{ label: "P", value: "gered" }] }],
  });
  const envelope = JSON.stringify({ kind: "markdown", markdown: reportJson });
  const out = parseGenericOutput(envelope);
  expect(out?.kind).toBe("report");
  if (out?.kind === "report") {
    expect(out.report.secties[0].feiten).toEqual([{ label: "P", waarde: "gered" }]);
  }
});

test("parseGenericOutput: echte prose-markdown blijft markdown", () => {
  const envelope = JSON.stringify({ kind: "markdown", markdown: "# Titel\n\nGewone proza." });
  expect(parseGenericOutput(envelope)?.kind).toBe("markdown");
});

test("parseGenericOutput: geldig report-envelope blijft report", () => {
  const envelope = JSON.stringify({ kind: "report", report: { secties: [{ titel: "S" }] } });
  expect(parseGenericOutput(envelope)?.kind).toBe("report");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run modules/generic/schema.test.ts -t "tryParseGenericReport|upgrade"`
Expected: FAIL — `tryParseGenericReport` bestaat nog niet; de upgrade-test krijgt `markdown` i.p.v. `report`.

- [ ] **Step 3: Implement tryParseGenericReport + de render-upgrade**

In `modules/generic/schema.ts`, vervang de hele functie `parseGenericOutput` (regel 74-92) door de nieuwe helper + de aangepaste functie:

```ts
/**
 * Haal een JSON-object uit tekst en parse als GenericReport. Null als het geen
 * (geldig genoeg) rapport is. Client-veilig: spiegelt de extractie van
 * extractAndParseJson (fences strippen + eerste { t/m laatste }) zonder de
 * AI-SDK te importeren. Gebruikt door de render-upgrade in parseGenericOutput.
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
    // Envelope is geen JSON (legacy/handmatig): probeer alsnog als rapport,
    // anders toon als markdown.
    const upgraded = tryParseGenericReport(raw);
    if (upgraded) {
      return { kind: "report", report: sanitizeGenericReport(upgraded) };
    }
    return { kind: "markdown", markdown: stripDashes(raw) };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run modules/generic/schema.test.ts`
Expected: PASS — alle tests.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck 2>&1 | grep "generic/schema" || echo "schoon"`
Expected: `schoon`.

- [ ] **Step 6: Commit**

```bash
git add modules/generic/schema.ts modules/generic/schema.test.ts
git commit -m "fix(generic): render-upgrade voor markdown-die-eigenlijk-rapport-is" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Volledige verificatie

**Files:** geen wijzigingen — verificatie-taak.

- [ ] **Step 1: Volledige testsuite**

Run: `npm run test`
Expected: alle suites groen, inclusief de uitgebreide `modules/generic/schema.test.ts`.

- [ ] **Step 2: Volledige typecheck**

Run: `npm run typecheck 2>&1 | grep -v "\.next/" || echo "schoon buiten .next"`
Expected: geen fouten buiten de bekende gedupliceerde `.next/... 2.ts`-artefacten.

- [ ] **Step 3: Browser-verificatie van het bestaande markttrends-rapport**

Start de dev-server (preview-tool) en open het bestaande markttrends-rapport
(`/modules/markttrends-rapport/<sessionId>`, inloggen vereist). Verifieer dat het
nu als **kaarten** rendert (gradient-hero + accent-kaarten) i.p.v. een rauwe
JSON-dump. De render-upgrade doet dit zonder opnieuw te draaien.

Dit vereist een ingelogde sessie; als dat hier niet kan, is de deterministische
test `parseGenericOutput: markdown-envelope ... → upgrade naar report` het bewijs
dat het exacte scenario (inclusief `value`-drift) nu als rapport rendert.

---

## Self-review (uitgevoerd bij het schrijven)

- **Spec-dekking:** leniency `feiten`/`chips`/`volgendeStappen`/`eyebrow`/`titel`/`heroTekst` → Task 1; alias-herstel (`value`→`waarde`) → Task 1; `tryParseGenericReport` + render-upgrade → Task 2; testplan → Task 1/2/3. Alle spec-punten gedekt. `secties.min(1)` bewust ongewijzigd (spec: leeg rapport → markdown).
- **Geen placeholders:** elke code-stap bevat volledige code; geen TODO/TBD.
- **Type-consistentie:** `tryParseGenericReport(text: string): GenericReport | null` identiek gedefinieerd (Task 2) en gebruikt in `parseGenericOutput` (Task 2, zelfde bestand, hoisted). `Feit`/`ReportSectie`/`GenericReport` uit Task 1 gebruikt door `tryParseGenericReport` in Task 2. `sanitizeGenericReport` ongewijzigd en compatibel met de genormaliseerde `feiten`-vorm.
- **Groen bij elke commit:** Task 1 laat de bestaande em-dash-test intact (geldige strings blijven ongemoeid bij `.default`→`.catch`). Task 2 bouwt op Task 1's schema.
