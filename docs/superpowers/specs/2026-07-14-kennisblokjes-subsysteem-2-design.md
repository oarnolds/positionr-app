# Kennisblokjes in de modules (subsysteem 2) — ontwerp

**Datum:** 2026-07-14
**Status:** goedgekeurd ontwerp, klaar voor implementatieplan

## Context

Subsysteem 1 (`docs/superpowers/specs/2026-07-09-kennisbibliotheek-design.md`)
bouwt en beheert de kennisbibliotheek: gedistilleerde concept-kaarten uit
marketing/sales-boeken, met velden `title`, `kern`, `toepassing`, `tags[]`,
`source_label`, `status` (`concept` | `goedgekeurd`). Alleen goedgekeurde
kaarten zijn beschikbaar voor dit subsysteem.

Dit ontwerp dekt **subsysteem 2**: goedgekeurde kaarten **matchen** aan de
output van een module en als **kennisblokje** ("uit de theorie") tonen tussen
de module-output. Omdat de blokjes ín die output leven, hoort er een
**herontwerp van de website-check-output** bij: die rendert nu als rauwe
markdown en mist de sectie-structuur waar de blokjes op steunen.

## Doel

Bij een afgeronde module-run verschijnen tot **3** korte, leerzame
"kennisblokjes" naast de relevante secties — een pakkende quote in Positionr's
eigen woorden, met bronvermelding, als inspiratie voor de gebruiker die geen
heel boek gaat lezen. De blokjes worden bij generatie bepaald en zijn daarna
stabiel (ze veranderen niet als de bibliotheek later wijzigt) en stromen mee
naar de PDF-export.

## Beslissingen (uit de brainstorm)

1. **Matching = tags → LLM-pick**, met **volledige prefilter-infra** (geen
   YAGNI-versimpeling naar "LLM over hele bibliotheek").
2. **Gedeelde taxonomie** van ~18 kennisthema's. Kaarten krijgen een
   taxonomie-gemapt veld `themes[]` naast de vrije `tags[]`.
3. **Module→taxonomie via mechanisme 2**: een LLM-call leidt de aanwezige
   thema's af uit de **échte output** (niet uit een statische per-module map).
4. **Selectie**: max **3** blokjes per rapport, met **kwaliteitsdrempel** — de
   pick-call mag "geen match" teruggeven, ook als dat onder 3 blijft (soms 0).
5. **Timing = bij generatie**: matches worden **gesnapshot** in de sessie.
6. **Inhoud blokje** = één gegenereerde **brug-zin** + de goedgekeurde kaart,
   gerenderd als **pull-quote** (stijl 2).
7. **Plaatsing** = **naast** de gematchte sectie (2-koloms, links/rechts
   afwisselend); secties zonder match blijven volle breedte; mobiel stapelt.
8. **Website-check** houdt zijn bestaande **markdown-generatie** (admin-prompt +
   format-template + Claude/Perplexity/both) en wordt **geparset** naar
   structured secties voor de nieuwe renderer; onparsbare output valt terug op
   de huidige markdown-render. *(Herzien 2026-07-14: aanvankelijk kozen we een
   JSON-schema; de echte generatie is admin-prompt + format-template + markdown
   met drie providers — een JSON-ombouw zou die werkende admin-workflow
   verstoren en Perplexity-JSON-betrouwbaarheid oproepen. De format-template legt
   de koppen deterministisch vast, dus parsen is hier betrouwbaar.)*
9. **Scope eerste build (A)**: een module-agnostische engine + adapters voor de
   **generieke runner** (dekt alle prompt-gedreven modules) én **website-check**.
   ICP schuift door. **Gratis-check en deel-pagina's (`/r/…`) krijgen geen
   blokjes** — die blijven teaser.

## Niet-doelen (YAGNI)

- **Geen embeddings/semantische index** — de prefilter is tag/taxonomie-based.
- **Geen ICP-integratie** in deze build (adapter volgt later).
- **Geen kennisblokjes op de gratis-check en `/r/…`-deel-pagina's.**
- **Geen "opnieuw matchen"-actie** voor de eindgebruiker (kan later).
- **Geen admin-review van de matches zelf** — de kaarten zijn al goedgekeurd;
  de brug-zin is één framing-zin zonder feitclaims (geaccepteerd risico).

## Architectuuroverzicht

De matching-engine is **module-agnostisch** en werkt op een uniforme
`MatchableSection`-interface. Elke module levert een klein **adapter**
(output → secties) en een **render-naad** (blokje naast de sectie).

```
module-output ──adapter──▶ MatchableSection[] { key, titel, tekst }
        │
        ▼
  [1] classify   (LLM, mechanisme 2) → thema's per sectie  (taxonomie = toegestane woordenschat)
        │
        ▼
  [2] prefilter  (deterministische code) → per sectie: kandidaat-kaarten waar themes ∩ sectie-thema's
        │
        ▼
  [3] pick       (LLM) → max 3 gekozen { sectionKey, cardId, brug-zin }, gerangschikt, mag 0 zijn
        │
        ▼
  snapshot kaartinhoud → KnowledgeBlock[]  → opslaan op de sessie
```

Twee LLM-calls per run (classify + pick). De classify-call krijgt de taxonomie
als statisch (cachebaar) blok; de pick-call krijgt alleen de **geshortliste**
kandidaten per sectie, niet de hele bibliotheek. Matching is **best-effort**:
een fout in de engine mag het rapport nooit laten falen (catch → lege blokjes,
loggen).

## Datamodel

**Wijziging `knowledge_cards`** (subsysteem 1):
- `themes text[]` default `{}` — taxonomie-gemapte thema's, naast de vrije `tags`.

**Wijziging `sessions`**:
- `knowledge_blocks jsonb` (nullable) — gesnapshotte blokjes. `null` = nog niet
  gematcht / uitgesloten module. Vorm:
  ```jsonc
  [
    {
      "sectionKey": "bewijsvoering",     // sleutel uit de adapter
      "rank": 1,                          // volgorde (voor links/rechts-afwisseling)
      "bridge": "Je bewijs is nu mager — …",
      "cardId": "uuid",                   // referentie (debug/telemetrie)
      "card": {                            // SNAPSHOT — rapport blijft stabiel
        "title": "Sociale bewijskracht",
        "kern": "…",
        "toepassing": "…",
        "sourceLabel": "Robert Cialdini — Invloed"
      }
    }
  ]
  ```

Snapshotten (i.p.v. live join op `cardId`) maakt het rapport stabiel — de
kern-beslissing — en robuust tegen later verwijderde/gewijzigde kaarten.

RLS: `knowledge_blocks` erft de bestaande sessie-policies (eigenaar leest zijn
eigen sessie).

## Taxonomie

Een **gecureerde, in git geversioneerde** lijst in `lib/knowledge/taxonomy.ts`
(geen DB-tabel). Startset (~18; verfijnbaar):

`waardepropositie`, `klantvoordelen`, `bewijsvoering`, `sociale-bewijskracht`,
`autoriteit-expertise`, `schaarste-urgentie`, `wederkerigheid`,
`commitment-consistentie`, `sympathie-relatie`, `positionering-onderscheid`,
`doelgroep-icp`, `storytelling-klantcase`, `cta-conversie`,
`prijs-waardeperceptie`, `content-thought-leadership`,
`vertrouwen-risicoreductie`, `boodschap-copyhelderheid`, `gedrag-besliskunde`.

Elk item: `{ slug, label }`. De taxonomie is de **enige toegestane woordenschat**
voor zowel `knowledge_cards.themes` als de classify-output.

## Matching-engine (`lib/knowledge/matching/`)

- **`types.ts`** — `MatchableSection { key: string; titel: string; tekst: string }`,
  `KnowledgeBlock` (zie datamodel), `ModuleAdapter { getSections(output): MatchableSection[] }`.
- **`adapters/generic.ts`** — `GenericReport.secties[]` → secties. `key` =
  slug van titel/eyebrow (uniek gemaakt met index); `tekst` = `inhoud` +
  platgeslagen `feiten`/`chips`. Bij de **markdown-fallback**-output
  (`{kind:"markdown"}`, geen secties) → lege lijst, dus geen matching.
- **`adapters/website-check.ts`** — de geparsete `onderdelen[]` (uit
  `parseReport` → `ParsedWebsiteCheck`) → secties. `key` = onderdeel-slug (bv.
  `bewijsvoering`); `tekst` = `watWeZien` + `waaromDitTelt` + `watJeKuntDoen`.
- **`classify.ts`** — bouwt de classify-prompt (taxonomie + secties) en
  parseert `{ sectionKey: string[] }`, gefilterd op geldige taxonomie-slugs.
- **`prefilter.ts`** — pure functie: per sectie de goedgekeurde kaarten waarvan
  `themes ∩ sectie-thema's ≠ ∅`. Levert kandidaten per sectie.
- **`pick.ts`** — bouwt de pick-prompt (per sectie: sectie-tekst + kandidaat-
  kaarten) met de regels *max 3 totaal, gerangschikt, mag 0 zijn, schrijf per
  keuze één brug-zin die aan díé sectie raakt*. Parseert `{ sectionKey, cardId,
  bridge }[]`.
- **`index.ts` (`buildKnowledgeBlocks`)** — orkestreert classify → prefilter →
  pick → snapshot → `KnowledgeBlock[]`. Best-effort (catch → `[]`).

Aangeroepen in de generatie-services (`modules/generic/service.ts` en
`modules/website-check/service.ts`) ná de hoofdanalyse en vóór `status: done`,
met de bijbehorende adapter. Result → `sessions.knowledge_blocks`.

## Website-check output-herontwerp (parser-route)

De generatie blijft **ongewijzigd**: admin-prompt + format-template →
**markdown**, via de bestaande provider-keuze (Claude/Perplexity/both). We
**parsen** die markdown naar een structured model en renderen daaruit. Dat is
betrouwbaar omdat de format-template de koppen deterministisch vastlegt
(`### N. Titel — score / 10`, `#### Wat we zien`, `#### Waarom dit telt`,
`#### Wat je kunt doen`).

**Geparset model** (uitbreiding van `parseReport` → `ParsedWebsiteCheck`):
```ts
ParsedWebsiteCheck = {
  cover: { raw: string; score: string | null };   // bestaand
  sterktes: string[]; verbeterpunten: string[];    // bestaand
  onderdelen: {
    nr: number;
    slug: string;                   // stabiele sleutel (bv. "bewijsvoering")
    titel: string;
    score: number | null;           // 0–10
    watWeZien: string;
    waaromDitTelt: string;
    watJeKuntDoen: string[];
  }[];
  acties: { titel: string; impact: "hoog" | "middel" | "laag" | null }[];
  bodyMarkdown: string;             // rest (inleiding/samenvatting/tot slot)
}
```
- **Parser** (`parseReport`): bestaande cover/score/sterktes/verbeterpunten
  blijven; toegevoegd worden de 11 `onderdelen` (kop + 3 subblokken) en de
  `acties`-tabel. `slug` = geslugde onderdeel-titel. Lukt het onderdelen-parsen
  niet (format-drift) → `onderdelen: []`, `acties: []`.
- **Renderer** (herontworpen `WebsiteCheckReport`-component): hero met
  **score-ring**, **"Scores in één oogopslag"** (gekleurde balken: rood <5,
  amber 5–6,5, groen ≥6,5), **onderdeel-kaarten** (score-badge + subblokken),
  **top-acties** met impact-badges. Design volgt `lib/modules/report-sections.tsx`.
- **Fallback**: is `onderdelen` leeg (oude sessie of format-drift), dan rendert
  het component de huidige `ReportBody`/markdown-weergave. Geen datamigratie
  nodig — de `output` blijft markdown.

## Rendering van de kennisblokjes

- **`components/KnowledgeBlock.tsx`** (gedeeld) — pull-quote (stijl 2): eyebrow
  "📖 Uit de theorie", brug-zin, `kern` als quote, `title` + `sourceLabel` als
  attributie, `toepassing` als voetregel. Bron toont "naar {auteur}" — het is
  Positionr's eigen formulering, geen letterlijk citaat.
- **Paar-layout** (gedeelde helper): een gematchte sectie + zijn blokje worden
  een 2-koloms `pair` (~60/40). **Afwisseling** op `rank`: oneven → blokje
  rechts, even → blokje links. Secties zonder blokje blijven volle breedte.
  Mobiel (`<640px`): stapelen, onderdeel boven het blokje.
- **Generieke renderer** (`GenericReportView`): de blok-weving vervangt voor
  gematchte secties de bestaande `half`-paring; ongematchte secties houden het
  huidige gedrag.
- **Website-check renderer**: zelfde paar-layout rond de onderdeel-kaarten.
- Lookup gebeurt op `sectionKey` uit `sessions.knowledge_blocks`.

## Admin-uitbreiding (subsysteem 1)

- **Kaart bewerken/goedkeuren** krijgt een **`themes[]`-multiselect** gebonden
  aan de taxonomie, voorgevuld met een **LLM-suggestie** (mapt vrije `tags` +
  `kern` → taxonomie-slugs); admin kan bijstellen. Goedkeuren zonder ten minste
  één thema wordt ontmoedigd (waarschuwing), niet hard geblokkeerd.
- **Eenmalige backfill**: bestaande goedgekeurde kaarten krijgen `themes[]` via
  een script dat dezelfde LLM-mapping draait; admin controleert de wachtrij.

## Te bouwen (bestanden)

| Bestand | Verantwoordelijkheid |
| --- | --- |
| DB-migratie | `knowledge_cards.themes`, `sessions.knowledge_blocks` |
| `lib/db/schema.ts` | Kolommen toevoegen |
| `lib/knowledge/taxonomy.ts` | Gecureerde thema-lijst |
| `lib/knowledge/matching/types.ts` | Interfaces |
| `lib/knowledge/matching/adapters/generic.ts` | GenericReport → secties |
| `lib/knowledge/matching/adapters/website-check.ts` | Onderdelen → secties |
| `lib/knowledge/matching/classify.ts` | Thema's uit output (LLM) |
| `lib/knowledge/matching/prefilter.ts` | Intersectie kandidaten (puur) |
| `lib/knowledge/matching/pick.ts` | Kaart-keuze + brug-zin (LLM) |
| `lib/knowledge/matching/index.ts` | `buildKnowledgeBlocks` orkestratie |
| `modules/generic/service.ts` | Matching-hook na analyse |
| `modules/website-check/report/parseReport.ts` | Uitbreiden: 11 onderdelen + acties parsen → `ParsedWebsiteCheck` |
| `modules/website-check/report/WebsiteCheckReport.tsx` | Herontworpen renderer + fallback naar markdown |
| `modules/website-check/service.ts` | Matching-hook na analyse *(plan 2)* |
| `components/KnowledgeBlock.tsx` | Pull-quote-component |
| `lib/modules/report-pairing.tsx` | Paar-layout + afwisseling (gedeeld) |
| `modules/generic/components/GenericReportView.tsx` | Blok-weving |
| `app/(admin)/admin/kennis/*` | `themes`-multiselect + LLM-suggestie |
| Backfill-script | Bestaande kaarten → `themes[]` |

## Teststrategie

- **Adapters** — GenericReport en website-check-onderdelen → correcte
  `MatchableSection[]` (stabiele `key`, samengevoegde tekst).
- **Taxonomie** — `themes ⊆ taxonomie`; classify-output filtert ongeldige slugs.
- **Prefilter** — pure intersectie-logica: match, geen-match, meerdere thema's.
- **Prompt-bouw** — classify (taxonomie + secties) en pick (max 3, mag 0,
  brug-zin per keuze); niet de gegenereerde inhoud.
- **Snapshot/stabiliteit** — blok bevat kaartinhoud; blijft geldig na verwijderen
  van de bronkaart.
- **Best-effort** — een fout in de matching laat de sessie niet falen.
- **Website-check** — `parseReport` extraheert de 11 onderdelen (kop + score +
  3 subblokken) en de acties uit de format-template-markdown; onparsbare of oude
  output valt terug op de markdown-render.
- **Rendering** — paar-layout + links/rechts-afwisseling; volle breedte zonder
  match; mobiel stapelt.

## Bekende beperkingen / risico's

- **Brug-zin is gegenereerd** (niet vooraf goedgekeurd). Eén framing-zin zonder
  feitclaims — geaccepteerd. Prompt verbiedt uitspraken over de boekinhoud.
- **Kies-kwaliteit bij grote shortlist** — de pick-prompt is strak; bij problemen
  kan later een focus/rangschik-stap toe. Taxonomie-prefilter beperkt de omvang al.
- **Twee extra LLM-calls per run** — klein (classify leest alleen output;
  pick alleen de shortlist); classify-taxonomie is cachebaar.
- **Adapter-drift** — als een module-schema wijzigt, moet zijn adapter mee. De
  adapters zijn klein en getest om dit te vangen.
- **Taxonomie-onderhoud** — nieuwe boeken kunnen nieuwe thema's oproepen; de
  taxonomie is bewust klein en in git, dus uitbreiden is een expliciete keuze.

## Uit scope / later

- ICP-adapter + render-naad (zelfde engine).
- Verfijning ICP-output (score/betrouwbaarheids-meter, funnel-balk, meer lucht).
- "Opnieuw matchen"-actie voor de eindgebruiker.
- Tag-prefilter vervangen/aanvullen met embeddings als de bibliotheek sterk groeit.
