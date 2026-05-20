# Admin Prompt Editor — ontwerp (v1)

- **Datum:** 2026-05-20
- **Status:** Goedgekeurd (ontwerp), klaar voor implementatieplan
- **Repo:** `oarnolds/positionr-app` (Next.js App Router, Supabase, Drizzle, Claude)
- **Referentie:** `oarnolds/manus-positionr2` — bouwt prompt-editor met tabs +
  TipTap + Markdown-opslag + placeholder-substitutie. We porten het idee, niet
  de code (andere stack).

## 1. Doel & context

Admins moeten de prompts kunnen aanpassen die naar de LLM worden gestuurd zodat
ze de analyse kunnen "tweaken" zonder code-deploy. Daarbij willen we per
module kunnen kiezen of de call naar **Claude** of **Perplexity** gaat —
Perplexity heeft ingebouwde web-search en is daarom relevant voor modules die
actuele markt- of concurrent-info nodig hebben.

Vandaag bestaat er een overzichtspagina `/admin/prompts` met module-kaarten,
maar de detail-pagina ontbreekt en de runtime gebruikt hardcoded `.ts`-constanten
(`SYSTEM_PROMPT`, `buildUserPrompt`) i.p.v. de DB.

## 2. Scope

**In v1**

- DB-laag: `provider`-kolom op `modules`, nieuwe `module_prompt_history`-tabel
- Seed: alle 11 modules krijgen `FALLBACK_PROMPT` + provider in DB
- Provider-abstractie (`lib/ai/analyze.ts`) met Claude + Perplexity adapters
- Placeholder-substitutie (`{naam}`) op runtime
- `getModulePrompt(slug)`-helper met code-fallback als DB leeg is
- Editor-UI op `/admin/prompts/[slug]` (sidebar + TipTap + provider-dropdown +
  placeholder-chips + save/reset + version history)
- Server actions: `savePrompt`, `resetPrompt`, `restoreVersion`
- Website Check runtime overgezet naar nieuw patroon (combineert
  `SYSTEM_PROMPT` + `buildUserPrompt`-template tot één `FALLBACK_PROMPT`)
- Tests: placeholder-substituter, provider-adapters (gemockt), e2e flow admin
  → save → runtime gebruikt nieuwe prompt

**Buiten v1**

- ICP Analyse migreren naar nieuw patroon (apart, want andere flow + 'volledig'-modus)
- Per-user prompt-override (veld `sessions.prompt_override` bestaat al, niet
  in v1 aansluiten)
- Diff-view in version history (alleen restore in v1, geen visuele diff)
- Prompt-validatie (missende required, ongeldige placeholders)
- Runtime bouwen voor de 9 "soon"-modules (alleen prompts staan klaar in DB)

## 3. Architectuurkeuze: één prompt-blob per module (Manus-stijl)

Onderzochte alternatieven:

- **A — één blob per module** (gekozen). Editor toont 1 textarea, runtime
  stuurt 1 user-message. ✅ simpel, uniform voor beide providers. ❌ verliest
  Claude prompt-caching → ~15% duurder per call. **Acceptabel** bij huidige
  volume (paar runs/dag).
- **B — split system + user**. Behoudt caching maar complexere UI, niet alle
  providers ondersteunen caching gelijk. **YAGNI** voor v1.
- **C — hybride met magische marker**. Onbetrouwbaar in praktijk; verworpen.

Migratiepad als kosten later opdrijven: alle prompts opsplitsen in twee
secties (instructie / data-template) en de runtime overzetten — kan zonder de
UI ingrijpend te veranderen.

## 4. Data-laag

### 4.1 DB-migratie

```sql
CREATE TYPE provider_enum AS ENUM ('claude', 'perplexity');

ALTER TABLE modules
  ADD COLUMN provider provider_enum NOT NULL DEFAULT 'claude';

CREATE TABLE module_prompt_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug text NOT NULL REFERENCES modules(slug) ON DELETE CASCADE,
  prompt      text NOT NULL,
  provider    provider_enum NOT NULL,
  saved_by    uuid NOT NULL,                          -- auth.users.id
  saved_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX module_prompt_history_module_idx
  ON module_prompt_history(module_slug, saved_at DESC);
```

RLS-policies volgen het bestaande project-patroon uit `drizzle/0001_rls.sql`:

```sql
alter table module_prompt_history enable row level security;

create policy "module_prompt_history admin read"
  on module_prompt_history for select
  using (exists (select 1 from profiles
                 where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "module_prompt_history admin write"
  on module_prompt_history for all
  using (exists (select 1 from profiles
                 where profiles.id = auth.uid() and profiles.role = 'admin'));
```

Voor de bestaande `modules`-tabel is RLS al ingesteld (public read, admin
write) — geen wijziging nodig.

De `(admin)` route-group + middleware is de tweede laag van defense voor de
UI-toegang.

### 4.2 Bestaande velden hergebruiken

- **`modules.defaultPrompt`** wordt de "huidige actieve prompt". Naam is
  historisch — geen rename om migratie te vermijden. In de Drizzle-types in
  de code mag het opnieuw worden gelabeld als `currentPrompt` voor leesbaarheid.
- **`modules.outputSchema`** blijft `jsonb`, ongebruikt in v1.

### 4.3 Default-prompts in code

Per module exporteert `modules/<slug>/prompt.ts` een `FALLBACK_PROMPT`-constante
(één Markdown-string met `{placeholders}`). Drie use-cases:

1. **Seed-script** (`scripts/seed-prompts.ts`): populeert lege DB-rijen bij
   eerste deploy
2. **Reset-knop** in editor: schrijft fallback terug naar DB (na snapshot van
   huidige naar history)
3. **Runtime-defense**: `getModulePrompt(slug)` valt terug op `FALLBACK_PROMPT`
   als `modules.defaultPrompt` leeg is

Voor Website Check: bestaande `SYSTEM_PROMPT` + de string-template uit
`buildUserPrompt()` worden samengevoegd tot één `FALLBACK_PROMPT` met
`{websiteUrl}`, `{companyName}`, `{scrapedContent}` als placeholders.

### 4.4 Save / Reset / Restore flows

Elke actie produceert één extra history-rij; onbeperkte groei is acceptabel
(tekst is klein, paar saves per module per maand max).

| Actie | Stappen |
|---|---|
| **Save** | (1) Snapshot huidige `prompt`+`provider` → history. (2) Update `modules.defaultPrompt` + `provider`. |
| **Reset** | (1) Snapshot huidige → history. (2) Update `modules.defaultPrompt` ← `FALLBACK_PROMPT` uit code. |
| **Restore (uit history)** | (1) Snapshot huidige → history. (2) Update `modules.defaultPrompt` + `provider` ← waarden uit gekozen history-rij. |

Transacties: Supabase JS-client heeft geen native transacties. We schrijven de
twee stappen ge-orderd (history eerst, dan modules-update) zodat een crash op
stap 2 enkel resulteert in een extra history-rij — geen verlies van de huidige
prompt.

## 5. Editor-UI

### 5.1 Routes

- `/admin/prompts` → redirect naar `/admin/prompts/website-check` (eerste actieve)
- `/admin/prompts/[slug]` → editor met die module geselecteerd

De bestaande `/admin/prompts/page.tsx` (overzichtsgrid) wordt vervangen door
de sidebar-layout — de sidebar **is** het overzicht.

### 5.2 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Prompt Editor                                                │
├────────────────────┬─────────────────────────────────────────┤
│ Sidebar (~280px)   │ Editor pane                              │
│                    │                                          │
│ 🌐 Website Check  ◄│  Website Check               [Actief]    │
│    Actief          │  Provider: [Claude     ▼]                │
│                    │                                          │
│ 🌐 Website + Conc. │  Beschikbare placeholders                │
│    Binnenkort      │  [{websiteUrl}] [{companyName}]          │
│                    │  [{scrapedContent}]   (klik = invoegen)  │
│ 👤 ICP Analyse     │                                          │
│    Actief          │  ┌──────────────────────────────────┐    │
│                    │  │ TipTap rich text editor          │    │
│ 📄 Flyer Checker   │  │ ━━ B  I  U  H1 H2 H3  •  1.      │    │
│    Binnenkort      │  │                                  │    │
│                    │  │ # Je bent een expert...          │    │
│ 📊 Marktonderzoek  │  │                                  │    │
│    Binnenkort      │  │ Analyseer {websiteUrl} ...       │    │
│                    │  │                                  │    │
│ ...nog 6 modules…  │  └──────────────────────────────────┘    │
│                    │                                          │
│                    │  [💾 Opslaan]  [↺ Reset naar default]   │
│                    │                                          │
│                    │  ▾ Versie-historie (5)                   │
│                    │     20 mei 14:32 · Olivier  [Terugzetten]│
│                    │     20 mei 12:15 · Olivier  [Terugzetten]│
└────────────────────┴─────────────────────────────────────────┘
```

### 5.3 Sidebar

- Lijst van alle 11 modules uit `lib/modules/registry.ts`
- Per rij: icoon (gekleurd uit registry) + naam + status-badge ("Actief" /
  "Binnenkort")
- Geselecteerde module gehighlight (purple background)
- "Binnenkort"-modules zijn klikbaar (admin schrijft vast prompts) met
  "preview-only"-badge
- Dirty-state: rij met onopgeslagen wijzigingen krijgt een dot-indicator (●)

### 5.4 Editor pane

1. **Header**: module-naam + status-badge
2. **Provider-dropdown**: Claude / Perplexity. Wijziging triggert dirty-state.
3. **Placeholder-chips**: lijst voor déze module, klik = invoegen op cursor-positie
4. **TipTap-editor**: rich text met toolbar (bold, italic, underline, H1-H3,
   lists, undo/redo). Opslag als Markdown via `marked` (MD→HTML) en `turndown`
   (HTML→MD)
5. **Actie-knoppen**:
   - **Opslaan** (primary purple) — alleen actief als dirty
   - **Reset naar default** (outline, met confirm-dialog) — schrijft
     `FALLBACK_PROMPT` terug naar DB
6. **Versie-historie** (accordion, default ingeklapt):
   - Lijst van saves (nieuwste boven), per rij: datum/tijd, wie, **Terugzetten**-knop
   - (Diff-view = out of scope v1)

### 5.5 Dirty-state gedrag

- Wisselen van module met dirty changes → confirm-dialog "Wijzigingen niet
  opgeslagen — toch verlaten?"
- Browser-close (beforeunload) met dirty → standaard browser-prompt

## 6. Runtime-integratie

### 6.1 Provider-abstractie (`lib/ai/analyze.ts`)

```ts
type AnalyzeArgs<T> = {
  provider: 'claude' | 'perplexity';
  prompt: string;        // al-gesubstitueerd, klaar voor verzending
  schema: z.ZodType<T>;  // voor JSON-parse + validatie
};

export type AnalyzeResult<T> = {
  data: T;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
  promptUsed: string;
};

export async function analyze<T>(args: AnalyzeArgs<T>): Promise<AnalyzeResult<T>>;
```

Beide adapters:

1. Voegen schema-instructie toe aan het prompt-einde ("respond with JSON matching: ...")
2. Roepen API aan (Claude SDK / Perplexity HTTPS)
3. Parsen JSON-response
4. Valideren met Zod
5. Returnen `AnalyzeResult<T>`

**Claude-adapter** combineert system + user in één user-message (conform optie A
in §3). De bestaande `analyzeWithCachedSystem` wordt **verwijderd** zodra
Website Check is overgezet.

**Perplexity-adapter** roept `https://api.perplexity.ai/chat/completions` aan
met model `sonar-pro` (web-search ingebouwd). API-key uit env-var
`PERPLEXITY_API_KEY`. Token-counts uit response `usage`-veld. Kosten-berekening
gebaseerd op Perplexity-tarieven (per maart 2026: $3/MTok input, $15/MTok
output voor `sonar-pro` — wordt config in `lib/ai/pricing.ts`).

### 6.2 Placeholder-registry per module

`modules/<slug>/index.ts` exporteert:

```ts
export const PLACEHOLDERS = [
  { key: 'websiteUrl',     label: 'Website URL',      example: 'https://example.com' },
  { key: 'companyName',    label: 'Bedrijfsnaam',     example: 'Acme BV' },
  { key: 'scrapedContent', label: 'Gescrapte inhoud', example: '...' },
] as const;
```

Editor-UI fetcht deze lijst voor de chips.

### 6.3 Substituter (`lib/modules/prompts.ts`)

```ts
export function substitutePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}
```

Missende variabele blijft als `{naam}` in de prompt → admin ziet wat ontbreekt
in een test-run.

### 6.4 `getModulePrompt(slug)`

```ts
export async function getModulePrompt(slug: string) {
  const [row] = await db.select().from(modules).where(eq(modules.slug, slug)).limit(1);
  if (!row) throw new Error(`Module ${slug} niet in DB`);
  if (!row.defaultPrompt) {
    // Defense-in-depth fallback
    const mod = await import(`@/modules/${slug}/prompt`);
    return { prompt: mod.FALLBACK_PROMPT as string, provider: row.provider };
  }
  return { prompt: row.defaultPrompt, provider: row.provider };
}
```

### 6.5 Service-aanpassing (Website Check als template)

```ts
async function runAnalysis(args) {
  const scraped = await deps.scrape(args.websiteUrl);

  const { prompt: template, provider } = await getModulePrompt(MODULE_SLUG);

  const prompt = substitutePlaceholders(template, {
    websiteUrl: args.websiteUrl,
    companyName: args.companyName,
    scrapedContent: scraped,
  });

  const result = await deps.analyze({
    provider,
    prompt,
    schema: WebsiteCheckOutputSchema,
  });

  await deps.updateSession(args.sessionId, {
    status: 'approved',
    output: result.data,
    promptUsed: result.promptUsed,
    llmModel: result.llmModel,
    llmInputTokens: result.llmInputTokens,
    llmOutputTokens: result.llmOutputTokens,
    llmCostCents: result.llmCostCents,
    completedAt: new Date(),
  });
}
```

### 6.6 Wat we **niet** veranderen

- Scrapers (`modules/website-check/scraper.ts`)
- Output-schemas (Zod, `modules/<slug>/schema.ts`)
- Page-templates / UI-componenten van de modules
- Form-pagina van Website Check, redirect-flow, polling (alles wat in de
  recente fixes is opgelost)

## 7. Default provider per module (seed)

| Module | Provider | Reden |
|---|---|---|
| Website Check | Claude | Scrape eigen site, geen web search |
| Website Check + Concurrenten | Perplexity | Concurrent-info uit web |
| Flyer Checker | Claude | Image-input, geen web search |
| Marktonderzoek | Perplexity | Actuele markt-data |
| LinkedIn Analyse | Perplexity | LinkedIn-data uit web |
| LinkedIn + Concurrentie | Perplexity | Idem |
| LinkedIn Concurrentie Kwartaal | Perplexity | Idem |
| Propositie Analyse | Claude | Werkt op eigen content |
| ICP Analyse | Claude | (huidige) |
| Klantcase Analyse | Claude | Werkt op eigen content |
| Gap Analyse | Perplexity | Marktvergelijking |

Admin kan dit altijd wijzigen via de dropdown in de editor.

## 8. Testing

| Niveau | Wat | Stack |
|---|---|---|
| Unit | `substitutePlaceholders` — alle paden | Vitest |
| Unit | Claude-adapter (API gemockt) | Vitest |
| Unit | Perplexity-adapter (HTTP gemockt) | Vitest |
| Unit | `getModulePrompt` met lege en gevulde DB-rij | Vitest |
| Unit | Save/Reset/Restore-flow tegen testdatabase | Vitest |
| Smoke (productie) | Eén echte Website Check run na deploy | Hand |

De bestaande Website Check tests (`prompt.test.ts`, `service.test.ts`) blijven
groen na migratie — alleen mocks aanpassen waar `analyze` ipv
`analyzeWithCachedSystem` wordt aangeroepen.

## 9. Rollout — drie PR's

1. **PR 1**: DB-migratie + seed-script + provider-abstractie + placeholder-utils
   + `getModulePrompt` + tests. **Niet-disruptief** (geen UI, geen
   service-aanpassing).
2. **PR 2**: Editor-UI op `/admin/prompts/[slug]` (sidebar + TipTap + provider-
   dropdown + placeholder-chips + save/reset + version history). Admin kan al
   opslaan; runtime blijft hardcoded constants gebruiken zolang PR 3 niet
   gedeployed is.
3. **PR 3**: Website Check runtime overzetten naar nieuw patroon. Smoke-test
   op productie → klaar.

Elke PR is apart te pushen + reverten als 'r iets stuk gaat.

## 10. Risico's & onbekenden

| Risico | Impact | Mitigatie |
|---|---|---|
| Perplexity-tarieven / API-shape verandert | Cost-tracking incorrect | Tarief in `lib/ai/pricing.ts` config; bij wijziging één plek aanpassen |
| TipTap + marked + turndown extra bundle-size | Trager admin-pagina laden | Admin-pagina is niet hot-path; acceptabel |
| Admin schrijft slechte prompt → analyses falen | Gebruiker krijgt errors | Reset-knop + version history (restore) |
| RLS-policy ontbreekt voor `module_prompt_history` | History onleesbaar voor admin | Migratie levert SQL met policies mee (zie §4.1) |
| Perplexity heeft geen JSON-mode (alleen schema-prompt) | Onvoorspelbare response-shape | Zod-validatie + retry-loop (3×) bij parse-fail; logging |

## 11. Acceptatiecriteria

- Admin kan op `/admin/prompts/website-check` de prompt aanpassen, opslaan, zien
  in version history en terugzetten naar een oude versie
- Reset-knop herstelt naar `FALLBACK_PROMPT` uit de code
- Provider-dropdown wisselt tussen Claude en Perplexity
- Website Check runtime gebruikt de DB-prompt + provider (geverifieerd via
  productie-smoke-test)
- Bestaande unit-tests blijven groen
- Geen regressie in: form-pagina, redirect-flow, polling, "Bezig…"-pagina
- Geen tokens in `.git/config`, geen plain-text credentials in code
