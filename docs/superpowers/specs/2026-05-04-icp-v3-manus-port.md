# Positionr — Spec: ICP v3 (Manus-replica port)

**Datum:** 2026-05-04
**Module:** `icp-analyse` v3 — port van olivier-arnolds/positionr (Manus-app)
**Scope:** Functionele 1-op-1 port van de ICP-flow uit Manus naar onze Next.js+Supabase stack. Layout/styling vrij — wij doen het mooier.

**Reden:** v1/v2 bouwde een vereenvoudigde versie. Echte UX die je wilt is: productcatalogus → modus-keuze (snel/volledig) → rijke resultaat-pagina. Dit spec vangt die volledig.

**Bron:** https://github.com/olivier-arnolds/positionr (publiek, sectoren `server/icpService.ts`, `server/icpDb.ts`, `client/src/pages/Icp*.tsx`).

---

## 1. Fasering

| Fase | Inhoud | Wanneer |
|---|---|---|
| **B1** | Productcatalogus + Snel-flow + rijke FinalIcp result-pagina | Deze sessie |
| **B2** | Volledige flow: Phase 1 review-pagina + webform 11 vragen → FinalIcp | Volgende sessie |
| **B3** | Edit per sectie + deelbare link + voorbeeldprospects (Perplexity) | Later |

Deze spec dekt **B1 in detail** + B2/B3 op hoofdlijn.

---

## 2. Architectuur

### Data-laag

**Nieuwe tabel: `icp_products`** (per klant; vervangt onze huidige "1 product per analyse"-input).

```ts
icpProducts = pgTable("icp_products", {
  id: uuid().primaryKey().defaultRandom(),
  clientId: uuid().notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  websiteUrl: text(),                   // optioneel — fallback naar clients.websiteUrl
  prominentie: text(),                  // 'hoog' | 'middel' | 'laag'
  createdAt, updatedAt,
});
```

RLS: gebruiker ziet alleen producten van eigen klanten (via `clients.userId`).

**Bestaande `sessions` tabel uitbreiden met `productId`:**

```ts
productId: uuid().references(() => icpProducts.id, { onDelete: "cascade" }),
```

**Sessions JSONB-shapes per moduletype** (icp-analyse):
- `sessions.input` = `{ productId, analysisMode, snapshot }`
- `sessions.output` = `{ phase1Output, webformAnswers, finalIcp, betrouwbaarheid, positionering }` — velden die nog niet ingevuld zijn = `null`.

`sessions.status` blijft enum `running | review | approved | failed`. Status-mapping:
- `running` = bezig met analyse (Phase 1 of Phase 3)
- `review` = Phase 1 klaar, wacht op user-input (Volledig-flow)
- `approved` = FinalIcp gegenereerd
- `failed` = ergens fout

**Voorzieningen voor cross-module hergebruik (`clients.facts`):**
Promote bij `approved`-status FinalIcp naar `clients.facts.icp[]` zoals voorheen, plus `website_snapshot` voor cache (al bestaand pattern).

### Service-laag

```
modules/icp-analyse/
├── schema.ts                 # zod: Phase1Output, WebformAnswers, FinalIcp, IcpProduct
├── prompt.ts                 # buildScanProductsPrompt, buildPhase1Prompt, buildFinalIcpPrompt
├── scraper.ts                # multi-page (al klaar in v2 — bewaren)
├── service.ts                # orchestrators: runSnelMode, runFullPhase1, runFullPhase3
└── components/
    ├── ProductCatalog.tsx    # B1 — catalog page client component
    ├── ScanWebsiteForm.tsx   # B1 — top scan-blok
    ├── ProductCard.tsx       # B1 — product list item met "ICP Analyse"-knop
    ├── ProductFormDialog.tsx # B1 — handmatig toevoegen/bewerken
    ├── ModeSelector.tsx      # B1 — snel vs volledig keuze
    └── result/
        ├── FinalIcpView.tsx  # B1 — FinalIcp render (banner, blokken)
        ├── Phase1ReviewView.tsx  # B2 — Phase 1 review
        └── WebformWizard.tsx     # B2 — 11-stap vragenlijst
```

### Routes

```
app/(app)/modules/icp-analyse/
├── page.tsx                       # B1 — productcatalogus (vervangt huidige input form)
├── actions.ts                     # B1 — server actions
├── [productId]/
│   ├── page.tsx                   # B1 — modus-keuze + run-history voor dit product
│   ├── snel/[sessionId]/page.tsx  # B1 — Snel-resultaat (FinalIcp)
│   ├── volledig/[sessionId]/
│   │   ├── phase1/page.tsx        # B2 — Phase 1 review
│   │   ├── webform/page.tsx       # B2 — webform wizard
│   │   └── profiel/page.tsx       # B2 — final result (zelfde als Snel)
```

### LLM-flow

Anthropic heeft geen `response_format: json_schema strict` zoals OpenAI. Wij valideren post-hoc met zod + duidelijke prompt-instructies. Reeds gedaan in `lib/ai/claude.ts` (analyzeWithCachedSystem). Werkt prima.

Drie LLM-calls in totaal:
1. **`scanProductsFromWebsite`** (input: scraped content) → `{ producten: [{naam, beschrijving, prominentie}] }`
2. **`analyzePhase1`** (input: scraped content) → `Phase1Output`
3. **`generateFinalIcp`** (input: Phase1Output + WebformAnswers + companyName) → `FinalIcp`

System prompts gecached door Anthropic — na eerste call ~10x goedkoper voor cache-reads.

---

## 3. Schema's (zod) — exacte port van Manus

```ts
// modules/icp-analyse/schema.ts

export const Prominentie = z.enum(["hoog", "middel", "laag"]);
export type Prominentie = z.infer<typeof Prominentie>;

export const ScannedProduct = z.object({
  naam: z.string(),
  beschrijving: z.string(),
  prominentie: Prominentie,
});
export const ScannedProducts = z.object({ producten: z.array(ScannedProduct) });

export const Phase1Output = z.object({
  diensten: z.array(z.object({
    naam: z.string(),
    prominentie: Prominentie,
    beschrijving: z.string(),
  })),
  primaire_doelgroep: z.object({
    sector: z.string(),
    subsector: z.string(),
    bedrijfsgrootte: z.string(),
    functietitels: z.array(z.string()),
    geografische_focus: z.string(),
  }),
  pijnpunten: z.array(z.string()),
  usp: z.string(),
  klantvoorbeelden: z.array(z.string()),
  trigger_events: z.array(z.string()),
  tone_of_voice: z.string(),
  betrouwbaarheid_score: z.number().min(0).max(100),
  ontbrekende_informatie: z.array(z.string()),
  icp_inschatting: z.object({
    industrieen: z.array(z.string()),
    bedrijfsgrootte: z.array(z.string()),
    kernprocessen: z.array(z.string()),
    dmu: z.array(z.object({
      rol: z.string(),
      invloed: z.enum(["beslisser", "beïnvloeder", "gebruiker"]),
    })),
    samenvatting: z.string(),
  }),
});

export const WebformAnswers = z.object({
  sectoren: z.array(z.object({ hoofdsector: z.string(), subsector: z.string() })),
  bedrijfsgrootte: z.array(z.string()),
  contactfunctie: z.string(),
  beslisser: z.string(),
  zelfdePersoon: z.boolean(),
  pijnpunt: z.string(),
  triggers: z.array(z.string()),
  strategischeDienst: z.string(),
  contractwaarde: z.string(),
  idealeKenmerken: z.array(z.string()),
  dealbreakers: z.array(z.string()),
  vindkanalen: z.array(z.object({ kanaal: z.string(), prioriteit: z.number() })),
  usp: z.string(),
  eigenBeschrijving: z.string().optional(),
});

export const FinalIcp = z.object({
  heroTekst: z.string(),
  firmografisch: z.object({
    sector: z.string(),
    subsector: z.string(),
    bedrijfsgrootte: z.array(z.string()),
    contactfunctie: z.string(),
    beslisser: z.string(),
    contractwaarde: z.string(),
    vindkanalen: z.array(z.string()),
  }),
  pijnpuntenTriggers: z.object({
    pijnpunt: z.string(),
    triggers: z.array(z.string()),
  }),
  usp: z.string(),
  dienstFocus: z.object({
    dienst: z.string(),
    contractwaarde: z.string(),
    icpMatch: z.string(),
  }),
  negatieveIcp: z.object({
    dealbreakers: z.array(z.string()),
    disqualificatievraag: z.string(),
  }),
  marketingVertaalslag: z.object({
    kanalen: z.array(z.object({
      kanaal: z.string(),
      prioriteit: z.string(),
      reden: z.string(),
    })),
    kernboodschap: z.object({
      bewustwording: z.string(),
      overweging: z.string(),
      beslissing: z.string(),
    }),
    contentAanbevelingen: z.object({
      artikel: z.string(),
      linkedin: z.string(),
      email: z.string(),
    }),
  }),
  volgendStappen: z.array(z.string()),
  positionering: z.enum(["verticaal", "horizontaal"]),
});
```

---

## 4. B1: Snel-flow stappen

### Pagina 1: Catalogus `/modules/icp-analyse`

- **Klant-kiezer** (zoals nu): selecteer bestaande klant of maak nieuwe.
- **Scan-blok** (zoals Manus screen 1): textinput met website-URL + "Scan website"-knop. Server action `scanWebsiteForProducts(clientId, url)` scrapet, stuurt naar Claude, krijgt `{producten: [...]}`, slaat als rows in `icp_products` op (replace-or-append: optie 1 = "vervang catalogus", optie 2 = "voeg toe" — start met option 2: append).
- **Catalogus-lijst** (kaarten):
  - Per `icp_products`-rij: naam + prominentie-badge + beschrijving + "ICP Analyse"-knop + edit/delete-iconen.
- **Handmatig toevoegen-knop** → dialog met form (naam, beschrijving, prominentie).

### Pagina 2: Modus-keuze `/modules/icp-analyse/[productId]`

- Bovenaan: product-card (read-only context).
- Twee grote cards: "Snelle analyse" / "Volledige analyse" (radio-keuze).
- Onder: "Eerdere analyses" lijst voor dit product (optioneel — nice-to-have, kan ook in B2).
- CTA: "Analyse starten".
- Bij Snel: server action `startSnelAnalysis(productId)` → scrape → Phase 1 → met empty webform-defaults Phase 3 → redirect naar `/modules/icp-analyse/[productId]/snel/[sessionId]`.
- Bij Volledig: redirect naar `/modules/icp-analyse/[productId]/volledig/[sessionId]/phase1` (B2).

### Pagina 3: Snel-resultaat `/modules/icp-analyse/[productId]/snel/[sessionId]`

- Status-routing: `running` → polling spinner; `failed` → error-state; `approved` → `<FinalIcpView>`.
- `<FinalIcpView>` rendert `FinalIcp` met blokken:
  - **Banner** (heroTekst, positionering-pill, betrouwbaarheid-pill)
  - **"Waarom kiezen klanten voor ons?"** (USP-blok, paars)
  - **Firmografisch profiel** (label/value table, blauw)
  - **Pijnpunten & Triggers** (primair pijnpunt + triggers chips, oranje)
  - **Dienst/Product Focus** (dienst + contractwaarde + icpMatch, groen)
  - **Negatieve ICP** (dealbreakers chips + disqualificatievraag, rood)
  - **Marketing-vertaalslag** (kanalen-tabel + 3-step funnel boodschap + content-aanbevelingen)
  - **Volgende stappen** (lijst)

In B1: geen edit-iconen, geen share-link, geen voorbeeldprospects (B3).

---

## 5. B2 vooruitblik (Volledige flow)

`/modules/icp-analyse/[productId]/volledig/[sessionId]/phase1`:
- Toont Phase 1 output exact zoals Manus screen 4: betrouwbaarheidsbalk + ontbrekende info + diensten + primaire doelgroep + pijnpunten + USP + DMU.
- CTA's: "Ja, dit klopt — Ga naar vragenlijst" of "Aanpassen in vragenlijst".

`/modules/icp-analyse/[productId]/volledig/[sessionId]/webform`:
- Multi-step wizard met 11 vragen (sectoren, bedrijfsgrootte, contact/beslisser, pijnpunt, triggers, strategische dienst, contractwaarde, ideale kenmerken, dealbreakers, vindkanalen, USP).
- Auto-save per stap (`saveWebformAnswers`).
- Eind-CTA: "Genereer ICP-profiel" → server action `runFullPhase3` → redirect naar `/profiel`.

`/modules/icp-analyse/[productId]/volledig/[sessionId]/profiel`:
- Zelfde `<FinalIcpView>` als Snel-flow.

---

## 6. B3 vooruitblik

- **Edit per sectie**: potlood-iconen → inline textarea → server action `updateFinalIcpSection(sessionId, sectionKey, newValue)`.
- **Deelbare link**: `slug`-veld op `sessions` (random hex), `/icp/profiel/[slug]` als public route (geen auth check).
- **Voorbeeldprospects**: Perplexity-API call op basis van firmografisch profiel → 10 lookalikes met citaties.

---

## 7. Migratie / breaking changes

- Huidige v1/v2 ICP heeft één-product-input via form. Wordt vervangen door catalog-flow.
- Bestaande sessies (zonder `productId`) blijven werken voor read (legacy resultaatpagina blijft routes `/modules/icp-analyse/[id]` op id-uuid match).
- Nieuwe routes gebruiken `[productId]` segment (uuid van icp_products).

Zorg dat huidige resultaat-URL's blijven werken voor de paar test-sessies die er staan. Voorlopig: laat `/modules/icp-analyse/[id]/page.tsx` bestaan als legacy fallback (id is uuid van `sessions`).

---

## 8. Out of scope (B1)

- Volledig flow (Phase 1 review + webform) → B2
- Edit, share, voorbeeldprospects → B3
- Per-sessie prompt override (admin) — uit huidige v2-plan, kunnen we later weer oppakken
- Admin prompt editor — niet meer kritisch nu schema's strict zijn

---

## 9. Acceptance criteria B1

1. Login → `/modules/icp-analyse` toont catalog-pagina (lege staat als nog geen producten).
2. Klant kiezen, website-URL plakken, "Scan website" klikken → na ~10s verschijnen 3-12 producten als kaarten.
3. Handmatig product toevoegen via dialog → verschijnt in catalogus.
4. Per kaart: edit (dialog) en delete (confirm).
5. "ICP Analyse"-knop op kaart → modus-keuze pagina.
6. "Snelle analyse" + Start → na ~15-30s redirect naar resultaat-pagina met 8 secties gevuld (banner, USP-blok, firmografisch, pijnpunten/triggers, dienstFocus, negatieveIcp, marketingVertaalslag, volgendStappen).
7. DB-state: `icp_products`-row + `sessions`-row (status `approved`) + `clients.facts.icp[]` bevat de FinalIcp.
8. Re-run binnen zelfde product werkt — nieuwe `sessions`-row, oude blijft staan.
9. Volledige analyse-knop → toont "Komt in volgende fase" placeholder OF redirect naar phase1-pagina (B2-werk; voor B1 mag placeholder).
