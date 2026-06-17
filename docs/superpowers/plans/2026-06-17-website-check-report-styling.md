# Pro-rapport-styling voor Website Check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg presentatie-laag toe op de markdown-output van website-check
zodat het op het scherm als een afgewerkt rapport oogt (cover-banner,
gestileerde tabellen, sterke/verbeterpunten cards, accent-koppen).

**Architecture:** Pure parser `parseReport(markdown)` splitst de raw
markdown in cover / score / sterke punten / verbeterpunten / body. Een
nieuwe React-component-boom (`WebsiteCheckReport`) stelt sub-componenten
samen — patroon-detectie faalt gracefully (mislukte detectie → blok wordt
weggelaten, body rendert door).

**Tech Stack:** Next.js 15 / React 19, `marked` voor body-render, Tailwind
typography-plugin (`prose-*` modifiers), vitest voor parser-tests.

**Spec:** [docs/superpowers/specs/2026-06-17-website-check-report-styling-design.md](../specs/2026-06-17-website-check-report-styling-design.md)

**Spec correctie:** De spec schreef `prose-h1:hidden`. Het format-example
gebruikt H1 voor échte sectie-breaks (Inleiding, Samenvatting, etc.).
Daarom in dit plan: H1 blijft zichtbaar in de body, met paars-onderbalk
styling. De cover-banner gebruikt geen H1 — alleen bold-text. H2 wordt
alleen gebruikt voor "Sterke punten" / "Grootste verbeterpunten" (en
wordt door de parser uit de body gestript).

**Heading-hierarchie:**
- H1 = sectie-break (visible in body, paarse onderbalk)
- H2 = strengths / improvements (door parser uit body gestript)
- H3 = onderdeel-header met score (visible, slate-700 semibold)
- H4 = sub-sub-header (Wat we zien etc.) (visible, small-caps)

---

## Bestandsplan

**Nieuw:**
- `modules/website-check/format-example.md` — heropgevoerd, nieuwe heading-hierarchie.
- `modules/website-check/report/parseReport.ts` — pure parser.
- `modules/website-check/report/parseReport.test.ts` — 8 unit-tests.
- `modules/website-check/report/CoverBanner.tsx` — cover-content + ScoreCard.
- `modules/website-check/report/ScoreCard.tsx` — paarse pill.
- `modules/website-check/report/StrengthsImprovements.tsx` — 2 cards.
- `modules/website-check/report/ReportBody.tsx` — body markdown wrapper.
- `modules/website-check/report/ReportShell.tsx` — A4-card chrome + footer.
- `modules/website-check/report/WebsiteCheckReport.tsx` — assembly.

**Gewijzigd:**
- `lib/modules/MarkdownBlock.tsx` — optionele `variant`-prop toegevoegd.
- `modules/website-check/components/WebsiteCheckResultView.tsx` — delegate naar `WebsiteCheckReport`.

---

## Task 1: `parseReport`-functie + tests (TDD)

**Files:**
- Create: `modules/website-check/report/parseReport.ts`
- Create: `modules/website-check/report/parseReport.test.ts`

Pure functie zonder dependencies. TDD met 8 cases.

- [ ] **Step 1: Schrijf tests eerst**

Maak `modules/website-check/report/parseReport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseReport } from "./parseReport";

describe("parseReport", () => {
  it("vult alle blokken bij volledige input", () => {
    const md = [
      "[LOGO KLANTNAAM]",
      "",
      "**Website Analyse**",
      "**Acme**",
      "Totaalscore: 7,4 / 10",
      "",
      "# Inleiding",
      "",
      "Eerste tekst.",
      "",
      "# Samenvatting",
      "",
      "Tekst.",
      "",
      "## Sterke punten",
      "",
      "* punt a",
      "* punt b",
      "",
      "## Grootste verbeterpunten",
      "",
      "* verbeter c",
      "* verbeter d",
      "",
      "# Vervolg",
      "",
      "Slot.",
    ].join("\n");

    const r = parseReport(md);
    expect(r.cover?.score).toBe("7,4");
    expect(r.cover?.raw).toContain("Acme");
    expect(r.cover?.raw).not.toContain("Inleiding");
    expect(r.strengths).toEqual(["punt a", "punt b"]);
    expect(r.improvements).toEqual(["verbeter c", "verbeter d"]);
    expect(r.bodyMarkdown).toContain("# Inleiding");
    expect(r.bodyMarkdown).toContain("# Vervolg");
    expect(r.bodyMarkdown).not.toContain("Sterke punten");
    expect(r.bodyMarkdown).not.toContain("Grootste verbeterpunten");
    expect(r.bodyMarkdown).not.toContain("punt a");
  });

  it("retourneert cover=null als input met heading begint", () => {
    const md = "# Direct\n\nTekst.";
    const r = parseReport(md);
    expect(r.cover).toBeNull();
    expect(r.bodyMarkdown).toContain("# Direct");
  });

  it("retourneert score=null als geen score in cover staat", () => {
    const md = "Cover-tekst zonder cijfer.\n\n# Body\n\nTekst.";
    const r = parseReport(md);
    expect(r.cover?.score).toBeNull();
    expect(r.cover?.raw).toContain("Cover-tekst zonder cijfer");
  });

  it("zet beide naar null als alleen strengths gevonden", () => {
    const md = [
      "Cover.",
      "",
      "# Samenvatting",
      "",
      "## Sterke punten",
      "",
      "* alleen sterke",
    ].join("\n");
    const r = parseReport(md);
    expect(r.strengths).toBeNull();
    expect(r.improvements).toBeNull();
    expect(r.bodyMarkdown).toContain("Sterke punten");
  });

  it("zet beide naar null als alleen improvements gevonden", () => {
    const md = [
      "Cover.",
      "",
      "# Samenvatting",
      "",
      "## Grootste verbeterpunten",
      "",
      "* alleen verbeter",
    ].join("\n");
    const r = parseReport(md);
    expect(r.strengths).toBeNull();
    expect(r.improvements).toBeNull();
  });

  it("accepteert score met punt (7.4) en komma (7,4)", () => {
    const a = parseReport("Score: 7.4 / 10\n\n# Body");
    const b = parseReport("Score: 7,4 / 10\n\n# Body");
    expect(a.cover?.score).toBe("7.4");
    expect(b.cover?.score).toBe("7,4");
  });

  it("accepteert `Grootste verbeterpunten` én `Verbeterpunten`", () => {
    const a = [
      "Cover.", "",
      "# S", "",
      "## Sterke punten", "",
      "* x", "",
      "## Verbeterpunten", "",
      "* y",
    ].join("\n");
    const r = parseReport(a);
    expect(r.strengths).toEqual(["x"]);
    expect(r.improvements).toEqual(["y"]);
  });

  it("lege input → alles null en body=''", () => {
    const r = parseReport("");
    expect(r.cover).toBeNull();
    expect(r.strengths).toBeNull();
    expect(r.improvements).toBeNull();
    expect(r.bodyMarkdown).toBe("");
  });
});
```

- [ ] **Step 2: Run tests om falen te bevestigen**

```
pnpm vitest run modules/website-check/report/parseReport.test.ts
```

Expected: FAIL — module bestaat nog niet.

- [ ] **Step 3: Implementeer de parser**

Maak `modules/website-check/report/parseReport.ts`:

```ts
export type ReportBlocks = {
  cover: {
    raw: string;
    score: string | null;
  } | null;
  strengths: string[] | null;
  improvements: string[] | null;
  bodyMarkdown: string;
};

const SCORE_RE = /(\d+[,.]\d+)\s*\/\s*10/;
const STRENGTHS_RE = /^##\s+Sterke punten\s*$/i;
const IMPROVEMENTS_RE = /^##\s+(?:Grootste\s+)?[Vv]erbeterpunten\s*$/;

function extractList(lines: string[], startIdx: number): { items: string[]; endIdx: number } {
  const items: string[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    const bullet = line.match(/^[*-]\s+(.*)$/);
    if (bullet) {
      items.push(bullet[1]);
      i++;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) break;
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Niet-blanke niet-bullet niet-heading → einde van de lijst
    break;
  }
  return { items, endIdx: i };
}

export function parseReport(markdown: string): ReportBlocks {
  if (!markdown) {
    return { cover: null, strengths: null, improvements: null, bodyMarkdown: "" };
  }
  const lines = markdown.split("\n");
  const firstH1 = lines.findIndex((l) => /^#\s+/.test(l));

  // Cover = alles vóór de eerste H1
  let cover: ReportBlocks["cover"] = null;
  let bodyStart = 0;
  if (firstH1 === -1) {
    // Geen H1 → behandel hele input als cover
    const coverRaw = markdown.trim();
    if (coverRaw) {
      const scoreMatch = coverRaw.match(SCORE_RE);
      cover = { raw: coverRaw, score: scoreMatch?.[1] ?? null };
    }
    return {
      cover,
      strengths: null,
      improvements: null,
      bodyMarkdown: "",
    };
  }
  if (firstH1 > 0) {
    const coverRaw = lines.slice(0, firstH1).join("\n").trim();
    if (coverRaw) {
      const scoreMatch = coverRaw.match(SCORE_RE);
      cover = { raw: coverRaw, score: scoreMatch?.[1] ?? null };
    }
    bodyStart = firstH1;
  }

  const bodyLines = lines.slice(bodyStart);

  // Zoek strengths én improvements H2-blokken
  let strengths: string[] | null = null;
  let improvements: string[] | null = null;
  const stripIndices = new Set<number>();

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    if (STRENGTHS_RE.test(line)) {
      const { items, endIdx } = extractList(bodyLines, i + 1);
      if (items.length > 0) {
        strengths = items;
        for (let j = i; j < endIdx; j++) stripIndices.add(j);
      }
    } else if (IMPROVEMENTS_RE.test(line)) {
      const { items, endIdx } = extractList(bodyLines, i + 1);
      if (items.length > 0) {
        improvements = items;
        for (let j = i; j < endIdx; j++) stripIndices.add(j);
      }
    }
  }

  // Beide moeten gevonden zijn — anders niet stripen
  if (!(strengths && improvements)) {
    return {
      cover,
      strengths: null,
      improvements: null,
      bodyMarkdown: bodyLines.join("\n"),
    };
  }

  const remaining = bodyLines.filter((_, idx) => !stripIndices.has(idx));
  // Eventuele dubbele blanke regels die door het strippen ontstaan inkorten
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const ln of remaining) {
    const blank = ln.trim() === "";
    if (blank && prevBlank) continue;
    collapsed.push(ln);
    prevBlank = blank;
  }

  return {
    cover,
    strengths,
    improvements,
    bodyMarkdown: collapsed.join("\n").trim(),
  };
}
```

- [ ] **Step 4: Run tests groen**

```
pnpm vitest run modules/website-check/report/parseReport.test.ts
```

Expected: PASS — alle 8 cases groen.

- [ ] **Step 5: Volledige suite**

```
pnpm vitest run
```

Expected: PASS — totaal 81 tests (was 73 + 8 nieuwe).

- [ ] **Step 6: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  modules/website-check/report/parseReport.ts \
  modules/website-check/report/parseReport.test.ts
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(report): parseReport-functie + 8 unit-tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Format-example heropgevoerd met nieuwe heading-hierarchie + re-seed

**Files:**
- Create: `modules/website-check/format-example.md`

Het oude `format-example.md`-bestand is verwijderd in een eerdere cleanup
(commit `cdb0a6a`). We voegen het opnieuw toe, maar nu met:
- H1 voor sectie-breaks (was al)
- H2 alleen voor "Sterke punten" / "Grootste verbeterpunten" (was al)
- H3 voor "1. Waardepropositie — 6,5 / 10" (was `**bold**`)
- H4 voor "Wat we zien" / "Waarom dit telt" / "Wat je kunt doen" (was `**bold**`)
- Cover bevat een `Totaalscore: 4,9 / 10` regel (was niet aanwezig)

Daarna wordt de DB-rij gereseed via het bestaande seed-script.

- [ ] **Step 1: Pak de oude content uit git-history**

```
git -C /Users/olivierarnolds/Desktop/positionr-app show a5b85ad:modules/website-check/format-example.md > /tmp/format-example-old.md
```

(commit `a5b85ad` is het origineel; de file is in `cdb0a6a` verwijderd.)

- [ ] **Step 2: Schrijf de nieuwe file met aangepaste structuur**

Maak `modules/website-check/format-example.md` met deze inhoud (gebaseerd
op de oude maar met heading-promotie):

```markdown
[LOGO KLANTNAAM]

**Website Analyse**

**[KLANTNAAM]**

Website: https://klantnaam

Datum: [DATUM VANDAAG]

Totaalscore: 4,9 / 10

*Een eerlijke second opinion op uw website — in gewone taal.*

# Inleiding

Dit rapport geeft een eerlijke beoordeling van de website van [KLANTNAAM]. Het is bedoeld als second opinion: een frisse blik naast uw eigen indruk. U hoeft geen verstand van marketing te hebben om het te begrijpen. Wij beoordelen elf onderdelen, geven per onderdeel een score van 1 tot 10, leggen uit waarom het onderdeel telt, en noemen wat u concreet kunt doen.

Belangrijk over de reikwijdte: wij konden alleen de homepage inladen. Onderliggende pagina's, zoals de contactpagina, klantcases en een eventuele blog, konden wij niet bekijken. Waar dat speelt, geven wij dit eerlijk aan en houden wij de score voorzichtig. Wij baseren ons oordeel alleen op wat echt op de site stond. Wij verzinnen geen cijfers, namen of resultaten.

# Samenvatting

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

| Onderdeel | Score |
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

### 1. Waardepropositie — 6,5 / 10

#### Wat we zien

De site opent met "Specialists in digital transformation" en de belofte om bedrijfsprocessen te digitaliseren met het low-code platform GEM (low-code = software bouwen met weinig programmeerwerk). Het is duidelijk dát ze digitaliseren. Ze noemen ook een onderscheid: maatwerk in plaats van standaardsoftware, met koppeling aan pakketten als AFAS en Exact. De kernzin staat wel vol vaktaal, waardoor een leek niet meteen snapt wat hij eraan heeft.

#### Waarom dit telt

De waardepropositie is de belofte boven aan de pagina. Een bezoeker beslist in enkele seconden of hij blijft of weggaat. Snapt hij niet meteen wat het oplevert, dan haakt hij af.

#### Wat je kunt doen

* Zet de winst voor de klant voorop in gewone taal, bijvoorbeeld: "Wij maken jouw eigen werkwijze digitaal, zodat je minder handwerk hebt."
* Leg vaktermen als "digitale transformatie" en "low-code" kort uit in één zin.
* Maak het onderscheid concreet: waarom is maatwerk via GEM beter dan standaardsoftware voor de bezoeker?

### 2. Klantvoordelen — 5,5 / 10

#### Wat we zien

De site noemt drie voordelen: maatwerk, eenvoud en overzicht, en kostenbesparing. Daaronder staat uitleg, zoals "lagere onderhoudskosten" en "productievere werkprocessen". De voordelen zijn herkenbaar, maar er staan geen cijfers bij. Er is dus geen bewijs van hoeveel tijd of geld een klant bespaart.

#### Waarom dit telt

Voordelen overtuigen pas echt als ze concreet en meetbaar zijn. Een getal maakt een belofte geloofwaardig. Vage beloftes zonder cijfer gelooft bijna niemand.

#### Wat je kunt doen

* Voeg een concreet resultaat toe als dat er is, bijvoorbeeld: "klanten besparen gemiddeld X uur per week".
* Maak per voordeel duidelijk wat het de klant oplevert in zijn eigen werk.
* Gebruik geen cijfer als je het niet hebt; vertel dan in een korte klantzin wat er veranderde.

### 3. Diensten / Features — 6,0 / 10

#### Wat we zien

Het is duidelijk dat [KLANTNAAM] bedrijfsprocessen digitaliseert met het eigen platform GEM. Ze noemen dat GEM koppelt met bestaande software (AFAS, Exact) en modulair werkt. Hoe het werken met GEM in de praktijk gaat, blijft op de homepage beperkt. Mogelijk staat daar meer over op een aparte pagina die wij niet konden inladen.

#### Waarom dit telt

Een bezoeker wil snappen wat hij precies krijgt en hoe het werkt. Hoe duidelijker het aanbod, hoe makkelijker hij ja zegt. Onduidelijkheid zorgt voor twijfel en uitstel.

#### Wat je kunt doen

* Beschrijf in een paar zinnen hoe samenwerken met GEM eruitziet.
* Geef een voorbeeld van een proces dat je kunt digitaliseren, bijvoorbeeld: "het bestelproces van klantorder tot levering".
* Laat met een afbeelding of korte uitleg zien hoe het platform er ongeveer uitziet.

### 4. Proces — 4,0 / 10

#### Wat we zien

De site zegt dat [KLANTNAAM] "samen" met de klant processen omzet naar één platform. Een duidelijk stappenplan (stap 1, 2, 3) konden wij niet vinden op de homepage. Het is dus onduidelijk wat een klant kan verwachten van begin tot eind. Mogelijk staat dit op een pagina die wij niet konden inladen.

#### Waarom dit telt

Mensen kopen makkelijker als ze weten wat er gaat gebeuren. Een helder stappenplan neemt twijfel weg en geeft rust. Zonder duidelijk traject lijkt de stap groot en spannend.

#### Wat je kunt doen

* Zet een eenvoudig stappenplan op de site, bijvoorbeeld: "1. kennismaken, 2. proces in kaart brengen, 3. bouwen, 4. live".
* Vertel per stap wat de klant zelf moet doen en wat [KLANTNAAM] doet.
* Geef aan hoelang een traject ongeveer duurt, als dat te zeggen is.

### 5. Bewijsvoering — 4,0 / 10

#### Wat we zien

Op de homepage staat één aanbeveling van een klant: de algemeen directeur van Top Bakers. Logo's van klanten, een rij referenties of meerdere aanbevelingen zagen wij niet. Daardoor is er weinig zichtbaar bewijs dat anderen tevreden zijn.

#### Waarom dit telt

Bewijs van anderen overtuigt meer dan wat een bedrijf over zichzelf zegt. Mensen vertrouwen op de ervaring van anderen. Eén voorbeeld is een begin, maar meer bewijs maakt sterker.

#### Wat je kunt doen

* Toon logo's van klanten die je mag noemen.
* Voeg meer korte aanbevelingen toe, het liefst met naam en functie.
* Zet een cijfer of telbaar feit erbij als dat kan, bijvoorbeeld: "ruim X bedrijven werken met GEM".

### 6. Klantcases — 3,5 / 10

#### Wat we zien

Wij vonden op de homepage geen uitgewerkte klantcases. De aanbeveling van Top Bakers raakt aan een praktijkvoorbeeld, maar beschrijft niet duidelijk de uitdaging, de oplossing en het resultaat. Een aparte pagina met cases of referenties konden wij niet inladen, dus die kunnen wij niet beoordelen. Daarom is deze score voorzichtig.

#### Waarom dit telt

Een goede klantcase laat zien hoe je een echt probleem oploste. Een herkenbaar verhaal helpt een bezoeker zichzelf erin te zien. Dat overtuigt sterker dan een algemene belofte.

#### Wat je kunt doen

* Maak een paar korte cases met vier delen: klant, probleem, oplossing, resultaat.
* Gebruik echte resultaten als je die hebt; verzin nooit een cijfer.
* Kies klanten uit verschillende branches, zodat meer bezoekers zich herkennen.

### 7. CTA's (actieknoppen) — 6,0 / 10

#### Wat we zien

De site nodigt uit om vrijblijvend contact op te nemen: "Contact us with no obligation!". Ook staat er een wervende zin om "vandaag" de stap te zetten. De vervolgstap is dus aanwezig en laagdrempelig. Of de knop op meerdere plekken terugkomt, konden wij niet goed zien.

#### Waarom dit telt

Een duidelijke vervolgstap is nodig, anders gebeurt er niets. De bezoeker moet weten wat hij nu kan doen. Één heldere knop werkt beter dan veel keuzes.

#### Wat je kunt doen

* Herhaal de actieknop op vaste plekken, bijvoorbeeld boven- en onderaan de pagina.
* Maak duidelijk wat er na de klik gebeurt, bijvoorbeeld: "je krijgt binnen één werkdag antwoord".
* Bied een lage drempel, bijvoorbeeld: "plan een gratis kennismaking".

### 8. Content — 3,5 / 10

#### Wat we zien

Op de homepage zagen wij geen blog, nieuws of gratis kennisdocument (whitepaper = een uitgebreid, gratis kennisdocument). Mogelijk staat dit elders op de site, maar dat konden wij niet inladen. Op basis van wat wij zagen, is er weinig kennisdeling zichtbaar. Daarom is deze score voorzichtig.

#### Waarom dit telt

Nuttige content laat zien dat je verstand van zaken hebt. Het helpt bezoekers en bouwt vertrouwen op vóór het eerste gesprek. Ook helpt het om beter gevonden te worden in zoekmachines.

#### Wat je kunt doen

* Deel korte, praktische artikelen over problemen die je oplost.
* Maak een gratis kennisdocument over het digitaliseren van processen.
* Beantwoord veelgestelde vragen van klanten op een aparte pagina.

### 9. Schrijfstijl — 5,5 / 10

#### Wat we zien

De teksten wisselen tussen de klant en zichzelf. Zinnen als "jouw unieke processen" zijn klantgericht, maar er staat ook veel "wij" en nadruk op het eigen platform. De toon is vlot, maar gebruikt veel vaktaal. Voor een leek is niet elke zin meteen duidelijk.

#### Waarom dit telt

Klanten haken aan bij hun eigen probleem, niet bij jouw techniek. Tekst die begint bij de klant voelt persoonlijker en houdt de aandacht vast. Te veel "wij" en jargon zet mensen op afstand.

#### Wat je kunt doen

* Begin vaker bij het probleem van de klant en pas daarna bij de oplossing.
* Vervang vaktermen door gewone woorden, of leg ze kort uit.
* Spreek de lezer direct aan met "jij" of "u", consequent door de hele site.

### 10. Actualiteit — 5,0 / 10

#### Wat we zien

Wij konden niet zien of de content recent is. Er staan geen duidelijke data, jaartallen of nieuwsberichten op de homepage. De aanbeveling en teksten ogen verzorgd, maar of alles nog klopt, is van buitenaf niet te checken. Daarom een voorzichtige, gemiddelde score.

#### Waarom dit telt

Een site die actueel oogt, wekt vertrouwen. Oude data of verouderde voorbeelden geven het gevoel dat een bedrijf stilstaat. Vers ogende content laat zien dat je actief bent.

#### Wat je kunt doen

* Zet een datum of jaartal bij nieuws en voorbeelden.
* Ververs aanbevelingen en voorbeelden af en toe.
* Controleer of de koppelingen met software (zoals AFAS, Exact) nog kloppen.

### 11. Contactpagina — 4,0 / 10

#### Wat we zien

De homepage nodigt uit tot contact, maar wij konden de aparte contactpagina niet inladen. Daardoor weten wij niet of er een telefoonnummer, e-mailadres, adres of formulier op staat. Op de homepage zelf zagen wij geen directe contactgegevens. Deze score is daarom voorzichtig.

#### Waarom dit telt

Wie wil reageren, moet dat meteen en makkelijk kunnen. Hoe minder moeite, hoe meer mensen contact opnemen. Ontbrekende of verstopte gegevens kosten je gesprekken.

#### Wat je kunt doen

* Zet de belangrijkste contactgegevens ook op de homepage, bijvoorbeeld telefoon en e-mail.
* Maak een kort contactformulier met weinig velden.
* Vertel wanneer iemand antwoord kan verwachten.

# De vijf belangrijkste acties

Hieronder staan vijf acties, gesorteerd op belang. Bovenaan staat wat het meeste oplevert.

| Actie | Impact | Waarom dit helpt |
| --- | --- | --- |
| **Voeg uitgewerkte klantcases toe** | **hoog** | Een verhaal met klant, probleem, oplossing en resultaat overtuigt sterker dan een belofte. |
| **Zet de belofte boven aan de pagina in gewone taal** | **hoog** | De bezoeker beslist in seconden of hij blijft. |
| **Maak voordelen concreet met cijfers** | **hoog** | Een getal maakt een belofte geloofwaardig. Gebruik alleen echte cijfers. |
| **Toon meer bewijs: logo's en aanbevelingen** | **middel** | Bewijs van anderen overtuigt meer dan wat je over jezelf zegt. |
| **Maak contact en stappenplan makkelijk vindbaar** | **middel** | Mensen haken af als ze niet weten wat er gebeurt of hoe ze moeten reageren. |

# Tot slot

Dit rapport is bedoeld om u snel grip te geven op uw website. U bepaalt zelf welke punten u oppakt. Begin bij de acties met impact "hoog": die helpen het meest om van een bezoeker een klant te maken. Wilt u dat een aantal pagina's die wij nu niet konden inladen (contact, cases, blog) alsnog wordt beoordeeld, dan kan dat in een vervolgronde.

Met vriendelijke groet,
```

- [ ] **Step 3: Re-seed DB via bestaand script**

```
pnpm tsx scripts/seed-format-example.ts website-check
```

Expected: `Seeded format_example voor website-check (XXXX chars)` (chars ~12k).

- [ ] **Step 4: Verifieer via Supabase MCP**

Load `mcp__572a4bf1-21cb-4e93-8c29-d9d4736f2f08__execute_sql` via ToolSearch.
Roep aan met:
- `project_id`: `nirlmczamjrcxciyzkpy`
- `query`: `SELECT LENGTH(format_example) AS chars, format_example LIKE '%#### Wat we zien%' AS has_h4 FROM modules WHERE slug = 'website-check';`

Expected: `chars` ~12000, `has_h4 = true`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add modules/website-check/format-example.md
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(format): nieuwe heading-hierarchie voor website-check + re-seed DB

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: `MarkdownBlock` krijgt optionele `variant`-prop

**Files:**
- Modify: `lib/modules/MarkdownBlock.tsx`

Backward-compatible: zonder `variant` blijft het gedrag identiek (admin
preview, free-blokken). `variant="report"` schakelt naar de
rapport-typografie.

- [ ] **Step 1: Vervang `MarkdownBlock.tsx`**

```tsx
import { marked } from "marked";

type Variant = "default" | "report";

const VARIANT_CLASSES: Record<Variant, string> = {
  default:
    "prose prose-slate prose-sm max-w-none rounded-xl border border-slate-200 bg-slate-50/60 p-4",
  report:
    "prose prose-slate max-w-none px-10 py-6 " +
    "prose-headings:font-medium " +
    "prose-h1:text-2xl prose-h1:border-b-2 prose-h1:border-purple-100 prose-h1:pb-2 prose-h1:mt-8 prose-h1:mb-4 " +
    "prose-h3:text-base prose-h3:font-semibold prose-h3:text-slate-700 prose-h3:mt-6 prose-h3:mb-2 " +
    "prose-h4:text-[11px] prose-h4:uppercase prose-h4:tracking-wider prose-h4:text-slate-500 prose-h4:font-semibold prose-h4:mt-4 prose-h4:mb-1 " +
    "prose-table:text-sm " +
    "prose-th:bg-purple-50 prose-th:text-purple-900 prose-th:font-medium prose-th:px-3 prose-th:py-2 prose-th:text-left " +
    "prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-slate-200",
};

/**
 * Rendert een vrij Markdown-blok.
 * `marked` produceert HTML — admin is vertrouwd, geen sanitization-laag.
 * Synchrone parse (marked.parse zonder async-flag).
 * `variant="report"` activeert de pro-rapport-typografie voor de
 * website-check eindgebruiker-render.
 */
export function MarkdownBlock({
  markdown,
  variant = "default",
}: {
  markdown: string;
  variant?: Variant;
}) {
  if (!markdown || !markdown.trim()) return null;
  const html = marked.parse(markdown, { async: false }) as string;
  return (
    <div
      className={VARIANT_CLASSES[variant]}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 2: Typecheck + tests**

```
pnpm tsc --noEmit
pnpm vitest run
```

Expected: PASS. Bestaande consumers passen al (variant is optioneel, default).

- [ ] **Step 3: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add lib/modules/MarkdownBlock.tsx
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(markdown): variant-prop voor MarkdownBlock (report-stijl)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Cover- en Score-componenten

**Files:**
- Create: `modules/website-check/report/ScoreCard.tsx`
- Create: `modules/website-check/report/CoverBanner.tsx`

- [ ] **Step 1: `ScoreCard.tsx`**

```tsx
export function ScoreCard({ score }: { score: string }) {
  return (
    <div className="flex-shrink-0 rounded-md border border-purple-200 bg-purple-100 px-5 py-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-700">
        Totaalscore
      </div>
      <div className="mt-1 text-3xl font-medium leading-none text-purple-900">
        {score}
      </div>
      <div className="mt-0.5 text-[10px] text-purple-700">/ 10</div>
    </div>
  );
}
```

- [ ] **Step 2: `CoverBanner.tsx`**

```tsx
import { marked } from "marked";
import { ScoreCard } from "./ScoreCard";

export function CoverBanner({
  raw,
  score,
}: {
  raw: string;
  score: string | null;
}) {
  const html = marked.parse(raw, { async: false }) as string;
  return (
    <header className="border-b border-slate-200 bg-gradient-to-b from-purple-50 to-white px-10 pb-6 pt-8">
      <div className="flex items-start justify-between gap-6">
        <div
          className="prose prose-slate max-w-none flex-1 prose-p:my-1 prose-p:text-base prose-strong:text-slate-900 prose-em:text-slate-500"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {score && <ScoreCard score={score} />}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Typecheck — componenten worden nog niet aangeroepen**

```
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  modules/website-check/report/ScoreCard.tsx \
  modules/website-check/report/CoverBanner.tsx
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(report): CoverBanner + ScoreCard componenten

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Strengths/Improvements + Body + Shell

**Files:**
- Create: `modules/website-check/report/StrengthsImprovements.tsx`
- Create: `modules/website-check/report/ReportBody.tsx`
- Create: `modules/website-check/report/ReportShell.tsx`

- [ ] **Step 1: `StrengthsImprovements.tsx`**

```tsx
export function StrengthsImprovements({
  strengths,
  improvements,
}: {
  strengths: string[];
  improvements: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 px-10 py-6">
      <section className="rounded-r-md border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          Sterke punten
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-emerald-950">
          {strengths.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-r-md border-l-4 border-amber-600 bg-amber-50 px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
          Grootste verbeterpunten
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-amber-950">
          {improvements.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: `ReportBody.tsx`**

```tsx
import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

export function ReportBody({ markdown }: { markdown: string }) {
  if (!markdown || !markdown.trim()) return null;
  return <MarkdownBlock markdown={markdown} variant="report" />;
}
```

- [ ] **Step 3: `ReportShell.tsx`**

```tsx
import type { ReactNode } from "react";

export function ReportShell({ children }: { children: ReactNode }) {
  const today = new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {children}
      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-10 py-3 text-xs text-slate-500">
        <span>Positionr · Website analyse</span>
        <span>Gegenereerd {today}</span>
      </footer>
    </article>
  );
}
```

- [ ] **Step 4: Typecheck**

```
pnpm tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  modules/website-check/report/StrengthsImprovements.tsx \
  modules/website-check/report/ReportBody.tsx \
  modules/website-check/report/ReportShell.tsx
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(report): StrengthsImprovements + ReportBody + ReportShell

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Assembly + delegate van `WebsiteCheckResultView`

**Files:**
- Create: `modules/website-check/report/WebsiteCheckReport.tsx`
- Modify: `modules/website-check/components/WebsiteCheckResultView.tsx`

- [ ] **Step 1: `WebsiteCheckReport.tsx`**

```tsx
import { parseReport } from "./parseReport";
import { CoverBanner } from "./CoverBanner";
import { StrengthsImprovements } from "./StrengthsImprovements";
import { ReportBody } from "./ReportBody";
import { ReportShell } from "./ReportShell";

export function WebsiteCheckReport({ markdown }: { markdown: string }) {
  const blocks = parseReport(markdown);

  return (
    <ReportShell>
      {blocks.cover && (
        <CoverBanner raw={blocks.cover.raw} score={blocks.cover.score} />
      )}
      {blocks.strengths && blocks.improvements && (
        <StrengthsImprovements
          strengths={blocks.strengths}
          improvements={blocks.improvements}
        />
      )}
      <ReportBody markdown={blocks.bodyMarkdown} />
    </ReportShell>
  );
}
```

- [ ] **Step 2: Update `WebsiteCheckResultView.tsx`**

```tsx
import { WebsiteCheckReport } from "../report/WebsiteCheckReport";

/**
 * Entry-point voor het Website Check resultaat. Houdt de container-styling
 * (centered, padding) en delegeert naar de rapport-renderer.
 */
export function WebsiteCheckResultView({
  markdown,
}: {
  markdown: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <WebsiteCheckReport markdown={markdown} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + tests**

```
pnpm tsc --noEmit
pnpm vitest run
```

Expected: PASS. Test-count zelfde als na Task 1 (81).

- [ ] **Step 4: Smoke-test in browser**

```
pnpm dev
```

Open in browser:
1. `/admin/layouts/website-check` — split-pane editor laadt onveranderd (de admin-preview gebruikt MarkdownBlock default-variant, niet de report-variant).
2. Start een nieuwe analyse via `/modules/website-check` (vul een URL in).
3. Wacht op `status=approved`. Open de result-pagina.
4. Verwacht:
   - Cover-banner met paars gradient + bedrijfsnaam in bold + score-card rechts.
   - Direct daaronder: groene + oranje cards naast elkaar met de sterke en grote verbeterpunten.
   - Tabel met scores per onderdeel — paarse header-rij, alternating rows.
   - Per-onderdeel: H3 met nummer + naam + score; eronder small-caps "Wat we zien", paragraph; "Waarom dit telt", paragraph; "Wat je kunt doen", bullets.
   - Footer-balk onderaan grijs met "Positionr · Website analyse" en datum.

Als de AI nog ouwe `**bold**`-sub-koppen produceert (gebeurt totdat de re-seeded prompt + format-template overneemt): de H3/H4 styling springt visueel niet aan, maar de output blijft leesbaar.

- [ ] **Step 5: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  modules/website-check/report/WebsiteCheckReport.tsx \
  modules/website-check/components/WebsiteCheckResultView.tsx
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(report): WebsiteCheckReport assembly + delegate vanuit ResultView

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
