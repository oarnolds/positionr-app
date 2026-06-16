# Format-voorbeeld Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-module statisch format-voorbeeld (markdown) zichtbaar maken via een
"Voorbeeld"-knop in de layout-editor, die een drawer rechts opent.

**Architecture:** Een server-only helper leest `modules/<slug>/format-example.md`.
De page.tsx geeft het resultaat door aan `LayoutEditor`. De editor toont de knop
alleen als er een voorbeeld bestaat en beheert open/close-state van een
`FormatExampleDrawer` (fixed-position, rendert markdown via `MarkdownBlock`).

**Tech Stack:** Next.js 15 (App Router, server-components), React 19, Tailwind,
`marked` (al in repo), `lucide-react` icons, vitest.

**Spec:** [docs/superpowers/specs/2026-06-16-format-example-drawer-design.md](../specs/2026-06-16-format-example-drawer-design.md)

---

## Bestandsplan

**Nieuw:**
- `modules/website-check/format-example.md` — eerste content (uit docx).
- `lib/modules/format-examples.ts` — helper `getFormatExample(slug)`.
- `lib/modules/format-examples.test.ts` — unit-tests voor helper.
- `app/(admin)/admin/layouts/[slug]/format-example-drawer.tsx` — drawer-component.

**Gewijzigd:**
- `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx` — label "Voorbeeld" → "Preview".
- `app/(admin)/admin/layouts/[slug]/page.tsx` — fetch + pass prop.
- `app/(admin)/admin/layouts/[slug]/layout-editor.tsx` — accepteer prop, render knop + drawer.

---

## Task 1: Plaats het format-voorbeeld in de repo

**Files:**
- Create: `modules/website-check/format-example.md`

De inhoud is de markdown-conversie van `FORMAT_Website_analyse_Template.docx`.
Plaatshouders `[KLANTNAAM]`, `[DATUM VANDAAG]`, `[LOGO KLANTNAAM]` blijven
letterlijk in het bestand staan — dit is een referentie-voorbeeld, geen
runtime-template.

- [ ] **Step 1: Bestand aanmaken met onderstaande inhoud**

Maak `modules/website-check/format-example.md` met deze exacte inhoud:

```markdown
[LOGO KLANTNAAM]

**Website Analyse**

**[KLANTNAAM]**

Website: https://klantnaam

Datum: [DATUM VANDAAG]

*Een eerlijke second opinion op uw website — in gewone taal.*

# Inleiding

Dit rapport geeft een eerlijke beoordeling van de website van [KLANTNAAM]. Het is bedoeld als second opinion: een frisse blik naast uw eigen indruk. U hoeft geen verstand van marketing te hebben om het te begrijpen. Wij beoordelen elf onderdelen, geven per onderdeel een score van 1 tot 10, leggen uit waarom het onderdeel telt, en noemen wat u concreet kunt doen.

Belangrijk over de reikwijdte: wij konden alleen de homepage inladen. Onderliggende pagina's, zoals de contactpagina, klantcases en een eventuele blog, konden wij niet bekijken. Waar dat speelt, geven wij dit eerlijk aan en houden wij de score voorzichtig. Wij baseren ons oordeel alleen op wat echt op de site stond. Wij verzinnen geen cijfers, namen of resultaten.

# Samenvatting

# Gemiddelde Totaalscore: 4,9 / 10

De homepage van [KLANTNAAM] maakt in grote lijnen duidelijk wat het bedrijf doet: bedrijfsprocessen digitaliseren met het eigen platform GEM. Sterk zijn de herkenbare voordelen en de uitnodiging om vrijblijvend contact op te nemen. Zwak is het bewijs: er is maar één aanbeveling, weinig zichtbare cijfers en geen uitgewerkte klantverhalen. De grootste kans zit in concreet bewijs en gewone taal: laat met cijfers en klantcases zien wat u oplevert, en schrijf vanuit het probleem van de klant.

## Sterke punten

* Het is duidelijk wát [KLANTNAAM] doet: processen digitaliseren met het platform GEM.
* De voordelen zijn herkenbaar benoemd: maatwerk, overzicht en kostenbesparing.
* Er is een duidelijke, vrijblijvende uitnodiging om contact op te nemen.

## Grootste verbeterpunten

* Voeg concreet bewijs toe: cijfers, klantlogo's en uitgewerkte klantcases.
* Schrijf in gewone taal en begin bij het probleem van de klant, niet bij de techniek.
* Maak een duidelijk stappenplan en zorg dat contactgegevens makkelijk te vinden zijn.

# Scores in één oogopslag

| **Onderdeel** | **Score** |
| --- | --- |
| 1. Waardepropositie | **6,5** |
| 2. Klantvoordelen | **5,5** |
| 3. Diensten / Features | **6,0** |
| 4. Proces | **4,0** |
| 5. Bewijsvoering | **4,0** |
| 6. Klantcases | **3,5** |
| 7. CTA's (actieknoppen) | **6,0** |
| 8. Content | **3,5** |
| 9. Schrijfstijl | **5,5** |
| 10. Actualiteit | **5,0** |
| 11. Contactpagina | **4,0** |
| **Gemiddelde totaalscore** | **4,9** |

# Beoordeling per onderdeel

**1. Waardepropositie 6,5 / 10**

**Wat we zien**

De site opent met "Specialists in digital transformation" en de belofte om bedrijfsprocessen te digitaliseren met het low-code platform GEM (low-code = software bouwen met weinig programmeerwerk). Het is duidelijk dát ze digitaliseren. Ze noemen ook een onderscheid: maatwerk in plaats van standaardsoftware, met koppeling aan pakketten als AFAS en Exact. De kernzin staat wel vol vaktaal, waardoor een leek niet meteen snapt wat hij eraan heeft.

**Waarom dit telt in marketing**

De waardepropositie is de belofte boven aan de pagina. Een bezoeker beslist in enkele seconden of hij blijft of weggaat. Snapt hij niet meteen wat het oplevert, dan haakt hij af.

**Wat je kunt doen**

* Zet de winst voor de klant voorop in gewone taal, bijvoorbeeld: "Wij maken jouw eigen werkwijze digitaal, zodat je minder handwerk hebt."
* Leg vaktermen als "digitale transformatie" en "low-code" kort uit in één zin.
* Maak het onderscheid concreet: waarom is maatwerk via GEM beter dan standaardsoftware voor de bezoeker?

**2. Klantvoordelen 5,5 / 10**

**Wat we zien**

De site noemt drie voordelen: maatwerk, eenvoud en overzicht, en kostenbesparing. Daaronder staat uitleg, zoals "lagere onderhoudskosten" en "productievere werkprocessen". De voordelen zijn herkenbaar, maar er staan geen cijfers bij. Er is dus geen bewijs van hoeveel tijd of geld een klant bespaart.

**Waarom dit telt in marketing**

Voordelen overtuigen pas echt als ze concreet en meetbaar zijn. Een getal maakt een belofte geloofwaardig. Vage beloftes zonder cijfer gelooft bijna niemand.

**Wat je kunt doen**

* Voeg een concreet resultaat toe als dat er is, bijvoorbeeld: "klanten besparen gemiddeld X uur per week".
* Maak per voordeel duidelijk wat het de klant oplevert in zijn eigen werk.
* Gebruik geen cijfer als je het niet hebt; vertel dan in een korte klantzin wat er veranderde.

**3. Diensten / Features 6,0 / 10**

**Wat we zien**

Het is duidelijk dat [KLANTNAAM] bedrijfsprocessen digitaliseert met het eigen platform GEM. Ze noemen dat GEM koppelt met bestaande software (AFAS, Exact) en modulair werkt. Hoe het werken met GEM in de praktijk gaat, blijft op de homepage beperkt. Mogelijk staat daar meer over op een aparte pagina die wij niet konden inladen.

**Waarom dit telt in marketing**

Een bezoeker wil snappen wat hij precies krijgt en hoe het werkt. Hoe duidelijker het aanbod, hoe makkelijker hij ja zegt. Onduidelijkheid zorgt voor twijfel en uitstel.

**Wat je kunt doen**

* Beschrijf in een paar zinnen hoe samenwerken met GEM eruitziet.
* Geef een voorbeeld van een proces dat je kunt digitaliseren, bijvoorbeeld: "het bestelproces van klantorder tot levering".
* Laat met een afbeelding of korte uitleg zien hoe het platform er ongeveer uitziet.

**4. Proces 4,0 / 10**

**Wat we zien**

De site zegt dat [KLANTNAAM] "samen" met de klant processen omzet naar één platform. Een duidelijk stappenplan (stap 1, 2, 3) konden wij niet vinden op de homepage. Het is dus onduidelijk wat een klant kan verwachten van begin tot eind. Mogelijk staat dit op een pagina die wij niet konden inladen.

**Waarom dit telt in marketing**

Mensen kopen makkelijker als ze weten wat er gaat gebeuren. Een helder stappenplan neemt twijfel weg en geeft rust. Zonder duidelijk traject lijkt de stap groot en spannend.

**Wat je kunt doen**

* Zet een eenvoudig stappenplan op de site, bijvoorbeeld: "1. kennismaken, 2. proces in kaart brengen, 3. bouwen, 4. live".
* Vertel per stap wat de klant zelf moet doen en wat [KLANTNAAM] doet.
* Geef aan hoelang een traject ongeveer duurt, als dat te zeggen is.

**5. Bewijsvoering 4,0 / 10**

**Wat we zien**

Op de homepage staat één aanbeveling van een klant: de algemeen directeur van Top Bakers. Logo's van klanten, een rij referenties of meerdere aanbevelingen zagen wij niet. Daardoor is er weinig zichtbaar bewijs dat anderen tevreden zijn.

**Waarom dit telt in marketing**

Bewijs van anderen overtuigt meer dan wat een bedrijf over zichzelf zegt. Mensen vertrouwen op de ervaring van anderen. Eén voorbeeld is een begin, maar meer bewijs maakt sterker.

**Wat je kunt doen**

* Toon logo's van klanten die je mag noemen.
* Voeg meer korte aanbevelingen toe, het liefst met naam en functie.
* Zet een cijfer of telbaar feit erbij als dat kan, bijvoorbeeld: "ruim X bedrijven werken met GEM".

**6. Klantcases 3,5 / 10**

**Wat we zien**

Wij vonden op de homepage geen uitgewerkte klantcases. De aanbeveling van Top Bakers raakt aan een praktijkvoorbeeld, maar beschrijft niet duidelijk de uitdaging, de oplossing en het resultaat. Een aparte pagina met cases of referenties konden wij niet inladen, dus die kunnen wij niet beoordelen. Daarom is deze score voorzichtig.

**Waarom dit telt in marketing**

Een goede klantcase laat zien hoe je een echt probleem oploste. Een herkenbaar verhaal helpt een bezoeker zichzelf erin te zien. Dat overtuigt sterker dan een algemene belofte.

**Wat je kunt doen**

* Maak een paar korte cases met vier delen: klant, probleem, oplossing, resultaat.
* Gebruik echte resultaten als je die hebt; verzin nooit een cijfer.
* Kies klanten uit verschillende branches, zodat meer bezoekers zich herkennen.

**7. CTA's (actieknoppen) 6,0 / 10**

**Wat we zien**

De site nodigt uit om vrijblijvend contact op te nemen: "Contact us with no obligation!". Ook staat er een wervende zin om "vandaag" de stap te zetten. De vervolgstap is dus aanwezig en laagdrempelig. Of de knop op meerdere plekken terugkomt, konden wij niet goed zien.

**Waarom dit telt in marketing**

Een duidelijke vervolgstap is nodig, anders gebeurt er niets. De bezoeker moet weten wat hij nu kan doen. Één heldere knop werkt beter dan veel keuzes.

**Wat je kunt doen**

* Herhaal de actieknop op vaste plekken, bijvoorbeeld boven- en onderaan de pagina.
* Maak duidelijk wat er na de klik gebeurt, bijvoorbeeld: "je krijgt binnen één werkdag antwoord".
* Bied een lage drempel, bijvoorbeeld: "plan een gratis kennismaking".

**8. Content 3,5 / 10**

**Wat we zien**

Op de homepage zagen wij geen blog, nieuws of gratis kennisdocument (whitepaper = een uitgebreid, gratis kennisdocument). Mogelijk staat dit elders op de site, maar dat konden wij niet inladen. Op basis van wat wij zagen, is er weinig kennisdeling zichtbaar. Daarom is deze score voorzichtig.

**Waarom dit telt in marketing**

Nuttige content laat zien dat je verstand van zaken hebt. Het helpt bezoekers en bouwt vertrouwen op vóór het eerste gesprek. Ook helpt het om beter gevonden te worden in zoekmachines.

**Wat je kunt doen**

* Deel korte, praktische artikelen over problemen die je oplost.
* Maak een gratis kennisdocument over het digitaliseren van processen.
* Beantwoord veelgestelde vragen van klanten op een aparte pagina.

**9. Schrijfstijl 5,5 / 10**

**Wat we zien**

De teksten wisselen tussen de klant en zichzelf. Zinnen als "jouw unieke processen" zijn klantgericht, maar er staat ook veel "wij" en nadruk op het eigen platform. De toon is vlot, maar gebruikt veel vaktaal. Voor een leek is niet elke zin meteen duidelijk.

**Waarom dit telt in marketing**

Klanten haken aan bij hun eigen probleem, niet bij jouw techniek. Tekst die begint bij de klant voelt persoonlijker en houdt de aandacht vast. Te veel "wij" en jargon zet mensen op afstand.

**Wat je kunt doen**

* Begin vaker bij het probleem van de klant en pas daarna bij de oplossing.
* Vervang vaktermen door gewone woorden, of leg ze kort uit.
* Spreek de lezer direct aan met "jij" of "u", consequent door de hele site.

**10. Actualiteit 5,0 / 10**

**Wat we zien**

Wij konden niet zien of de content recent is. Er staan geen duidelijke data, jaartallen of nieuwsberichten op de homepage. De aanbeveling en teksten ogen verzorgd, maar of alles nog klopt, is van buitenaf niet te checken. Daarom een voorzichtige, gemiddelde score.

**Waarom dit telt in marketing**

Een site die actueel oogt, wekt vertrouwen. Oude data of verouderde voorbeelden geven het gevoel dat een bedrijf stilstaat. Vers ogende content laat zien dat je actief bent.

**Wat je kunt doen**

* Zet een datum of jaartal bij nieuws en voorbeelden.
* Ververs aanbevelingen en voorbeelden af en toe.
* Controleer of de koppelingen met software (zoals AFAS, Exact) nog kloppen.

**11. Contactpagina 4,0 / 10**

**Wat we zien**

De homepage nodigt uit tot contact, maar wij konden de aparte contactpagina niet inladen. Daardoor weten wij niet of er een telefoonnummer, e-mailadres, adres of formulier op staat. Op de homepage zelf zagen wij geen directe contactgegevens. Deze score is daarom voorzichtig.

**Waarom dit telt in marketing**

Wie wil reageren, moet dat meteen en makkelijk kunnen. Hoe minder moeite, hoe meer mensen contact opnemen. Ontbrekende of verstopte gegevens kosten je gesprekken.

**Wat je kunt doen**

* Zet de belangrijkste contactgegevens ook op de homepage, bijvoorbeeld telefoon en e-mail.
* Maak een kort contactformulier met weinig velden.
* Vertel wanneer iemand antwoord kan verwachten.

# De vijf belangrijkste acties

Hieronder staan vijf acties, gesorteerd op belang. Bovenaan staat wat het meeste oplevert.

| **Actie** | **Impact** | **Waarom dit helpt** |
| --- | --- | --- |
| **Voeg uitgewerkte klantcases toe** | **hoog** | Een verhaal met klant, probleem, oplossing en resultaat overtuigt sterker dan een belofte. Bijvoorbeeld: laat zien hoe je het bestelproces van een klant sneller maakte. |
| **Zet de belofte boven aan de pagina in gewone taal** | **hoog** | De bezoeker beslist in seconden of hij blijft. Bijvoorbeeld: "Wij maken jouw eigen werkwijze digitaal, zodat je minder handwerk hebt." |
| **Maak voordelen concreet met cijfers** | **hoog** | Een getal maakt een belofte geloofwaardig. Gebruik alleen echte cijfers, bijvoorbeeld bespaarde uren of lagere kosten. |
| **Toon meer bewijs: logo's en aanbevelingen** | **middel** | Bewijs van anderen overtuigt meer dan wat je over jezelf zegt. Meer dan één aanbeveling maakt het sterker. |
| **Maak contact en stappenplan makkelijk vindbaar** | **middel** | Mensen haken af als ze niet weten wat er gebeurt of hoe ze moeten reageren. Zet contactgegevens en een simpel stappenplan duidelijk neer. |

# Tot slot

Dit rapport is bedoeld om u snel grip te geven op uw website. U bepaalt zelf welke punten u oppakt. Begin bij de acties met impact "hoog": die helpen het meest om van een bezoeker een klant te maken. Wilt u dat een aantal pagina's die wij nu niet konden inladen (contact, cases, blog) alsnog wordt beoordeeld, dan kan dat in een vervolgronde.

Met vriendelijke groet,
```

- [ ] **Step 2: Commit**

```bash
git add modules/website-check/format-example.md
git commit -m "feat(modules): format-voorbeeld voor website-check (uit docx)"
```

---

## Task 2: Helper `getFormatExample` + unit-tests

**Files:**
- Create: `lib/modules/format-examples.ts`
- Create: `lib/modules/format-examples.test.ts`

Server-only helper die `modules/<slug>/format-example.md` leest, met slug-validatie
tegen path-traversal.

- [ ] **Step 1: Schrijf de failing tests**

Maak `lib/modules/format-examples.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getFormatExample } from "./format-examples";

describe("getFormatExample", () => {
  it("returnt de markdown voor een module met een format-example.md", async () => {
    const md = await getFormatExample("website-check");
    expect(md).not.toBeNull();
    expect(md).toContain("Website Analyse");
  });

  it("returnt null als het bestand ontbreekt", async () => {
    const md = await getFormatExample("zzz-niet-bestaande-module");
    expect(md).toBeNull();
  });

  it("returnt null voor slugs die niet aan [a-z0-9-]+ voldoen", async () => {
    expect(await getFormatExample("../etc/passwd")).toBeNull();
    expect(await getFormatExample("UPPERCASE")).toBeNull();
    expect(await getFormatExample("met spatie")).toBeNull();
    expect(await getFormatExample("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run de tests om falen te bevestigen**

```
pnpm vitest run lib/modules/format-examples.test.ts
```

Expected: FAIL — module bestaat nog niet.

- [ ] **Step 3: Implementeer de helper**

Maak `lib/modules/format-examples.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Leest het statische format-voorbeeld voor een module
 * (`modules/<slug>/format-example.md`). Returnt null als de slug niet
 * matcht aan de toegestane vorm of het bestand ontbreekt.
 *
 * Server-only — gebruikt fs.
 */
export async function getFormatExample(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) return null;
  const path = join(process.cwd(), "modules", slug, "format-example.md");
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests om groen te bevestigen**

```
pnpm vitest run lib/modules/format-examples.test.ts
```

Expected: PASS — alle 3 tests groen.

- [ ] **Step 5: Run de volledige test-suite**

```
pnpm vitest run
```

Expected: PASS — alle bestaande tests blijven groen (86 → 89).

- [ ] **Step 6: Commit**

```bash
git add lib/modules/format-examples.ts lib/modules/format-examples.test.ts
git commit -m "feat(modules): getFormatExample helper met slug-validatie"
```

---

## Task 3: Hernoem modus-toggle label "Voorbeeld" → "Preview"

**Files:**
- Modify: `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx`

De `EditorMode` string-literal blijft `"edit" | "preview"` (geen breaking change
in state of consumers). Alleen het zichtbare label "Voorbeeld" wordt "Preview"
om naming-conflict te voorkomen met de nieuwe "Voorbeeld"-knop.

- [ ] **Step 1: Pas het label aan**

In `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx`, vervang:

```tsx
        <Eye size={14} /> Voorbeeld
```

door:

```tsx
        <Eye size={14} /> Preview
```

Geen andere wijzigingen.

- [ ] **Step 2: Typecheck en tests**

```
pnpm tsc --noEmit
pnpm vitest run
```

Expected: PASS — geen consumers van het label-tekst.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/mode-toggle.tsx
git commit -m "refactor(layout): modus-label Voorbeeld → Preview"
```

---

## Task 4: `FormatExampleDrawer`-component

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/format-example-drawer.tsx`

Een fixed-position drawer rechts, ~50vw breed (clamp 480–720px), met sticky
header, scrollable body, sluit via X-knop, Escape-toets, en klik op overlay.

- [ ] **Step 1: Component aanmaken**

Maak `app/(admin)/admin/layouts/[slug]/format-example-drawer.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

export function FormatExampleDrawer({
  open,
  onClose,
  title,
  markdown,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  markdown: string;
}) {
  // Esc-sluit-toets (alleen actief als drawer open is).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay (klik sluit) */}
      <div
        className="flex-1 bg-slate-900/20"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={title}
        className="flex h-full w-[50vw] min-w-[480px] max-w-[720px] flex-col border-l border-slate-200 bg-white shadow-lg"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Sluiten"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <MarkdownBlock markdown={markdown} />
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Volledige test-suite**

```
pnpm vitest run
```

Expected: PASS — geen consumers, dus geen breaking change.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/format-example-drawer.tsx
git commit -m "feat(layout): FormatExampleDrawer-component (fixed, esc/overlay-close)"
```

---

## Task 5: Wire de prop door `page.tsx` → `LayoutEditor` → knop + drawer

**Files:**
- Modify: `app/(admin)/admin/layouts/[slug]/page.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`

Server-fetch in page.tsx, doorgegeven aan client-component `LayoutEditor` die de
knop conditioneel rendert en de drawer-state beheert.

- [ ] **Step 1: page.tsx — laad het format-voorbeeld parallel**

Bewerk `app/(admin)/admin/layouts/[slug]/page.tsx`:

Voeg toe aan de imports:

```tsx
import { getFormatExample } from "@/lib/modules/format-examples";
```

Wijzig de `Promise.all` om ook het format-voorbeeld op te halen:

```tsx
  const [layout, history, previewData, formatExample] = await Promise.all([
    getModuleLayout(slug),
    getModuleLayoutHistory(slug),
    getPreviewData(slug),
    getFormatExample(slug),
  ]);
```

Geef de extra prop door aan `LayoutEditor`:

```tsx
        <LayoutEditor
          slug={slug}
          initialLayout={layout}
          history={history}
          previewData={previewData}
          formatExample={formatExample}
        />
```

- [ ] **Step 2: layout-editor.tsx — prop, state, knop, drawer**

Bewerk `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`:

Voeg toe aan de lucide-imports (regel 5):

```tsx
import { Save, RotateCcw, Loader2, BookOpen } from "lucide-react";
```

Voeg toe aan de imports onderaan het import-blok:

```tsx
import { FormatExampleDrawer } from "./format-example-drawer";
```

Wijzig de props van `LayoutEditor` om `formatExample` te accepteren:

```tsx
export function LayoutEditor({
  slug,
  initialLayout,
  history,
  previewData,
  formatExample,
}: {
  slug: string;
  initialLayout: LayoutConfig;
  history: LayoutHistoryEntry[];
  previewData: WebsiteCheckOutput;
  formatExample: string | null;
}) {
```

Voeg de drawer-state toe direct ná `const [mode, setMode] = ...`:

```tsx
  const [drawerOpen, setDrawerOpen] = useState(false);
```

Voeg de Voorbeeld-knop toe in de toolbar, tussen de Reset-knop en de
`ModeToggle`. Voeg dit blok in vlak vóór `<ModeToggle mode={mode} onChange={setMode} />`:

```tsx
          {formatExample !== null && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <BookOpen size={16} /> Voorbeeld
            </button>
          )}
```

Voeg de drawer toe als laatste kind binnen de root `<div className="mx-auto max-w-5xl space-y-6">`, ná de `<VersionHistory ... />`-aanroep:

```tsx
      {formatExample !== null && (
        <FormatExampleDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Voorbeeld — ${slug}`}
          markdown={formatExample}
        />
      )}
```

- [ ] **Step 3: Typecheck**

```
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Volledige test-suite**

```
pnpm vitest run
```

Expected: PASS — alle bestaande tests + de 3 nieuwe `format-examples.test.ts`
tests blijven groen (89 totaal).

- [ ] **Step 5: Smoke-test in browser**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`
Expected:
- Toolbar toont links→rechts: Opslaan · Reset · **Voorbeeld** · [Bewerken | Preview].
- De modus-toggle heeft nu "Preview" als rechter-knop (in plaats van "Voorbeeld").
- Klik op "Voorbeeld" → drawer schuift in vanaf rechts met de markdown-render.
- Header van drawer toont "Voorbeeld — website-check" + X-knop.
- Klik op X → drawer sluit.
- Klik op de donkere overlay links van de drawer → sluit.
- Druk op Escape → sluit.
- Bewerk-functionaliteit (drag, edit-titel, opslaan) blijft werken zoals voorheen.

- [ ] **Step 6: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/page.tsx \
        app/\(admin\)/admin/layouts/\[slug\]/layout-editor.tsx
git commit -m "feat(layout): Voorbeeld-knop + drawer in layout-editor"
```
