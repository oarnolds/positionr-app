# Positionr — Spec: ICP v2 (multi-page scrape + admin prompt editor)

**Datum:** 2026-05-04
**Module:** `icp-analyse` v2 — verbetering van slim slice
**Scope:** (a) Multi-page scrape + scherpere prompt voor inhoudelijk betere output. (b) Admin Prompt Editor zodat prompts in DB staan en zonder deploy aanpasbaar zijn.

**Reden:** v1 produceert magere ICPs omdat (1) we maar 2K homepage-tekst meegeven en (2) prompt is generiek. Manus-app scrapet 7 pagina's en heeft veel concretere prompt-instructies. Daarnaast wil je prompts kunnen tweaken zonder code-deploy — dat vereist DB-storage + admin-UI.

**Spec v1:** `docs/superpowers/specs/2026-05-02-icp-slim-slice-design.md`

---

## 1. Architectuur

Twee onafhankelijke verbeteringen, beide raken het systeem maar zijn los te bouwen:

### a) Multi-page scrape + scherpere prompt
- `scraper.ts` probeert meerdere paden parallel (homepage + 6 standaardpaden), filtert op succes, combineert tot max 15K tekens.
- `prompt.ts` krijgt een veel rijkere `buildSystemPrompt()` met:
  - Expliciete principes (outside-in, specifiek > generiek, voorbeelden)
  - Concretere veld-omschrijvingen ("Wat krijgt de klant", niet "Beschrijf het product")
  - Negatieve voorbeelden ("Schrijf NIET: 'zakelijke dienstverlening' — wel: 'MKB-accountantskantoren met 5-30 fte'")
  - Sterkere JSON-formaat-instructie

### b) Admin Prompt Editor
- Bron-van-waarheid voor de prompt verschuift: van **code** (`prompt.ts`) naar **DB** (`modules.defaultPrompt`).
- Bij eerste deploy: seed-script vult DB met de code-prompt zodat niets breekt.
- Service leest prompt **uit DB** in plaats van hardcoded uit `prompt.ts`.
- Admin UI op `/admin/prompts/icp-analyse`:
  - Textarea met huidige DB-prompt
  - "Opslaan" → schrijft naar DB
  - "Reset naar default" → herlaadt uit code (`prompt.ts`)
  - "Test deze prompt" → run met hardcoded testbedrijf, toont resultaat zonder te bewaren (optioneel — pas in v2.1 als blijkt dat nodig)
- Per-sessie override (`sessions.promptOverride`) blijft uit scope; pas wanneer admin-sessies-detail komt.

---

## 2. Bestandswijzigingen

**Wijzigen:**
- `modules/icp-analyse/scraper.ts` — multi-page scraping
- `modules/icp-analyse/prompt.ts` — rijkere system prompt
- `modules/icp-analyse/service.ts` — leest prompt uit DB met fallback naar code
- `lib/db/schema.ts` — al beschikbaar (`modules.defaultPrompt`), geen wijziging
- `lib/modules/registry.ts` — geen wijziging
- `scripts/seed-modules.ts` — voegt ICP-prompt seeding toe

**Nieuw:**
- `app/(admin)/admin/prompts/[slug]/page.tsx` — admin edit-pagina
- `app/(admin)/admin/prompts/[slug]/actions.ts` — `getModulePrompt`, `saveModulePrompt`, `resetModulePrompt`
- `app/(admin)/admin/prompts/[slug]/PromptEditor.tsx` — client component met textarea + knoppen

---

## 3. Multi-page scraper — concreet

```ts
const PAGES_TO_TRY = ["", "/diensten", "/services", "/over-ons", "/about", "/cases", "/referenties"];

async function scrapePage(url: string): Promise<string | null> {
  // fetch met timeout 10s, strip script/style/tags, max 3000 chars
}

export async function scrapeForIcp(baseUrl: string): Promise<WebsiteSnapshot> {
  const base = normalizeUrl(baseUrl).replace(/\/$/, "");
  const urls = PAGES_TO_TRY.map(p => base + p);
  const results = await Promise.allSettled(urls.map(scrapePage));
  
  const pages = results
    .map((r, i) => r.status === "fulfilled" && r.value ? { url: urls[i], text: r.value } : null)
    .filter((x): x is { url: string; text: string } => x !== null);

  if (pages.length === 0) throw new Error(`Geen enkele pagina van ${base} kon worden opgehaald`);

  // combineer: per pagina header met URL, max 15K totaal
  const combined = pages
    .map(p => `=== ${p.url} ===\n${p.text}`)
    .join("\n\n")
    .slice(0, 15_000);

  // Hoofdpagina-velden
  const homepage = pages.find(p => p.url === base);
  return {
    url: base,
    title: homepage?.text.slice(0, 200) ?? "",  // (zwakker dan v1; admin kan na 1e run editen)
    metaDescription: "",  // niet meer nodig — combined bevat genoeg
    heroText: "",
    bodyExcerpt: combined,
    scrapedAt: new Date().toISOString(),
  };
}
```

**Note:** WebsiteSnapshot-shape blijft gelijk (backward-compat). `bodyExcerpt` bevat nu de gecombineerde meertal-pagina output.

---

## 4. Scherpere system prompt — strategie

Belangrijkste toevoegingen t.o.v. v1:

- **Antipatronen** met concrete tegenvoorbeelden:
  > "Schrijf NIET: 'zakelijke dienstverlening' — schrijf WEL: 'MKB-accountantskantoren met 5-30 fte in Randstad'"

- **Voorbeeld-output** als referentie (1 voorbeeld bedrijf voluit ingevuld in de system prompt — wordt gecached, geen extra cost per run).

- **Per-sectie do's en don'ts** — bv. "Een pijnpunt is een PROBLEEM, geen WENS. Niet 'betere rapportages' maar 'rapportages kosten 4 dagen per maand'".

- **Trigger-events** moeten gebeurtenissen zijn: "Nieuwe wetgeving treedt in werking" / "Bedrijf opent nieuwe vestiging" — niet statische pijnpunten.

- **Outside-in framing voor banner.samenvatting**: begin met wat de KLANT wint, niet met wat het bedrijf doet.

Lengte: van ~50 regels naar ~150 regels. Wordt gecached door Anthropic, dus geen kosten-impact per run.

---

## 5. DB-flow voor prompt

**Zonder admin-edit (initial state):**
- `modules.defaultPrompt` is leeg (`""`) na huidige seed.
- Service-flow: leest DB → leeg → fallback naar `buildSystemPrompt()` uit `prompt.ts`.

**Met seed-update:**
- Update `scripts/seed-modules.ts` zodat `defaultPrompt` voor `icp-analyse` ingevuld wordt met de code-prompt.
- Run `pnpm tsx scripts/seed-modules.ts` na deploy → DB is in sync met code.

**Na admin-edit:**
- `modules.defaultPrompt` bevat de aangepaste prompt.
- Service leest DB-prompt direct.
- "Reset naar default" knop in admin: kopieert `buildSystemPrompt()` (code) naar DB → herstelt code-versie.

**Code:**

```ts
// modules/icp-analyse/service.ts (gewijzigd)
async function getEffectiveSystemPrompt(): Promise<string> {
  const [m] = await db.select({ defaultPrompt: modules.defaultPrompt })
    .from(modules)
    .where(eq(modules.slug, MODULE_SLUG))
    .limit(1);
  if (m?.defaultPrompt && m.defaultPrompt.length > 50) {
    return m.defaultPrompt;
  }
  return buildSystemPrompt();
}
```

User-prompt (per-run, met klant-data) blijft altijd uit code (`buildUserPrompt`) — die is data-afhankelijk en niet zinvol om in DB te zetten.

---

## 6. Admin UI

### Pagina `/admin/prompts/icp-analyse` (en in toekomst andere slugs)

```
┌─────────────────────────────────────────┐
│  ← Admin                                 │
│  Prompts: Ideale Klant (ICP) Analyse    │
├─────────────────────────────────────────┤
│  System Prompt                           │
│  ┌───────────────────────────────────┐  │
│  │ <textarea, monospace, 25 rows>    │  │
│  │                                    │  │
│  │                                    │  │
│  └───────────────────────────────────┘  │
│  Tekens: 4321                            │
│                                          │
│  [Opslaan]  [Reset naar default]         │
└─────────────────────────────────────────┘
```

**Toegang:** alleen admin-rol (check via `profiles.role === 'admin'`). Niet-admin → 404 (al bestaande pattern in `app/(admin)/layout.tsx`).

**Mooie-to-have (v2.1):** "Test prompt"-knop met hardcoded testbedrijf → runt analyse → toont output zonder DB-write.

**Out-of-scope nu:**
- Versiehistorie van prompts
- Per-sessie prompt-override UI
- Diff-view vs. default

---

## 7. Acceptance criteria

Na implementatie moet werken:

1. Form-flow blijft hetzelfde (geen UI-changes voor gewone gebruiker).
2. Een nieuwe ICP-run scrapet meerdere pagina's en bevat duidelijk meer context. Verifieerbaar via `bodyExcerpt`-lengte in DB (>5K tekens voor goed-gevulde sites).
3. Output-kwaliteit voelbaar beter: concretere pijnpunten, specifiekere firmografische waarden, betere samenvatting. (Subjectief — door gebruiker te beoordelen.)
4. `/admin/prompts/icp-analyse` toont huidige system prompt in textarea.
5. Edit + Opslaan → volgende run gebruikt aangepaste prompt.
6. Reset → DB-prompt vervangen door code-default; volgende run gebruikt die.
7. Niet-admin gebruikers krijgen 404 op admin-pagina.
8. Bestaande sessies (v1) blijven correct renderen — geen schema-breukmaak.

---

## 8. Out of scope

| Feature | Wanneer |
|---|---|
| Webform-fase 2 (gestructureerde gebruikersinput) | Module v3 (volgende grote slag) |
| Rijker output-schema (heroTekst, marketingVertaalslag, volgendStappen) | Met v3 of als losse spec |
| Per-sessie prompt-override UI | Wanneer admin-sessies-detail komt |
| Prompt-versie historie | Later, als we meerdere mensen prompts laten editen |
| "Test deze prompt"-knop in admin | v2.1 als blijkt dat nodig |
| Andere modules' prompt-editors (alle 11) | Generiek pattern werkt al via `[slug]`, maar alleen ICP heeft nu een prompt om te editen |
