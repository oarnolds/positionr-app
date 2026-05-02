# Positionr — Spec: ICP-module (slim slice) + klant-hub

**Datum:** 2026-05-02
**Module:** `icp-analyse` (eerste werkende module in greenfield app)
**Scope:** Slim slice — basisvariant + foundation voor cross-module data

---

## 1. Doel

Een werkende ICP-analyse die:
- Een gebruiker laat starten vanuit één klant-context (bedrijfsnaam + website + hoofdproduct)
- De website scrapet, naar Claude Sonnet 4.6 stuurt, gevalideerde JSON terugkrijgt
- Het resultaat toont in 4 secties (banner, firmografisch, pijnpunten/triggers, dienst-focus)
- De output zowel als auditspoor (`sessions`) als canonieke staat (`clients.facts`) opslaat — zodat toekomstige modules deze kennis kunnen hergebruiken

**Niet in deze slice** (komt later): productcatalogus-flow, volledige analyse met vragenlijst, edit per sectie, deelbare link, voorbeeldprospects (lookalikes), negatieve ICP-blok, "Waarom kiezen klanten"-blok, Perplexity-integratie.

---

## 2. Architectuur — klant-hub model

Twee laagjes per klant:

**Laag 1 — Auditspoor (`sessions` tabel, bestaat al)**
Elke module-run is een rij. Volledige historie blijft staan. Bevat input, prompt-used, output, telemetrie (model, tokens, kost), status, errorMessage.

**Laag 2 — Canonieke staat (`clients.facts` JSONB, nieuw)**
Per klant één plek voor "wat weten we nu over dit bedrijf". Wordt gevuld door module-runs. Andere modules lezen hieruit als context.

```
clients.facts shape:
{
  "website_snapshot": { url, title, metaDesc, heroText, scrapedAt },
  "icp": [
    { product, sessionId, output, runAt, supersedes? }
    // array; meerdere producten naast elkaar
  ],
  // toekomst: propositie, klantcases, linkedin_analyse, etc.
}
```

**Strategie bij tweede run** (UX-keuze, zie §6):
Bij een tweede run binnen dezelfde klant + module krijgt de gebruiker een dialog met drie opties:

1. **Vervangen** — run 2 corrigeert run 1. `facts.icp` wordt vervangen voor dat product. Beide runs blijven in `sessions`.
2. **Versie over tijd** — run 2 is een nieuwere versie. `facts.icp` wordt vervangen, eerdere run-output blijft bekijkbaar via sessions. (Verschil met vervangen is intentie, niet datamodel — beide vervangen `facts`. Onderscheid leggen we vast in `sessions.input.runIntent` voor analyse.)
3. **Nieuw onderwerp** — bv. ander product. `facts.icp` krijgt extra entry naast bestaande.

In MVP: latest-run-wins per `(client, product)` automatisch. De dialog kiest welke `runIntent` we loggen — handig voor later "promotie/goedkeuring" UI.

---

## 3. Database-wijzigingen

Drie wijzigingen in `lib/db/schema.ts`:

### 3a. Nieuwe tabel `clients`

```ts
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),                // owner = auth.users.id
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  kvk: text("kvk"),
  sector: text("sector"),
  facts: jsonb("facts").default({}).notNull(),     // canonieke kennis
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 3b. `sessions` krijgt `clientId`

```ts
clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
```

Optioneel (`null` voor sessies zonder klant-koppeling — voorlopig altijd ingevuld).

### 3c. RLS-policies op `clients`

```sql
alter table clients enable row level security;

create policy "users see own clients"
  on clients for select
  using (auth.uid() = user_id);

create policy "users insert own clients"
  on clients for insert
  with check (auth.uid() = user_id);

create policy "users update own clients"
  on clients for update
  using (auth.uid() = user_id);

create policy "users delete own clients"
  on clients for delete
  using (auth.uid() = user_id);

-- admins zien alles (consistent met sessions-policy)
create policy "admins see all clients"
  on clients for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
```

Migratie-bestand: `drizzle/0002_clients.sql`.

---

## 4. Module-folder

```
modules/icp-analyse/
├── schema.ts                # zod input + output
├── prompt.ts                # buildSystemPrompt + buildUserPrompt
├── service.ts               # orchestrator
├── scraper.ts               # cheerio: fetch + extract title/meta/hero/about
└── components/
    ├── InputForm.tsx        # client- of nieuwe-klant-keuze + product
    ├── ResultView.tsx       # 4 secties
    └── RerunDialog.tsx      # 3-keuze dialog bij tweede run
```

**Gedeelde UI-bouwstenen** in `components/module-result/`:
- `<ResultBanner>` — banner met samenvatting + sector-positie
- `<ChipList>` — voor pijnpunten/triggers
- `<FactGrid>` — voor firmografische velden (key/value)
- `<ServiceFocusCard>` — dienst-focus blok

(LinkedIn/Website Check zullen deze bouwstenen later hergebruiken.)

---

## 5. Output-schema (4 secties)

```ts
export const ICPInput = z.object({
  clientId: z.string().uuid(),                       // bestaande klant
  product: z.string().min(2).max(120),               // hoofdproduct/-dienst
  productDescription: z.string().min(10).max(1000),  // korte omschrijving
  runIntent: z.enum(["new", "replace", "version", "topic"]).default("new"),
});

export const ICPOutput = z.object({
  bedrijfsnaam: z.string(),
  product: z.string(),

  // Sectie 1: Banner
  banner: z.object({
    samenvatting: z.string(),                        // 2-3 zinnen positionering
    sectorPositie: z.string(),                       // bv. "Niche-speler in MKB-financieel"
    websiteAnalyseScore: z.number().min(0).max(100), // % volledigheid van scrape-data
  }),

  // Sectie 2: Firmografisch
  firmografisch: z.object({
    sector: z.string(),
    subsector: z.string(),
    bedrijfsgrootte: z.string(),                     // bv. "10-50 fte"
    contactpersoon: z.string(),                      // typische rol
    beslisser: z.string(),
    contractwaarde: z.string(),                      // bv. "€5k-15k/jaar"
    geografie: z.string(),
  }),

  // Sectie 3: Pijnpunten & Triggers
  pijnpunten: z.array(z.string()).min(3).max(7),
  triggers: z.array(z.string()).min(3).max(7),       // events die kopen veroorzaken

  // Sectie 4: Dienst/Product Focus
  dienstFocus: z.object({
    kernBelofte: z.string(),                         // "Wat krijgt de klant?"
    prijsindicatie: z.string(),
    onderscheidend: z.string(),                      // wat maakt deze prop uniek
  }),
});
```

---

## 6. Flow

### 6a. Input-pagina `/modules/icp-analyse`

- **Klant-kiezer** (default): selectbox van bestaande klanten van de gebruiker, of "+ Nieuwe klant".
- Als "Nieuwe klant": inline form met `name` + `websiteUrl` (verplicht).
- **Product-veld:** naam + korte omschrijving.
- **Detectie tweede run:** als de gekozen klant al een ICP-fact heeft voor dit product → toon `<RerunDialog>` met 3 opties (vervangen / versie / nieuw onderwerp). Gebruikerskeuze wordt `runIntent`.
- Submit → server action `startICPAnalysis(input)`.

### 6b. Server action `startICPAnalysis`

1. Authenticatie + valideer input tegen `ICPInput` zod.
2. Maak `sessions`-rij (`status: running`, `moduleSlug: 'icp-analyse'`, `clientId`).
3. **Scrape** klant-website via `scraper.ts` (cheerio): titel, meta-description, hero-tekst, eerste 500 woorden body. Cached resultaat ook naar `clients.facts.website_snapshot`.
4. **Bouw prompt:** `buildSystemPrompt()` (Positionr-framework + 4-secties-rubric, als cached system-block) + `buildUserPrompt({ scrape, product, productDescription })`.
5. Call Claude Sonnet 4.6 via `lib/ai/claude.ts` met cache-control op system block.
6. Strip JSON-fences, parse, valideer tegen `ICPOutput`.
7. Update `sessions`: `status: done`, `output`, telemetrie (`llmModel`, `llmInputTokens`, `llmOutputTokens`, `llmCostCents`).
8. **Promote naar `clients.facts.icp`** volgens `runIntent`:
   - `new` of `topic` → push als nieuwe entry
   - `replace` of `version` → vervang entry waar `product` matcht (latest-wins)
9. Redirect naar `/modules/icp-analyse/[sessionId]`.

Bij failure: `status: failed`, `errorMessage` opslaan, redirect naar zelfde pagina (toont error-state).

### 6c. Resultaatpagina `/modules/icp-analyse/[id]`

- Server component: laad sessie + bijbehorende client.
- Status-routing: `running` → spinner met polling, `failed` → error met retry-knop, `done` → `<ResultView>`.
- `<ResultView>` rendert 4 secties:
  1. `<ResultBanner>` — samenvatting + sectorPositie + score-badge
  2. `<FactGrid>` — firmografisch
  3. `<ChipList>` × 2 — pijnpunten + triggers
  4. `<ServiceFocusCard>` — dienstFocus

Geen edit, geen share-knop, geen PDF-knop in slim slice.

---

## 7. AI-laag

Toevoegen: `lib/ai/claude.ts` met helper `analyzeWithCachedSystem<T>({ system, user, schema })`:

- Anthropic SDK
- Model: `claude-sonnet-4-6`
- `system` als gecachet block (`cache_control: { type: "ephemeral" }`)
- `max_tokens: 4000`
- Response-parsing: strip ` ```json `-fences, `JSON.parse`, `schema.parse`
- Telemetrie returnen: `inputTokens`, `outputTokens`, `costCents` (op basis van Sonnet 4.6 prijzen)

Server action gebruikt deze helper.

---

## 8. Scraper

`modules/icp-analyse/scraper.ts`:

```ts
export async function scrapeForIcp(url: string): Promise<WebsiteSnapshot> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Positionr/1.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  return {
    url,
    title: $('title').text().trim(),
    metaDescription: $('meta[name="description"]').attr('content') ?? '',
    heroText: $('h1, h2').slice(0, 3).map((_,el)=>$(el).text().trim()).get().join(' | '),
    bodyExcerpt: $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000),
    scrapedAt: new Date().toISOString(),
  };
}
```

Errors (network, 4xx/5xx) → `service.ts` vangt op, sessie krijgt `status: failed` met duidelijke `errorMessage`.

---

## 9. Out of scope (expliciet)

| Feature | Komt wanneer |
|---|---|
| Productcatalogus-flow ("scan website → detecteer producten") | Module v2 |
| Volledige analyse (vragenlijst, ~10-15 min) | Module v2 |
| Edit per sectie (potlood-iconen) | Volgende slice |
| Deelbare link | Volgende slice |
| Voorbeeldprospects / lookalikes (Perplexity) | Module v3 |
| Negatieve ICP (dealbreakers) | Module v2 |
| "Waarom kiezen klanten"-blok | Module v2 |
| Perplexity-integratie | Wanneer relevant |
| Klant-detailpagina (`/klanten/[id]`) | Apart spec |
| Admin-pagina's | Sprint week 3 |

---

## 10. Bestandswijzigingen — overzicht

**Nieuw:**
- `drizzle/0002_clients.sql` — migratie clients-tabel + RLS
- `lib/ai/claude.ts` — Anthropic-helper met caching
- `modules/icp-analyse/schema.ts`
- `modules/icp-analyse/prompt.ts`
- `modules/icp-analyse/scraper.ts`
- `modules/icp-analyse/service.ts`
- `modules/icp-analyse/components/InputForm.tsx`
- `modules/icp-analyse/components/ResultView.tsx`
- `modules/icp-analyse/components/RerunDialog.tsx`
- `components/module-result/ResultBanner.tsx`
- `components/module-result/ChipList.tsx`
- `components/module-result/FactGrid.tsx`
- `components/module-result/ServiceFocusCard.tsx`
- `app/(app)/modules/icp-analyse/page.tsx` — input
- `app/(app)/modules/icp-analyse/actions.ts` — server action
- `app/(app)/modules/icp-analyse/[id]/page.tsx` — resultaat

**Wijzigen:**
- `lib/db/schema.ts` — `clients` table + `sessions.clientId`
- `lib/modules/registry.ts` — `icp-analyse.status: 'active'` + `href: '/modules/icp-analyse'`

**Geen wijzigingen aan:** auth-flow, /modules catalog page (alleen registry-status), bestaande website-check stub.

---

## 11. Verificatie / acceptance criteria

Na implementatie moet werken:

1. Login → `/modules` toont ICP als "Start →" (active).
2. Klik ICP-card → `/modules/icp-analyse` met input-form.
3. Vul nieuwe klant + product in → submit → loading.
4. Na ~5-15s redirect naar resultaatpagina met 4 secties gevuld.
5. Database: nieuwe rij in `clients`, nieuwe rij in `sessions`, `clients.facts.icp[0]` gevuld.
6. Tweede run zelfde klant + product → `<RerunDialog>` toont 3 opties.
7. Bij `replace` / `version` → entry vervangen, sessions-historie behouden.
8. Bij `topic` met ander product → tweede entry naast eerste.
9. Failure-pad: ongeldige URL → resultaatpagina toont error-state.
10. RLS: gebruiker ziet alleen eigen klanten (test met tweede account).
