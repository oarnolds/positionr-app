# Model-vergelijking voor image-descriptions — ontwerp

- **Datum:** 2026-08-07
- **Module:** markdown (nieuwe sub-pagina) + `lib/scraping/image-description`
- **Status:** ontwerp goedgekeurd, klaar voor implementatieplan

## Doel

Empirisch meten hoeveel goedkoper Haiku 4.5 en Fable 5 zijn dan het huidige
Sonnet 4.6 voor het beschrijven van images uit een website-scrape, en of de
kwaliteit voldoende blijft. Basis voor de latere beslissing of Sonnet blijvend
vervangen kan worden in de standaard-snapshot-flow.

## Achtergrond

Fourtop.nl-snapshot kost ~$2 aan Claude Vision (Sonnet 4.6, 150 images × 8
batches). Ruwe schatting: Haiku 4.5 zou ~3x goedkoper zijn. Zonder testrun
weten we niet of de kwaliteit voldoende is voor image-labels als
`[Logo: Fourtop]`, `[Foto: kantoor]`, `SKIP`.

## Scope

**Wel:**
- Nieuwe pagina `/modules/markdown/vergelijk` met URL-input.
- Backend fetcht pages 1x, verzamelt max 150 unieke images (dezelfde cap als
  reguliere snapshot), stuurt die parallel naar 3 modellen: Haiku 4.5,
  Opus 5, Fable 5.
- Per model wordt gemeten: totale wall-clock, totale kost (input+output
  tokens × PRICING), aantal images ok/failed, batches ok/failed.
- Resultaat side-by-side in 3 kolommen: kost + tijd + tabel met de eerste 10
  unieke images (uit de dedupe-volgorde) waarin per rij de image-thumbnail
  staat plus de drie beschrijvingen (Haiku/Opus/Fable) naast elkaar — zo kan
  je kwaliteit visueel vergelijken.
- Uitbreiding `lib/scraping/image-description.ts`:
  - `describeImageBuffers` en `describeImageUrls` krijgen optionele
    `model?: string` parameter (default = huidige `PRICING.claude.model`).
  - Return-type breidt uit met `usage: { inputTokens, outputTokens }` +
    `costCents` per call.
- Uitbreiding `lib/ai/pricing.ts` met entries voor Haiku 4.5, Opus 5, Fable 5.

**Niet (YAGNI):**
- Geen DB-migratie of persistentie van vergelijkings-runs. Pagina toont
  alleen live het resultaat van de huidige run. Wil je later vergelijken:
  screenshot maken of opnieuw draaien.
- Geen wijziging aan de bestaande snapshot-creation flow. Sonnet 4.6 blijft
  default. Deze pagina raakt alleen zijn eigen code-pad.
- Geen A/B-test-infrastructuur, geen model-preference-opslag per user, geen
  admin-toggles. Puur een handmatige compare-tool.
- Geen image-download re-use tussen modellen: elk model krijgt zijn eigen
  batch-aanroep, images zelf worden 1x gedownload (in-memory).

## Architectuur

```
form op /modules/markdown/vergelijk
    ↓ POST server action
runComparison(url):
    ├── urlToMarkdown(url) — 1x, alleen om images op te halen
    ├── verzamel unique images (max 150)
    ├── download alle images 1x → Buffer[] (in-memory)
    └── Promise.all([
          describeImageBuffers(buffers, { model: "claude-haiku-4-5-20251001" }),
          describeImageBuffers(buffers, { model: "claude-opus-5" }),
          describeImageBuffers(buffers, { model: "claude-fable-5" })
        ])
    ↓
Resultaat-object per model: { model, costCents, wallClockMs, imagesOk,
                              imagesFailed, sampleDescriptions[] }
    ↓
Render als 3 kolommen naast elkaar
```

## Componenten

- **`lib/scraping/image-description.ts`** — model-parameter toevoegen,
  usage/cost tracking uit API-response halen, per-call totalen retourneren.
- **`lib/ai/pricing.ts`** — 3 nieuwe model-entries.
- **`app/(app)/modules/markdown/vergelijk/page.tsx`** — server component met
  form + resultaat-rendering. `maxDuration = 300` (Vercel Hobby max).
- **`app/(app)/modules/markdown/vergelijk/actions.ts`** — server action die
  de vergelijking runt en resultaat teruggeeft (via redirect + query-params
  of via een tijdelijke in-memory session/cookie — TBD in implementatieplan).

## Foutafhandeling

- Één model faalt: de andere twee tonen we alsnog. Gefaald model krijgt een
  duidelijke error-status in zijn kolom.
- Alle modellen falen: rood-vlak met foutmelding + suggestie "check API-key".
- `urlToMarkdown` faalt (site down): rood-vlak op de vergelijkpagina.
- Vercel-timeout: bij zeer trage runs kan de 300s-cap alsnog raken (150
  images × 3 modellen — theoretisch kan één model in serie ~60s duren). Als
  het probleem in de praktijk optreedt vervolgens image-cap voor deze
  pagina verlagen naar 50-75.

## Kost per test-run

Ruw geschat (150 images):
- Haiku 4.5: ~$0.40
- Opus 5: ~$3-4 (hoogste, dominante kostenpost)
- Fable 5: ~$2-3 (schatting, exacte pricing bij implementatie te bevestigen)
- **Totaal per klik op de vergelijk-knop: ~$5-8**

Dit is intentioneel — de tool is bedoeld om éénmalig te draaien per URL, niet
om herhaald te gebruiken.

## Testen

- Unit: nieuwe `costCents` berekening in image-description.ts (input-tokens
  × price / 1M + output-tokens × price / 1M, afgerond op cent).
- Integratie: geen mocked LLM calls in tests voor de vergelijk-pagina zelf;
  handmatig testen via de UI op een echte URL.
