# Website Check module — ontwerp (v1)

- **Datum:** 2026-05-19
- **Status:** Goedgekeurd (ontwerp), klaar voor implementatieplan
- **Repo:** `oarnolds/positionr-app` (Next.js App Router, Supabase, Drizzle, Claude)

## 1. Doel & context

Bouw de **Website Check**-module: een gebruiker laat zijn B2B-website analyseren
(waardepropositie, CTA's, content, verbeterpunten) en krijgt het resultaat **op
het scherm** gepresenteerd — zoals ICP-analyse, **geen PDF**.

Referentie-implementatie: `oarnolds/manus-positionr2` (andere stack: Vite SPA +
Express + tRPC). We porten de **logica/analyse**, niet de code, en passen de
output aan naar een schermweergave.

Bredere visie (apart, later): bij eerste login een gedeeld profiel per gebruiker
vastleggen dat álle modules voedt; cumulatief klantbeeld; Core → Growth
abonnement met uitbreidingsmodules. v1 legt hiervoor alleen de **naad** (een
minimaal gedeeld profiel), niet het hele systeem.

## 2. Scope

**In v1:**
- Eén eigen bedrijf per gebruiker (geen multi-client/agency-model)
- Per-gebruiker bedrijfsprofiel via **bestaande `profiles`-velden**
  (`companyName`, `websiteUrl`) — geen nieuwe tabel
- Getrouwe port van de Manus-analyse (11 onderdelen, scores 1-10, overall,
  samenvatting, sterk/verbeter, top-5 acties)
- Schermpresentatie (hybride: één scrolbaar rapport + prominente score +
  kleur-gecodeerde scores)
- Sessie-historie per gebruiker
- Deelbare publieke read-only resultaatlink (`shareSlug`)
- Herlaad/hergenereer → nieuwe sessie = versie (niets overschrijven)

**Buiten v1 (later, aparte specs):**
- `website-check-concurrenten`-variant
- Globale onboarding-flow bij eerste login
- Abonnement/entitlements (Core/Growth) + uitbreidingsmodule-framework
- Async/polling voor de analyse (v1 = synchroon met laadindicator)
- Koppeling prompt aan admin "Prompts"-editor / `modules.default_prompt`
- Auto-retry bij LLM/parse-fouten

## 3. Architectuur

Spiegelt de bestaande ICP-analyse-module 1-op-1.

**`modules/website-check/`**
- `schema.ts` — Zod: input (`websiteUrl`, `companyName?`) + output (zie §7)
- `prompt.ts` — system + user prompt (getrouwe port uit Manus; prompt in code,
  net als `modules/icp-analyse/prompt.ts`)
- `scraper.ts` — server-side fetch → leesbare tekst, ~6000 tekens
- `service.ts` — `createSession`, `runAnalysis`, `getSession`, `listSessions`,
  `regenerate`
- `components/WebsiteCheckResultView.tsx` — schermpresentatie (herbruikt voor
  ingelogde resultaatpagina én publieke deellink)

**`app/(app)/modules/website-check/`**
- `page.tsx` — URL-invoer (voor-ingevuld uit profiel) + historie (vervangt de
  huidige placeholder)
- `actions.ts` — server actions (analyseren, hergenereren, profiel lezen/opslaan)
- `[sessionId]/page.tsx` — resultaat + "Opnieuw analyseren" + "Deel"

**`app/r/[shareSlug]/page.tsx`** — publieke, auth-loze read-only resultaatroute

**Datamodel:**
- **Geen nieuwe tabel.** Het per-gebruiker bedrijfsprofiel = bestaande
  **`profiles`**-velden `companyName` + `websiteUrl` (al aanwezig; `profiles`
  is al 1-op-1 met `auth.users` en heeft RLS "users update own profile").
  Eerste gebruik = eigen `profiles`-rij bijwerken; voor-invullen leest daaruit.
- **Hergebruik `sessions`**: per run één rij — `userId`, `moduleSlug =
  'website-check'`, `clientId/productId = NULL`, `input = {websiteUrl,
  companyName}`, `output = ` analyse-JSON. `status` gebruikt de **bestaande
  `sessionStatus`-enum** (`draft·running·review·approved·failed`):
  `running` tijdens analyse → **`approved`** bij succes → **`failed`** bij
  fout. `shareSlug` bij aanmaak gegenereerd; telemetrie
  (`llmModel/llmInputTokens/llmOutputTokens/llmCostCents`) + `promptUsed`
  uit `analyzeWithCachedSystem`; `errorMessage`, `completedAt`.
- Geen schema-migratie nodig (geen nieuwe tabel/kolom; `sessions` en
  `profiles` bestaan al). Geen nieuwe RLS nodig (bestaande profiel- en
  sessie-RLS dekken het).

## 4. User-flow

1. **Eerste gebruik** — `profiles.websiteUrl` leeg → kort formulier
   (bedrijfsnaam + website-URL) dat de eigen `profiles`-rij bijwerkt, eenmalig.
   Al ingevuld → URL voor-ingevuld uit `profiles`.
2. **Startpagina** — URL-veld (aanpasbaar) + knop "Analyseer website" +
   historie-lijst (datum · URL · overall score).
3. **Analyse** — submit → `sessions`-rij (`status=running`) → redirect naar
   `[sessionId]` met "Bezig met analyseren…"-staat. Server: scrape → Claude →
   output opslaan (`approved`) of `failed`. Synchroon met laadindicator.
4. **Resultaat** (`[sessionId]`) — hybride weergave + "Opnieuw analyseren"
   (nieuwe sessie/versie) + "Deel" (kopieer `shareSlug`-link).
5. **Deellink** — `/r/[shareSlug]`: zelfde weergave, read-only, geen auth/knoppen.
6. **Historie/versies** — alle runs chronologisch; hergenereren = extra versie.

## 5. AI-analyse

- **Scrape** (`scraper.ts`): URL normaliseren (https:// prefix), server-fetch
  (normale UA + time-out ~10-15s), HTML → leesbare tekst (scripts/styles/nav
  eruit), afkappen ~6000 tekens. Faalt → sessie `failed` + `errorMessage`.
- **AI** via bestaande `lib/ai/claude.ts` → `analyzeWithCachedSystem({ system,
  user, schema })`:
  - `system` = port Manus system-prompt ("expert in B2B website analyse en
    conversie-optimalisatie", Nederlands, gestructureerd) — stabiel →
    prompt-caching.
  - `user` = port Manus user-prompt: bedrijfsnaam, URL, scraped content, de 11
    onderdelen + overall + samenvatting + top-3 sterk + top-3 verbeter + top-5
    acties (impact hoog/middel/laag).
  - `schema` = Zod (zie §7); helper valideert + geeft typed data + tokengebruik.
- Opslaan: succes → `output`, `status=approved`, `completedAt`, telemetrie +
  `promptUsed` (uit `analyzeWithCachedSystem`). Fout/parse-fail →
  `status=failed`, `errorMessage`. Geen auto-retry in v1.

## 6. Resultaatpresentatie (hybride — goedgekeurd)

Eén component `WebsiteCheckResultView` (ingelogd + publiek hergebruikt):
- **Hero**: prominente overall score (ring, kleur-gecodeerd) + bedrijf/URL +
  executive summary.
- **11 onderdelen**: één scrollijst; elk: naam, score-badge (kleur: rood <5,
  amber 5-7, groen >7) + score-balk + toelichting + verbeterpunten (alles
  zichtbaar, geen klik-uitklap → deel/print-vriendelijk).
- **Top-3 sterke punten / Top-3 verbeterpunten**: twee kolommen (groen/amber).
- **Top-5 acties**: geordende lijst met impact-badge (HOOG/MIDDEL/LAAG,
  kleur-gecodeerd) + toelichting.
- Knoppen "Opnieuw analyseren" + "Deel" alleen op de ingelogde pagina; op
  `/r/[shareSlug]` weggelaten.
- Consistent met app-thema (paars/blauw) en `components/module-result/*`-stijl.

## 7. Output-schema (Zod = getrouwe port Manus `websitecheck_analysis`)

```
{
  companyName: string,
  websiteUrl: string,
  overallScore: number,            // 1-10 (gemiddelde)
  executiveSummary: string,        // 2-3 zinnen
  onderdelen: Array<{              // exact 11 stuks
    naam: string,
    score: number,                 // 1-10
    toelichting: string,
    verbeterpunten: string[]
  }>,
  sterkePunten: string[],          // top 3
  verbeterpunten: string[],        // top 3
  topActies: Array<{               // top 5, gesorteerd op prioriteit
    actie: string,
    impact: "hoog" | "middel" | "laag",
    toelichting: string
  }>
}
```

De 11 onderdelen (vaste volgorde): 1 Waardepropositie · 2 Klantvoordelen ·
3 Diensten/Features · 4 Proces · 5 Bewijsvoering · 6 Klantcases · 7 CTA's ·
8 Content · 9 Schrijfstijl · 10 Actualiteit · 11 Contactpagina.

## 8. Delen (publieke read-only link)

- `shareSlug` (onraadbare random hex) bij sessie-aanmaak gegenereerd; kolom
  bestaat al (`sessions.shareSlug`, unique).
- `app/r/[shareSlug]/page.tsx`: server-component leest sessie via drizzle `db`
  (postgres-rol, omzeilt RLS) **strikt op `shareSlug`**, **alleen
  `status=complete`**, rendert `WebsiteCheckResultView` read-only.
- Alleen veilige velden (geen `userId`, telemetrie, `promptUsed`). Pagina
  `noindex`. Capability-URL = toegangsmodel.

## 9. Foutafhandeling

Alle fouten → sessie `status=failed` + `errorMessage`; resultaatpagina toont
vriendelijke melding + "Opnieuw / andere URL". Gevallen: ongeldige/onbereikbare
URL, scrape-fout/lege content, LLM-fout, Zod-parse-fout, time-outs. Telemetrie/
kosten worden per sessie vastgelegd (kolommen bestaan). Geen auto-retry in v1.

## 10. Tests (TDD bij implementatie)

- Unit `scraper.ts`: URL-normalisatie, HTML→tekst, faalgevallen.
- Unit Zod-schema: geldige/ongeldige LLM-output.
- Service `runAnalysis`: gemockte scraper + Claude-helper → assert
  sessie-overgangen (running→complete met output / →error).
- Volgt bestaande testopzet; ontbreekt die → minimale vitest voor deze units.

## 11. Open/uitgesteld

Concurrenten-variant · globale onboarding · abonnement/Growth-tiering ·
uitbreidingsmodule-framework · async/polling · admin-prompt-editor-koppeling ·
auto-retry. Elk later, eigen spec.
