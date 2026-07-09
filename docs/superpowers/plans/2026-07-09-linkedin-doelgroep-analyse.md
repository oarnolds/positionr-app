# LinkedIn doelgroep-analyse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een nieuwe module `linkedin-doelgroep` op de generieke runner die een geüploade LinkedIn volgers-export omzet in een doelgroep-/bereik-analyse (doelgroep, volgers-in-doelgroep, potentieel & penetratie).

**Architecture:** Hergebruikt de volledige bestaande keten: upload → `createFileSnapshot` → `xlsxToMarkdown` → markdown-snapshot → generieke runner (`app/(app)/modules/[slug]`) → `GenericReportView`. Nieuw zijn: een module-config met herlabelde velden + een exportstappenplan, een registry-entry, en een Claude-prompt in de DB. Geen nieuwe runner-logica.

**Tech Stack:** Next.js (App Router, server components + server actions), Drizzle + Supabase Postgres, Zod, SheetJS (`xlsx`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-linkedin-doelgroep-analyse-design.md`

**Belangrijk (context voor de uitvoerder):**
- De xlsx→markdown-conversie bestaat al (`lib/scraping/xlsx-to-markdown.ts`, getest) en accepteert `.xls`/`.xlsx`/`.csv`. Mime `application/vnd.ms-excel` staat al in `MIME_TO_KIND` en de Storage-bucket-allow-list. Er is dus GEEN conversie- of upload-werk nodig.
- De file-upload-bron (`sourceTypes: ["file"]`) werkt end-to-end via de bestaande `resolveSourceSnapshotId` in `app/(app)/modules/[slug]/actions.ts`. Geen wijziging nodig daar.
- Supabase-project-id voor DB-stappen: `nirlmczamjrcxciyzkpy` (via de Supabase MCP `execute_sql`). Admin-user-id voor prompt-history: `665edff5-13bd-4edd-919b-1acde593ba91`.

---

## File Structure

| Bestand | Verantwoordelijkheid | Actie |
| --- | --- | --- |
| `modules/generic/schema.ts` | Config-type + `GENERIC_MODULES`-entry voor de module | Modify |
| `modules/generic/schema.test.ts` | Unit-tests op de config | Modify |
| `lib/modules/registry.ts` | UI-catalogus-entry (kaart + route) | Modify |
| `app/(app)/modules/[slug]/page.tsx` | Beschrijving-veld config-driven + `steps` renderen | Modify |
| DB tabel `modules` (Supabase) | Module-rij + Claude-prompt + format_example | Insert (SQL) |

Geen nieuwe bestanden — alles haakt in bestaande, gefocuste bestanden.

---

## Task 1: Config-type + `GENERIC_MODULES`-entry

Voegt de module toe aan de generieke runner met file-only bron, herlabelde velden en een exportstappenplan. Breidt `GenericModuleConfig` uit met `descriptionLabel`, `descriptionPlaceholder` en `steps`.

**Files:**
- Modify: `modules/generic/schema.ts:90-143`
- Test: `modules/generic/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Voeg toe aan `modules/generic/schema.test.ts` (na de bestaande `moduleSourceTypes`-test). `GENERIC_MODULES`, `moduleSourceTypes` en `isGenericModule` worden al bovenaan het testbestand geïmporteerd — geen import-wijziging nodig:

```ts
test("linkedin-doelgroep: file-only bron met herlabelde velden en stappen", () => {
  expect(moduleSourceTypes("linkedin-doelgroep")).toEqual(["file"]);
  const cfg = GENERIC_MODULES["linkedin-doelgroep"];
  expect(cfg.sectorLabel).toMatch(/doelgroep/i);
  expect(cfg.descriptionLabel).toMatch(/potentieel/i);
  expect(Array.isArray(cfg.steps) && cfg.steps.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run modules/generic/schema.test.ts`
Expected: FAIL — `moduleSourceTypes("linkedin-doelgroep")` geeft `["library"]` (default) en `cfg` is `undefined`.

- [ ] **Step 3: Uitbreiden van het config-type**

In `modules/generic/schema.ts`, vervang het einde van de `GenericModuleConfig`-type (het blok met `sectorLabel`/`sectorPlaceholder`, regels ~107-111) door:

```ts
  /** Label van het sector-veld (default "Sector"). */
  sectorLabel?: string;
  /** Placeholder van het sector-veld (default "bijv. IT-dienstverlening"). */
  sectorPlaceholder?: string;
  /** Label van het beschrijving-veld (default "Korte beschrijving van je bedrijf"). */
  descriptionLabel?: string;
  /** Placeholder van het beschrijving-veld (default "Wat doen jullie, voor wie?"). */
  descriptionPlaceholder?: string;
  /** Optioneel genummerd stappenplan bovenaan de modulepagina. */
  steps?: string[];
};
```

- [ ] **Step 4: Module-entry toevoegen aan `GENERIC_MODULES`**

In hetzelfde bestand, voeg binnen het `GENERIC_MODULES`-object toe (na de `linkedin-analyse`-entry, vóór `markttrends-rapport`):

```ts
  // LinkedIn doelgroep-analyse: draait op een geüploade volgers-export
  // (Analytics → Volgers → Exporteren). Doelgroep = sector-veld,
  // Sales Navigator-potentieel = beschrijving-veld.
  "linkedin-doelgroep": {
    sourceTypes: ["file"],
    fileHint:
      "Upload je LinkedIn volgers-export (.xls/.xlsx). Zie de stappen hierboven om die in LinkedIn te maken.",
    sectorLabel: "Doelgroep (branches + functies)",
    sectorPlaceholder:
      "bijv. maak- & procesindustrie in NL; functies inkoop, operations, supply chain",
    descriptionLabel: "LinkedIn-potentieel (optioneel)",
    descriptionPlaceholder:
      "bijv. Sales Navigator: 3.200 mensen in maakindustrie NL, functie inkoop/operations",
    steps: [
      "Ga in LinkedIn naar je bedrijfspagina en klik op Analytics → Volgers.",
      "Klik rechtsboven op Exporteren en kies een periode.",
      "Je krijgt een .xls-bestand met de volgersdemografie. Upload dat hieronder.",
    ],
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run modules/generic/schema.test.ts`
Expected: PASS (alle tests groen).

- [ ] **Step 6: Commit**

```bash
git add modules/generic/schema.ts modules/generic/schema.test.ts
git commit -m "feat(linkedin-doelgroep): module-config met file-bron, herlabelde velden en stappenplan"
```

---

## Task 2: Registry-entry (kaart + route)

Zet de module als actieve kaart op `/modules` met een eigen route. Puur data in de catalogus; geverifieerd via typecheck + build.

**Files:**
- Modify: `lib/modules/registry.ts` (na de `linkedin-analyse`-entry, rond regel 90)

- [ ] **Step 1: Entry toevoegen**

In `lib/modules/registry.ts`, direct ná de volledige `linkedin-analyse`-object-entry in de `MODULES`-array, voeg toe:

```ts
  {
    slug: "linkedin-doelgroep",
    name: "LinkedIn doelgroep-analyse",
    description:
      "Upload je LinkedIn volgers-export en zie hoeveel van je volgers in je doelgroep zitten en hoe groot je potentieel is.",
    icon: Linkedin,
    color: "from-sky-500 to-sky-700",
    borderColor: "border-sky-200",
    bgLight: "bg-sky-50",
    iconColor: "text-sky-700",
    status: "active",
    href: "/modules/linkedin-doelgroep",
    minTier: "fundament",
  },
```

(`Linkedin` is al geïmporteerd bovenaan het bestand — geen import-wijziging nodig.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen fouten.

- [ ] **Step 3: Commit**

```bash
git add lib/modules/registry.ts
git commit -m "feat(linkedin-doelgroep): actieve module-kaart + route in registry"
```

---

## Task 3: Beschrijving-veld config-driven + stappenplan renderen

Laat het beschrijving-veld dezelfde config-aanpak volgen als het sector-veld, en render `steps` als genummerde lijst bovenaan het formulier. Presentatie-passthrough (net als de eerdere `sectorLabel`-wijziging); geverifieerd via typecheck + build.

**Files:**
- Modify: `app/(app)/modules/[slug]/page.tsx:216-227` (beschrijving-veld) en het blok direct ná de module-header (rond regel 117) voor de stappen.

- [ ] **Step 1: Beschrijving-veld config-driven maken**

Vervang het beschrijving-`<label>`-blok (regels ~216-227) door:

```tsx
        <label className="mt-4 block text-sm">
          <span className="font-semibold text-gray-700">
            {moduleConfig?.descriptionLabel ?? "Korte beschrijving van je bedrijf"}{" "}
            <span className="font-normal text-gray-500">(optioneel)</span>
          </span>
          <textarea
            name="description"
            rows={2}
            placeholder={
              moduleConfig?.descriptionPlaceholder ?? "Wat doen jullie, voor wie?"
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </label>
```

- [ ] **Step 2: Stappenplan renderen**

Voeg direct ná de module-header-`</div>` (het blok met titel + beschrijving, sluit rond regel 117) en vóór het `{error && (`-blok toe:

```tsx
      {moduleConfig?.steps && moduleConfig.steps.length > 0 && (
        <ol className="mt-6 space-y-2 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
          {moduleConfig.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
```

(`moduleConfig` is al gedefinieerd op regel 84.)

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: `✓ Compiled successfully`, geen typefouten.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/modules/[slug]/page.tsx"
git commit -m "feat(linkedin-doelgroep): beschrijving-veld config-driven + stappenplan op modulepagina"
```

---

## Task 4: DB — module-rij + Claude-prompt + format_example

Maakt de `modules`-rij aan (verplicht: `sessions.module_slug` heeft een FK naar `modules.slug`) met de analyse-prompt en layout-instructie, en logt de prompt in de history. Uitgevoerd via de Supabase MCP `execute_sql` (project `nirlmczamjrcxciyzkpy`).

**Files:** geen — dit is een DB-operatie.

- [ ] **Step 1: Module-rij invoegen**

Voer via de Supabase MCP `execute_sql` uit (let op: dollar-quoted strings om escaping te vermijden):

```sql
INSERT INTO modules (slug, name, description, status, provider, min_tier, default_prompt, format_example)
VALUES (
  'linkedin-doelgroep',
  'LinkedIn doelgroep-analyse',
  'Analyseert een LinkedIn volgers-export op doelgroep-fit en potentieel.',
  'active',
  'claude',
  'fundament',
  $prompt$Je bent een B2B-marktanalist. Je analyseert de LinkedIn-volgers van een bedrijf op basis van een geüploade LinkedIn-volgers-export (Analytics → Volgers → Exporteren). Onderaan deze prompt (onder "WEBSITE-CONTENT") staan de tabbladen als markdown-tabellen: New followers (dagelijkse groei), Location, Job function, Seniority, Industry en Company size. Alle cijfers zijn geaggregeerde aantallen per dimensie.

BEDRIJF: {companyName}
DOELGROEP (opgegeven door de gebruiker): {sector}
LINKEDIN-POTENTIEEL (optioneel, bijv. een Sales Navigator-aantal): {description}

BELANGRIJKE EIGENSCHAPPEN VAN DE DATA
- De branche- en functielabels zijn Engels (LinkedIn''s eigen taxonomie). Map de opgegeven doelgroep zelf naar de best passende labels die daadwerkelijk in de Industry- en Job function-tabellen voorkomen.
- Industry en Job function zijn APARTE lijsten, geen kruistabel. "Branche X én functie Y" kun je dus niet exact doorsnijden — geef een onderbouwde schatting en benoem die onzekerheid.
- LinkedIn telt per dimensie alleen volgers met een ingevuld attribuut en rondt af; de dimensie-totalen verschillen. Reken met "percentage van de geclassificeerde volgers in die dimensie", niet met één totaal.

TAALREGELS
- Antwoord in het Nederlands op B1-niveau: korte zinnen, gewone woorden.
- Verzin geen getallen. Gebruik alleen aantallen die in de tabellen staan (of het opgegeven potentieel-getal). Geen betrouwbaar getal? Beschrijf het in woorden.

MAAK DEZE ANALYSE
1. Doelgroep — herformuleer de opgegeven doelgroep naar de concrete LinkedIn-branche- en functielabels die in de export voorkomen. Benoem welke labels je meerekent.
2. Volgers in de doelgroep — tel de matchende branches op: hoeveel volgers en welk percentage van de geclassificeerde volgers zit in de doelgroep? Kruischeck met Job function en Seniority: zitten er relevante functies en beslissers (Director/CXO/VP/Owner) tussen? Benoem de schatting-kanttekening.
3. Potentieel & penetratie — is er een potentieel-getal opgegeven? Zet dan de volgers-in-doelgroep af tegen dat potentieel (penetratie = volgers-in-doelgroep gedeeld door potentieel, als percentage) en duid het. Geen getal? Geef dan een kwalitatieve inschatting van het potentieel op basis van de doelgroep, zonder een getal te verzinnen.
4. Extra inzichten — groeitrend (New followers: groeit het, en hoe snel?), geografische fit (Location vs. de doelgroep-geografie), seniority-mix en bedrijfsgrootte (Company size). Kort en concreet.

Sluit af met concrete vervolgstappen om meer van de doelgroep te bereiken.$prompt$,
  $fmt$Bouw het rapport op uit deze secties, in deze volgorde:
- "Doelgroep" (accent blue) — welke LinkedIn-branche/functielabels tellen mee.
- "Volgers in je doelgroep" (accent green) — aantal + percentage + beslissers; gebruik feiten voor de kerncijfers.
- "Potentieel & penetratie" (accent amber) — penetratie of kwalitatieve duiding.
- "Extra inzichten" (accent indigo) — groei, geografie, seniority, bedrijfsgrootte.
Zet de kernconclusie in heroTekst en de acties in volgendeStappen.$fmt$
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  provider = EXCLUDED.provider,
  min_tier = EXCLUDED.min_tier,
  default_prompt = EXCLUDED.default_prompt,
  format_example = EXCLUDED.format_example,
  updated_at = now()
RETURNING slug, status, provider, length(default_prompt) AS prompt_len, length(format_example) AS fmt_len;
```

Expected: één rij terug, `status=active`, `provider=claude`, `prompt_len` > 1500, `fmt_len` > 200.

- [ ] **Step 2: Prompt in de history loggen**

```sql
INSERT INTO module_prompt_history (module_slug, prompt, provider, saved_by)
SELECT slug, default_prompt, provider, '665edff5-13bd-4edd-919b-1acde593ba91'::uuid
FROM modules WHERE slug = 'linkedin-doelgroep'
RETURNING module_slug, length(prompt) AS prompt_len;
```

Expected: één rij, `prompt_len` gelijk aan stap 1.

---

## Task 5: End-to-end-verificatie

Bevestigt dat alles samen werkt: tests, typecheck, build, en een echte conversie van de voorbeeld-export.

**Files:** geen (verificatie).

- [ ] **Step 1: Volledige testsuite**

Run: `pnpm test`
Expected: alle tests groen (bestaande + de nieuwe uit Task 1).

- [ ] **Step 2: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: `✓ Compiled successfully`, route `/modules/linkedin-doelgroep` verschijnt in de build-output.

- [ ] **Step 3: Conversie van de voorbeeld-export controleren**

Bevestig dat de echte Eclectik-export nog steeds correct naar markdown-tabellen converteert (rook­test op de bron van de analyse). Maak tijdelijk `_verify.ts` in de projectroot:

```ts
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { xlsxToMarkdown } from "./lib/scraping/xlsx-to-markdown";
const buf = readFileSync(process.argv[2]);
const md = xlsxToMarkdown(buf);
console.log("sheets als H2:", (md.match(/^## /gm) ?? []).length);
console.log(md.slice(0, 400));
```

Run: `pnpm exec tsx _verify.ts "/Users/olivierarnolds/Downloads/eclectik-insights_followers_1783608589624.xls"; rm -f _verify.ts`
Expected: minstens 6 `## `-koppen (New followers, Location, Job function, Seniority, Industry, Company size) en markdown-tabellen.

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Handmatige eindtest (na deploy, door Olivier)

De app zit achter magic-link-login, dus doorklikken kan niet geautomatiseerd. Na de Vercel-deploy: ga naar `/modules/linkedin-doelgroep`, volg het stappenplan, upload de Eclectik-export, vul als doelgroep bijv. "maak- & procesindustrie in NL; functies inkoop, operations" in en (optioneel) een Sales Navigator-getal, en controleer of het rapport de vier secties toont.

## Bekende beperkingen (bewust, staan in de spec)

- Branche × functie is geen kruistabel → doel 2 is een schatting (prompt benoemt dit).
- Zonder Sales Nav-getal is doel 3 kwalitatief.
- Kleine pagina's geven ruwe, kleine getallen.
