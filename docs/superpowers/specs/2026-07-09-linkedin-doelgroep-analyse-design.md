# LinkedIn doelgroep-analyse — ontwerp

**Datum:** 2026-07-09
**Status:** goedgekeurd ontwerp, klaar voor implementatieplan

## Doel

Een nieuwe module die een geüploade **LinkedIn volgers-export** (Analytics →
Volgers → Exporteren) omzet in een rijkere analyse dan de bestaande
LinkedIn-content-analyse. De module beantwoordt drie vragen:

1. **Doelgroep** — op welke doelgroep (branches + functies + geografie) wil het
   bedrijf zich richten? (invoer van de gebruiker)
2. **Volgers in de doelgroep** — hoeveel / welk percentage van de huidige
   volgers valt in die doelgroep?
3. **Potentieel & penetratie** — hoe groot is de markt (relevante functies in
   de doelgroep op LinkedIn) en welk deel daarvan bereikt het bedrijf al?

## Niet-doelen (YAGNI)

- Geen individuele volgers-identificatie (de export bevat alleen geaggregeerde
  demografie, geen namenlijst).
- Geen geautomatiseerde LinkedIn-toegang (geen scraping, geen API, geen login).
  Het potentieel-getal komt van de gebruiker (Sales Navigator) of vervalt naar
  een kwalitatieve inschatting.
- Geen volwaardige multi-step wizard in v1 (bewust gekozen: variant B). Het
  "stappenplan" is een genummerd instructieblok op de modulepagina.

## Geverifieerde invoer: wat zit er in de export

Bevestigd tegen een echte export (`eclectik-insights_followers_*.xls`). Zes
tabbladen, allemaal geaggregeerde aantallen per dimensie (geen kruistabel):

| Tabblad | Inhoud |
| --- | --- |
| New followers | dagelijkse tijdreeks (sponsored/organic/auto-invited/total) |
| Location | volgers per locatie |
| Job function | volgers per functie (bv. Business Development 48, HR 36) |
| Seniority | volgers per senioriteit (Senior, Director, CXO, …) |
| Industry | volgers per branche — LinkedIn's Engelse taxonomie (73 labels) |
| Company size | volgers per bedrijfsgrootte |

Belangrijke eigenschappen die het ontwerp sturen:

- **Engelse taxonomie:** "maak- & procesindustrie" moet op labels als
  *Household Appliance Manufacturing*, *Pharmaceutical Manufacturing*,
  *Industrial Machinery Manufacturing* worden gemapt. Dit is een semantische
  matching-taak → LLM.
- **Aparte lijsten, geen kruistabel:** Industry en Job function worden
  onafhankelijk geteld. "Maakindustrie én inkoper" is dus een onderbouwde
  schatting, geen exacte doorsnede. De analyse moet dit eerlijk benoemen.
- **Per-dimensie afgerond/onvolledig:** LinkedIn classificeert alleen volgers
  met een ingevuld attribuut en rondt af; de dimensie-totalen verschillen. De
  analyse rekent met "% van de geclassificeerde volgers in dimensie X", niet
  met één schoon totaal.
- **`.xls` (oud binair):** SheetJS (`XLSX.read`) leest dit; onze bestaande
  `xlsxToMarkdown` werkt (getest op het echte bestand). Mime
  `application/vnd.ms-excel` staat al in `MIME_TO_KIND` en de Storage-allow-list.

## Plaatsing & architectuur

Nieuwe module **`linkedin-doelgroep`** ("LinkedIn doelgroep-analyse") op de
bestaande generieke runner (`app/(app)/modules/[slug]`), naast
`linkedin-analyse` (content-analyse). Hergebruikt de volledige keten:
upload → `createFileSnapshot` → `xlsxToMarkdown` → snapshot → generieke runner →
`GenericReportView`.

### Invoer op de pagina

- **Bedrijfsnaam** — bestaand `companyName`-veld.
- **Bron** — `sourceTypes: ["file"]`; upload van de volgers-export.
- **Doelgroep** — het `sector`-veld, herlabeld via `sectorLabel`/
  `sectorPlaceholder` naar "Doelgroep (branches + functies)".
- **LinkedIn-potentieel (optioneel)** — het `description`-veld, herlabeld via
  nieuwe config `descriptionLabel`/`descriptionPlaceholder`, voor het Sales
  Navigator-aantal.
- **Exportstappenplan** — genummerd instructieblok bovenaan de pagina (klikpad
  in LinkedIn), gedreven door een nieuw optioneel config-veld `steps: string[]`
  dat als geordende lijst wordt gerenderd. Modules zonder `steps` tonen niets
  (geen gedragswijziging voor bestaande modules).

### Config-uitbreiding

`GenericModuleConfig` krijgt drie optionele velden: `descriptionLabel` en
`descriptionPlaceholder` (spiegelbeeld van de bestaande `sectorLabel`/
`sectorPlaceholder`), plus `steps: string[]` voor het exportstappenplan. De
generieke pagina (`[slug]/page.tsx`) gebruikt de labels met fallback naar de
huidige beschrijving-labels en rendert `steps` als genummerde lijst wanneer
aanwezig. Puur presentatie, geen logica.

## De analyse (DB-prompt, provider = Claude)

Claude, niet Perplexity: dit is nauwkeurig redeneren over tabellen, geen
web-research. Gevolg: zonder Sales Nav-getal blijft doel 3 kwalitatief.

De prompt (admin-bewerkbaar in de DB, met fallback) produceert:

1. **Doelgroep** — herformuleert de opgegeven doelgroep naar de concrete
   LinkedIn-branche/functie-labels die in de export voorkomen.
2. **Volgers in de doelgroep** — sommeert de matchende branches → aantal + % van
   de geclassificeerde volgers; kruischeck met Job function en Seniority
   (zitten er beslissers tussen?). Benoemt expliciet de schatting-kanttekening.
3. **Potentieel & penetratie** — met Sales Nav-getal: volgers-in-doelgroep ÷
   potentieel = penetratie. Zonder: kwalitatieve inschatting, geen verzonnen
   cijfer.
4. **Extra inzichten** — groeitrend (New followers), geografische fit
   (Location), seniority-mix, bedrijfsgrootte.

Uitvoerregels: Nederlands, B1-niveau, geen verzonnen getallen, eerlijk over wat
de data wél/niet toont. Output volgt het vaste JSON-sectiecontract van de
generieke runner (`GenericReportView`).

## Te bouwen (concreet)

1. `lib/modules/registry.ts` — nieuwe `linkedin-doelgroep`-entry (icoon, kleur,
   status `active`, `href`, `minTier: "fundament"` — later aanpasbaar).
2. `modules/generic/schema.ts` — `linkedin-doelgroep` in `GENERIC_MODULES`
   (`sourceTypes: ["file"]`, `sectorLabel`, `sectorPlaceholder`,
   `descriptionLabel`, `descriptionPlaceholder`, `fileHint`, `steps`); nieuwe
   configvelden `descriptionLabel`/`descriptionPlaceholder`/`steps` op het type.
3. `app/(app)/modules/[slug]/page.tsx` — beschrijving-veld gebruikt de nieuwe
   config-labels; `steps` als genummerde lijst renderen wanneer aanwezig.
4. DB — module-rij `linkedin-doelgroep` (status `active`, provider `claude`) +
   `default_prompt` + `format_example`; prompt-history-log.
5. Tests — promptbouw/config (TDD). De xlsx-parsing is al gedekt.

## Bekende beperkingen (eerlijk in het rapport benoemen)

- Branche × functie is geen kruistabel → doel 2 is een schatting.
- Zonder Sales Nav-getal is doel 3 kwalitatief.
- Demografie dekt alleen volgers met ingevulde attributen; kleine pagina's
  (zoals Eclectik met ~150 volgers) geven ruwe, kleine getallen.

## Teststrategie

- `xlsxToMarkdown` — al getest (7 tests), inclusief `.xls`/CSV en meerdere
  sheets.
- Config/promptbouw — nieuwe assert dat `linkedin-doelgroep` op de generieke
  runner staat met `sourceTypes: ["file"]` en de herlabelde velden.
- De analyse-inhoud is LLM-werk; we testen de promptbouw en de invoer-mapping,
  niet de gegenereerde tekst.
