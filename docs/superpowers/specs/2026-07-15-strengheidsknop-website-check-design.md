# Strengheidsknop website-check — ontwerp

- **Datum:** 2026-07-15
- **Module:** website-check
- **Status:** ontwerp goedgekeurd, klaar voor implementatieplan

## Doel

De admin een globale knop geven waarmee de beoordelingsstrengheid van de
website-check op een schaal van 1 (mild) tot 5 (zeer streng) ingesteld wordt.
De knop stuurt het oordeel van de AI bij het genereren, zodat cijfer én
geschreven feedback consistent mee bewegen. Er is bewust **geen** correctie per
los rapport: één dial bepaalt de houding voor alle nieuwe rapporten.

## Achtergrond

De 11 onderdeelscores en de totaalscore komen volledig uit het taalmodel; de
code parset en toont ze alleen (zie `modules/website-check/report/parseReport.ts`,
`service.ts`). De totaalscore wordt sinds 2026-07-15 in code herberekend als het
gemiddelde van de geparste onderdeelscores. Er is nu geen manier om de
scoringshouding te sturen zonder de prompt-tekst met de hand te herschrijven.

## Scope

**Wel:**
- Eén instelling `strictness` (1–5) per module, opgeslagen op de bestaande
  `modules`-rij.
- Automatische injectie van een kalibratie-instructie in de prompt bij het
  genereren, afgeleid van de gekozen 1–5.
- Een 1–5 schuifknop in de admin prompt-editor van website-check.

**Niet (YAGNI):**
- Curatie of bewerking van losse, al gegenereerde rapporten.
- Met terugwerkende kracht herscoren van bestaande rapporten.
- Strengheid per onderdeel.
- Versiegeschiedenis van de strengheidswaarde.
- De knop tonen aan niet-admin-gebruikers.

## Datamodel

Nieuwe kolom op `modules` (`lib/db/schema.ts`):

```ts
strictness: integer("strictness").notNull().default(3),
```

- Bereik 1–5, default **3** = huidig, neutraal gedrag.
- `NOT NULL DEFAULT 3` zorgt dat bestaande module-rijen automatisch op 3 komen —
  geen apart backfill-script nodig.
- Toevoegen via een Drizzle-migratie volgens het bestaande patroon in `drizzle/`.
- De kolom staat generiek op `modules`; alleen website-check leest hem voorlopig.

## Kalibratie (de kern)

Nieuw bestand `lib/modules/strictness.ts` met de mapping en de teksten. Dit is de
enige plek waar de niveaubetekenis leeft (niet in de bewerkbare prompt), zodat de
dial altijd werkt.

```ts
export const MIN_STRICTNESS = 1;
export const MAX_STRICTNESS = 5;
export const DEFAULT_STRICTNESS = 3;
export type StrictnessLevel = 1 | 2 | 3 | 4 | 5;

export const STRICTNESS_LABELS: Record<StrictnessLevel, string> = {
  1: "Mild",
  2: "Iets milder",
  3: "Evenwichtig",
  4: "Streng",
  5: "Zeer streng",
};
```

**Niveau-instructies** (letterlijk te injecteren):

- **1 — Mild:** "Beoordeel welwillend en bemoedigend. Waardeer nadrukkelijk wat er
  goed is en geef de website het voordeel van de twijfel. Geef alleen een cijfer
  onder de 4 als een onderdeel echt ontbreekt. Formuleer verbeterpunten als
  aanmoediging, niet als kritiek."
- **2 — Iets milder:** "Beoordeel mild. Leg de nadruk op wat werkt en benoem
  gebreken zacht en constructief. Wees eerder gul dan streng met de cijfers."
- **3 — Evenwichtig:** "Beoordeel evenwichtig. Benoem sterke en zwakke punten
  eerlijk, zonder te vleien en zonder af te kraken. Een gemiddelde website krijgt
  gemiddelde cijfers."
- **4 — Streng:** "Beoordeel streng. Leg de lat hoog: een cijfer van 8 of hoger
  moet verdiend zijn met concreet, zichtbaar bewijs. Wees kritisch op vage
  beloftes, ontbrekend bewijs en onduidelijke taal. Een gemiddelde website krijgt
  eerder een matig cijfer."
- **5 — Zeer streng:** "Beoordeel zeer streng, als een veeleisende expert. Geef
  een 8 of hoger alleen bij uitmuntende, aantoonbaar bewezen uitvoering. Twijfel
  telt in het nadeel van het cijfer. Benoem elk gemis scherp, maar blijf
  respectvol en zakelijk."

**Gedeelde grens (achter elk niveau geplakt), overrulet de strengheid:**

> "Deze twee regels gelden ongeacht de gekozen strengheid: (1) gerichte vaktaal of
> branchebeeld die de juiste koper aanspreekt en de verkeerde afschrikt is een
> plus, geen minpunt; (2) content die niet geladen kon worden (zoals de
> contactpagina of klantcases) krijgt een voorzichtige score, geen afstraffing —
> strengheid scherpt alleen het oordeel over wat wél zichtbaar is."

**Publieke functies:**

```ts
// Rondt af en klemt buiten [1,5]; robuust tegen rommelige DB-waarden.
export function clampStrictness(value: number): StrictnessLevel;

// Niveau-instructie + gedeelde grens, klaar om te injecteren.
export function strictnessInstruction(value: number): string;

// Kort label voor de UI, bv. "Evenwichtig".
export function strictnessLabel(value: number): string;
```

## Injectie-mechanisme

**`getModulePrompt` (`lib/modules/prompts.ts`)** — retourneert de strengheid mee:

```ts
Promise<{ prompt: string; provider: ConfigProvider; strictness: number }>
```

Voegt `modules.strictness` toe aan de select en geeft de waarde door (default 3
uit de kolom). Backward-compatibel: bestaande aanroepers negeren het extra veld.

**`runAnalysis` (`modules/website-check/service.ts`)** — leest de strengheid en
injecteert het blok in `buildPrompt`, tussen de prompt-header en de
FORMAT-TEMPLATE-footer:

```ts
const { prompt: template, provider, strictness } = await deps.fetchPrompt(MODULE_SLUG);
// ...
function buildPrompt(scrapedContent: string): string {
  const header = substitutePlaceholders(template, { /* ... */ });
  return [
    header,
    "---",
    "BEOORDELINGSSTRENGHEID (bepaalt hoe streng je cijfers toekent):",
    "",
    strictnessInstruction(strictness),
    "---",
    "FORMAT-TEMPLATE (volg deze structuur exact ...):",
    "",
    formatTemplate,
    "---",
    "Schrijf nu de gevulde versie ... Geef alleen de markdown terug ...",
  ].join("\n\n");
}
```

`ServiceDeps.fetchPrompt` is getypeerd als `typeof getModulePrompt`, dus de
uitbreiding werkt automatisch door. De bytes-cap-logica voor Perplexity blijft
ongewijzigd: de strengheid-tekst is klein en telt gewoon mee in `overheadBytes`
omdat die op `buildPrompt("")` gemeten wordt.

## Admin-UI

**`app/(admin)/admin/prompts/[slug]/page.tsx`** — laadt `strictness` mee uit de
`modules`-select en geeft `initialStrictness={row.strictness}` door aan
`EditorPane`.

**`app/(admin)/admin/prompts/[slug]/editor-pane.tsx`** — een 1–5 schuifknop
(`<input type="range" min=1 max=5 step=1>`) met daaronder het actieve label en
één regel uitleg ("3 — Evenwichtig: benoemt sterk en zwak eerlijk."). De knop
slaat onafhankelijk van de prompt-textarea op via een eigen actie, bij het
loslaten van de schuif. Alleen tonen voor modules die scoren; voor de eerste
versie volstaat: altijd tonen, want alleen website-check gebruikt de waarde.

**`app/(admin)/admin/prompts/[slug]/actions.ts`** — nieuwe server-actie, los van
`savePrompt` zodat een strengheid-wijziging géén prompt-history-snapshot maakt:

```ts
const SaveStrictnessSchema = z.object({
  slug: z.string().min(1),
  strictness: z.number().int().min(1).max(5),
});

export async function saveStrictness(input: unknown): Promise<void> {
  await requireAdmin();
  const { slug, strictness } = SaveStrictnessSchema.parse(input);
  await db.update(modules).set({ strictness }).where(eq(modules.slug, slug));
  revalidatePath(`/admin/prompts/${slug}`);
}
```

## Testplan

**`lib/modules/strictness.test.ts` (unit):**
- `clampStrictness`: 3.4 → 3, 0 → 1, 6 → 5, negatief → 1, exacte 1..5 → zichzelf.
- `strictnessInstruction`: bevat de juiste niveau-tekst én de gedeelde grens; bij
  waarde buiten bereik valt hij terug op de geklemde tekst.
- `strictnessLabel`: 1..5 → juiste label; default/rommel → "Evenwichtig".

**`modules/website-check/service.test.ts` (uitbreiding):**
- Mock `fetchPrompt` retourneert `strictness`; assert dat de prompt die aan de
  analyzer wordt doorgegeven het BEOORDELINGSSTRENGHEID-blok met de juiste
  niveau-tekst bevat.
- Regressie: bij default 3 bevat de prompt de "Evenwichtig"-tekst.

Het AI-oordeel zelf wordt niet automatisch getest (niet-deterministisch).

## Geraakte bestanden

| Bestand | Wijziging |
|---|---|
| `lib/db/schema.ts` | kolom `strictness` op `modules` |
| `drizzle/` (nieuw) | migratie voor de kolom |
| `lib/modules/strictness.ts` (nieuw) | mapping + teksten + helpers |
| `lib/modules/strictness.test.ts` (nieuw) | unit-tests |
| `lib/modules/prompts.ts` | `getModulePrompt` retourneert `strictness` |
| `modules/website-check/service.ts` | injectie in `buildPrompt` |
| `modules/website-check/service.test.ts` | test op injectie |
| `app/(admin)/admin/prompts/[slug]/page.tsx` | `strictness` laden + doorgeven |
| `app/(admin)/admin/prompts/[slug]/editor-pane.tsx` | schuifknop + opslaan |
| `app/(admin)/admin/prompts/[slug]/actions.ts` | `saveStrictness`-actie |

## Risico's en open punten

- **Monotonie van de niveaus:** het model produceert niet gegarandeerd duidelijk
  oplopende strengheid tussen naburige standen (vooral 4 vs 5). Mitigatie: de
  teksten zijn bewust onderscheidend geformuleerd. Als het onderscheid in de
  praktijk te vaag is, kan later het hybride model (harde cijferankers per niveau)
  toegevoegd worden zonder het datamodel te wijzigen.
- **Alleen nieuwe rapporten:** de knop raakt bestaande, al gegenereerde rapporten
  niet. Dat is bewust — de dial zet een tendens, niet een correctie.
- **Generieke kolom, specifiek gebruik:** andere modules dragen de kolom maar
  negeren hem. Acceptabel; goedkoper dan een aparte tabel.
