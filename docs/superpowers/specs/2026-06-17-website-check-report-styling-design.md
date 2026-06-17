# Spec — Pro-rapport-styling voor Website Check output

**Datum:** 2026-06-17
**Module:** modules/website-check
**Status:** ontwerp, klaar voor implementatieplan

## Probleem

De runtime produceert nu markdown via de format-template (commit `87703e1`),
maar `MarkdownBlock` rendert het als platte prose. De eindgebruiker krijgt een
serieuze analyse op het scherm; visueel oogt het als een ruwe notitie. De
indruk moet zijn: een afgewerkt rapport, geen markdown-dump.

## Doel

Eén custom React-renderer voor Website Check die de raw markdown opdeelt in
visuele blokken en die elk apart stylet. Geen logica in de AI-prompt of
schema-validatie — pure presentatie-laag.

## Aanpak

Pre-parse de markdown vóór render om bekende patronen te herkennen
(cover-tekst, totaalscore, sterke punten, verbeterpunten). De rest van de
body rendert via `marked` met aangepaste CSS. Patroon-detectie faalt
gracefully — als een blok niet matcht wordt het simpelweg overgeslagen en
valt het binnen de body-render.

## Format-template wijziging

De huidige template gebruikt `**bold**` voor sub- en sub-sub-koppen. We
zetten ze om naar échte heading-niveaus zodat CSS ze sauber kan stylen:

| Oud | Nieuw |
|---|---|
| `**1. Waardepropositie 6,5 / 10**` | `### 1. Waardepropositie — 6,5 / 10` |
| `**Wat we zien**` | `#### Wat we zien` |
| `**Waarom dit telt in marketing**` | `#### Waarom dit telt` |
| `**Wat je kunt doen**` | `#### Wat je kunt doen` |

Update zowel:
- `modules/website-check/format-example.md` is **niet meer aanwezig** (Task 6
  cleanup verwijderde dit bestand). We voegen 'm opnieuw toe met de nieuwe
  structuur — handig voor `git`-history en als referentie-bron voor admins.
- De `modules.format_example`-rij in DB: re-seed via het bestaande
  `scripts/seed-format-example.ts`.

## Markdown-parser

Nieuwe pure-functie `parseReport(markdown: string)` retourneert:

```ts
type ReportBlocks = {
  cover: {
    raw: string;          // alle regels vóór de eerste H1
    score: string | null; // bv. "4,9" als gevonden, anders null
  } | null;
  strengths: string[] | null;     // bullet-items van H2 "Sterke punten"
  improvements: string[] | null;  // bullet-items van H2 "(Grootste )?[Vv]erbeterpunten"
  bodyMarkdown: string;           // de markdown zonder cover/strengths/improvements
};
```

### Regels

- **Cover**: alle regels vanaf het begin tot (exclusief) de eerste regel
  die matcht `^#\s+`. Indien er geen H1 is, returnt `cover.raw` de hele
  input.
- **Score**: regex over cover-tekst `(\d+[,.]\d+)\s*\/\s*10`. Eerste hit
  wordt gebruikt. Komma → `,` blijft komma (Nederlandse notatie).
- **Strengths / improvements**: zoek H2-blok matchend `^##\s+Sterke punten\s*$`
  resp. `^##\s+(Grootste\s+)?[Vv]erbeterpunten\s*$`. Verzamel daarna
  bullet-items (`^[*-]\s+`) tot een volgende heading of lege regel-gap. Strip
  het gevonden blok uit `bodyMarkdown`.
- **bodyMarkdown**: alles na de eerste H1, minus de strengths-/improvements-
  blokken.

### Edge cases

- Geen cover (eerste regel is `#`) → `cover = null`, geen banner gerenderd.
- Geen H1 in de input → cover bevat de hele input, body is leeg.
- Geen score in cover → score-card niet getoond.
- Strengths én improvements moeten **beide** matchen om de side-by-side
  cards te tonen; bij maar één laat de body-render het zelf doen (anders
  zou er een eenzame card hangen).

## Componentstructuur

```
WebsiteCheckResultView (entry point, blijft signature behouden)
└── WebsiteCheckReport (nieuw, accepteert markdown-string)
    ├── ReportShell (A4-card chrome)
    │   ├── CoverBanner (alleen indien cover !== null)
    │   │   ├── CoverContent (gerenderde cover-markdown)
    │   │   └── ScoreCard (alleen indien score !== null)
    │   ├── StrengthsImprovements (alleen indien beide arrays !== null)
    │   │   ├── StrengthsCard (groen accent)
    │   │   └── ImprovementsCard (oranje accent)
    │   ├── ReportBody (gestyleerde MarkdownBlock met bodyMarkdown)
    │   └── ReportFooter ("Positionr · Website analyse" + datum)
```

### Bestanden

- Nieuw: `modules/website-check/report/parseReport.ts` — pure parser.
- Nieuw: `modules/website-check/report/parseReport.test.ts` — unit tests.
- Nieuw: `modules/website-check/report/WebsiteCheckReport.tsx` — top-level
  component die parser aanroept en de sub-componenten samenstelt.
- Nieuw: `modules/website-check/report/CoverBanner.tsx`.
- Nieuw: `modules/website-check/report/StrengthsImprovements.tsx`.
- Nieuw: `modules/website-check/report/ReportBody.tsx` — wrappper rond
  `MarkdownBlock` met aangepaste prose-classes.
- Nieuw: `modules/website-check/report/ReportShell.tsx`.
- Gewijzigd: `modules/website-check/components/WebsiteCheckResultView.tsx` —
  delegeert naar `WebsiteCheckReport`. Container blijft `<div className="mx-auto max-w-4xl px-6 py-10">`.
- Nieuw: `modules/website-check/format-example.md` (heropgevoerd met
  nieuwe heading-hierarchie).

## Styling per blok

### ReportShell

- `bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden`.
- Footer-balk onderaan: grijs `bg-slate-50`, kleine font, `border-t`.

### CoverBanner

- `bg-gradient-to-b from-purple-50 to-white px-10 pt-8 pb-6 border-b border-slate-200`.
- Cover-content gerenderd via `marked` met inline-styling overrides voor de
  paragraph-tekst (groter, geen prose-card-kader).
- ScoreCard rechts uitgelijnd: `bg-purple-100 border border-purple-200
  rounded-md p-4 text-center`, label "Totaal", score in 32px paars, "/10"
  klein.

### StrengthsImprovements

- 2-koloms grid (`grid grid-cols-2 gap-4`), beide cards met `border-l-4`
  accent + `rounded-r-md` + lichte tint bg + uppercase label boven.
- Strengths: `border-emerald-600 bg-emerald-50` + label `text-emerald-700`.
- Improvements: `border-amber-600 bg-amber-50` + label `text-amber-800`.

### ReportBody

`MarkdownBlock` rendert al via `marked.parse`. We voegen een optionele
`variant`-prop toe. Default-variant blijft ongewijzigd (de huidige consumer
in `/admin/layouts/[slug]` preview gebruikt 'm zo). `variant="report"`
wordt door `WebsiteCheckReport` aangeroepen:

```tsx
<MarkdownBlock markdown={body} variant="report" />
```

Bij `variant="report"`:
- `prose prose-slate max-w-none px-10 py-6` (geen card-kader meer).
- `prose-headings:font-medium`
- `prose-h1:hidden` (H1's worden niet getoond — cover-banner toont de
  rapportnaam al, en alle latere H1's in de body zijn alleen visuele
  sectie-breaks die we via H2's stylen).
- `prose-h2:text-2xl prose-h2:border-b-2 prose-h2:border-purple-100
  prose-h2:pb-2 prose-h2:mb-4`.
- `prose-h3:text-base prose-h3:font-semibold prose-h3:text-slate-700
  prose-h3:mt-6`.
- `prose-h4:text-[11px] prose-h4:uppercase prose-h4:tracking-wider
  prose-h4:text-slate-500 prose-h4:font-semibold prose-h4:mt-4 prose-h4:mb-1`.
- Tabellen: paarse header-rij + alternating rows. Tailwind heeft hier geen
  prose-modifier voor — voeg expliciete CSS toe via een `<style>`-blok in
  `MarkdownBlock` of via Tailwind `prose-table` overrides.

### Footer

- `bg-slate-50 border-t border-slate-200 px-10 py-3 text-xs text-slate-500
  flex justify-between`.
- Links: "Positionr · Website analyse".
- Rechts: `Gegenereerd {DatumVandaag}` — voor nu een statische placeholder
  uit `new Date()`-client-side, geen API.

## Testing

- Unit: `parseReport.test.ts` met 8 cases:
  1. Volledige format → alle blokken gevuld.
  2. Geen H1 → cover = hele input, body = "".
  3. Geen score in cover → `score: null`.
  4. Sterke punten zonder verbeterpunten → beide null (single-card niet
     getoond).
  5. Verbeterpunten zonder sterke → beide null.
  6. Sterke + verbeterpunten samen → beide arrays + body strips beide.
  7. Decimal-score met punt i.p.v. komma (`7.4 / 10`) → score `"7.4"`.
  8. Lege input → alles null.
- Geen UI-tests voor de React-componenten (handmatige browser-verificatie).

## Backward-compat

- Bestaande sessies zonder de nieuwe heading-structuur blijven werken: de
  parser zoekt op headings die bestaande output nog niet heeft, dus alle
  patroon-detectie faalt, en de body-render toont gewoon de raw markdown.
- Nieuwe analyses (vanaf re-seed) volgen de nieuwe structuur.

## Out of scope

- Logo-upload per klant (admin levert nog steeds `[LOGO KLANTNAAM]` als
  placeholder-tekst).
- Download als PDF.
- Color-coded scores in de scores-tabel.
- Dark-mode (admin + portal zijn light-only).
- Edge case: AI-output zonder enkele heading (`marked` rendert dat als
  enkele lange paragraaf — acceptabel, valt buiten doel).
