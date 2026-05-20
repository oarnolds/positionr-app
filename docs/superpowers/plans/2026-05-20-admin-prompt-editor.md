# Admin Prompt Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een admin-pagina waarop de prompts per module bewerkt kunnen worden (Claude of Perplexity per module), opgeslagen worden in de DB met version-history, en op runtime worden gebruikt door (in v1) de Website Check-module.

**Architecture:** Eén Markdown-blob per module in `modules.defaultPrompt`. Editor op `/admin/prompts/[slug]` (sidebar + TipTap). Runtime fetcht prompt via `getModulePrompt(slug)` en stuurt 'm via een provider-abstractie naar Claude of Perplexity. Drie incrementele PR's: data-laag, editor-UI, runtime-migratie.

**Tech Stack:** Next.js 15 App Router · Supabase (Postgres + RLS) · Drizzle ORM · Claude SDK (`@anthropic-ai/sdk`) · Perplexity REST API · TipTap (rich text) · marked + turndown (HTML↔Markdown) · Vitest

**Referentie-spec:** `docs/superpowers/specs/2026-05-20-admin-prompt-editor-design.md`

---

## File Structure

### PR 1 — Data laag

```
drizzle/0004_admin_prompts.sql              (NIEUW — migratie + RLS-policies; user runt in Supabase)
lib/db/schema.ts                            (MODIFY — providerEnum, modules.provider, modulePromptHistory)
lib/ai/pricing.ts                           (NIEUW — tarieven + calculateCostCents)
lib/ai/analyze.ts                           (NIEUW — provider-abstractie, type AnalyzeArgs/Result)
lib/ai/claude.ts                            (MODIFY — voeg analyzeClaude(...) toe; analyzeWithCachedSystem blijft)
lib/ai/perplexity.ts                        (NIEUW — analyzePerplexity(...) via fetch)
lib/modules/prompts.ts                      (NIEUW — substitutePlaceholders + getModulePrompt)
lib/modules/fallback-prompts.ts             (NIEUW — registry Record<slug, string>)
modules/website-check/index.ts              (MODIFY — export PLACEHOLDERS const)
modules/website-check/prompt.ts             (MODIFY — voeg FALLBACK_PROMPT export toe)
scripts/seed-prompts.ts                     (NIEUW — populate alle 11 modules)
package.json                                (MODIFY — add seed:prompts script)

lib/ai/pricing.test.ts                      (NIEUW)
lib/ai/analyze.test.ts                      (NIEUW)
lib/ai/perplexity.test.ts                   (NIEUW)
lib/modules/prompts.test.ts                 (NIEUW)
```

### PR 2 — Editor UI

```
app/(admin)/admin/prompts/page.tsx          (MODIFY — vervang grid door redirect)
app/(admin)/admin/prompts/[slug]/page.tsx   (NIEUW — server component, layout)
app/(admin)/admin/prompts/[slug]/sidebar.tsx           (NIEUW — server component)
app/(admin)/admin/prompts/[slug]/editor-pane.tsx       (NIEUW — client component)
app/(admin)/admin/prompts/[slug]/version-history.tsx   (NIEUW — server component)
app/(admin)/admin/prompts/[slug]/actions.ts            (NIEUW — server actions)
components/rich-prompt-editor.tsx           (NIEUW — TipTap wrapper, client component)
package.json                                (MODIFY — TipTap deps)
```

### PR 3 — Runtime migratie

```
modules/website-check/service.ts            (MODIFY — gebruik getModulePrompt + analyze)
modules/website-check/service.test.ts       (MODIFY — mocks bijwerken)
modules/website-check/prompt.test.ts        (MODIFY — testen op FALLBACK_PROMPT structuur)
lib/ai/claude.ts                            (MODIFY — verwijder analyzeWithCachedSystem als ongebruikt)
```

---

## PR 1 — Data layer (niet-disruptief)

### Task 1: Drizzle schema-uitbreiding (provider enum + provider column + history table)

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Voeg providerEnum + provider column + modulePromptHistory toe**

In `lib/db/schema.ts`, na `moduleStatus` enum (rond regel 27), voeg toe:

```ts
export const providerEnum = pgEnum("provider", ["claude", "perplexity"]);
```

In `modules` table (rond regel 45-53), voeg een kolom toe na `defaultPrompt`:

```ts
  provider: providerEnum("provider").default("claude").notNull(),
```

Onderaan het bestand (vóór de type-exports rond regel 128), voeg toe:

```ts
// ── Module Prompt History ───────────────────────────────────
// Snapshot van elke save/reset/restore-actie op modules.defaultPrompt
export const modulePromptHistory = pgTable("module_prompt_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleSlug: text("module_slug")
    .notNull()
    .references(() => modules.slug, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  provider: providerEnum("provider").notNull(),
  savedBy: uuid("saved_by").notNull(), // = auth.users.id
  savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ModulePromptHistory = typeof modulePromptHistory.$inferSelect;
export type NewModulePromptHistory = typeof modulePromptHistory.$inferInsert;
```

- [ ] **Step 2: Genereer migratie**

```bash
pnpm db:generate
```

Expected: nieuw bestand `drizzle/000N_<auto-name>.sql` met `CREATE TYPE provider`, `ALTER TABLE modules ADD COLUMN provider`, `CREATE TABLE module_prompt_history`.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: geen errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(prompts): schema — providerEnum + modules.provider + modulePromptHistory"
```

---

### Task 2: RLS-policies voor module_prompt_history

**Files:**
- Create: `drizzle/0004_admin_prompts_rls.sql` (let op nummer: bekijk laatste rls-bestand en pak hoogste+1)

- [ ] **Step 1: Maak RLS-bestand**

```bash
ls drizzle/*rls*.sql
```

Bekijk de hoogste nummering — als hoogste is `0003_icp_products_rls.sql`, maak dan `0004_admin_prompts_rls.sql`.

Inhoud:

```sql
-- RLS voor module_prompt_history
-- Run dit ná `pnpm db:migrate` of in Supabase SQL Editor.

alter table module_prompt_history enable row level security;

create policy "module_prompt_history admin read"
  on module_prompt_history for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "module_prompt_history admin write"
  on module_prompt_history for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
```

- [ ] **Step 2: Documenteer in commit-bericht dat user dit SQL handmatig moet runnen**

Per CLAUDE.md ("SQL migrations are run by the user in the Supabase SQL Editor") — niet automatisch uitvoeren.

- [ ] **Step 3: Commit**

```bash
git add drizzle/0004_admin_prompts_rls.sql
git commit -m "feat(prompts): RLS-policies voor module_prompt_history (admin-only)"
```

---

### Task 3: Pricing config (`lib/ai/pricing.ts`)

**Files:**
- Create: `lib/ai/pricing.ts`
- Test: `lib/ai/pricing.test.ts`

- [ ] **Step 1: Schrijf failing test**

In `lib/ai/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateCostCents, PRICING } from "./pricing";

describe("calculateCostCents", () => {
  it("Claude Sonnet 4.5: $3/MTok input + $15/MTok output", () => {
    // 1M input + 1M output = $3 + $15 = $18 = 1800 cents
    expect(calculateCostCents("claude", 1_000_000, 1_000_000)).toBe(1800);
  });

  it("Perplexity sonar-pro: $3/MTok input + $15/MTok output", () => {
    expect(calculateCostCents("perplexity", 1_000_000, 1_000_000)).toBe(1800);
  });

  it("rondt cents af op gehele getallen", () => {
    // 1000 input tokens at $3/MTok = $0.003 = 0.3 cents → afgerond 0
    expect(calculateCostCents("claude", 1000, 0)).toBe(0);
  });

  it("exposes PRICING object voor admin-display", () => {
    expect(PRICING.claude.inputPerMTokUsd).toBe(3);
    expect(PRICING.perplexity.outputPerMTokUsd).toBe(15);
  });
});
```

- [ ] **Step 2: Run en zie 'm falen**

```bash
pnpm test lib/ai/pricing.test.ts
```

Expected: FAIL "Cannot find module './pricing'".

- [ ] **Step 3: Implementeer `pricing.ts`**

```ts
// lib/ai/pricing.ts
//
// Tarieven per maart 2026 (peildatum spec). Update hier wanneer providers
// hun prijzen aanpassen. Eenheid: USD per miljoen tokens.

export type Provider = "claude" | "perplexity";

export const PRICING: Record<
  Provider,
  { inputPerMTokUsd: number; outputPerMTokUsd: number; model: string }
> = {
  claude: {
    inputPerMTokUsd: 3,
    outputPerMTokUsd: 15,
    model: "claude-sonnet-4-5",
  },
  perplexity: {
    inputPerMTokUsd: 3,
    outputPerMTokUsd: 15,
    model: "sonar-pro",
  },
};

/**
 * Bereken kosten in dollarcent (afgerond op gehele cent).
 * 1 cent = $0.01 = 1/100 USD.
 */
export function calculateCostCents(
  provider: Provider,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[provider];
  const usd =
    (inputTokens / 1_000_000) * p.inputPerMTokUsd +
    (outputTokens / 1_000_000) * p.outputPerMTokUsd;
  return Math.round(usd * 100);
}
```

- [ ] **Step 4: Run tests, zie ze slagen**

```bash
pnpm test lib/ai/pricing.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/pricing.ts lib/ai/pricing.test.ts
git commit -m "feat(ai): pricing config + calculateCostCents"
```

---

### Task 4: Placeholder substituter (`lib/modules/prompts.ts` deel 1)

**Files:**
- Create: `lib/modules/prompts.ts` (deel 1 van 2)
- Test: `lib/modules/prompts.test.ts`

- [ ] **Step 1: Schrijf failing test**

In `lib/modules/prompts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { substitutePlaceholders } from "./prompts";

describe("substitutePlaceholders", () => {
  it("vervangt bekende variabelen", () => {
    expect(substitutePlaceholders("Hi {name}", { name: "Olivier" })).toBe(
      "Hi Olivier",
    );
  });

  it("vervangt meerdere keren dezelfde variabele", () => {
    expect(
      substitutePlaceholders("{a} en {a} en {b}", { a: "A", b: "B" }),
    ).toBe("A en A en B");
  });

  it("laat onbekende variabelen als literal {naam} staan", () => {
    expect(substitutePlaceholders("Hi {unknown}", { name: "x" })).toBe(
      "Hi {unknown}",
    );
  });

  it("ondersteunt underscores en cijfers in variabele-namen", () => {
    expect(
      substitutePlaceholders("{var_1} en {snake_case}", {
        var_1: "X",
        snake_case: "Y",
      }),
    ).toBe("X en Y");
  });

  it("raakt tekst zonder placeholders niet aan", () => {
    expect(substitutePlaceholders("geen accolades hier", {})).toBe(
      "geen accolades hier",
    );
  });
});
```

- [ ] **Step 2: Run en zie 'm falen**

```bash
pnpm test lib/modules/prompts.test.ts
```

Expected: FAIL "Cannot find module './prompts'".

- [ ] **Step 3: Implementeer substituter**

In `lib/modules/prompts.ts`:

```ts
// lib/modules/prompts.ts
//
// Module-prompt helpers: substitutie + DB-fetch met fallback.

/**
 * Vervang `{naam}`-placeholders in `template` door waarden uit `values`.
 * Missende variabelen blijven als `{naam}` in de output staan zodat admin
 * direct ziet welke placeholder ontbreekt in een test-run.
 */
export function substitutePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : `{${key}}`,
  );
}
```

- [ ] **Step 4: Run tests, zie ze slagen**

```bash
pnpm test lib/modules/prompts.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/modules/prompts.ts lib/modules/prompts.test.ts
git commit -m "feat(prompts): substitutePlaceholders + tests"
```

---

### Task 5: getModulePrompt helper (`lib/modules/prompts.ts` deel 2)

**Files:**
- Modify: `lib/modules/prompts.ts`
- Create: `lib/modules/fallback-prompts.ts` (registry)
- Test: `lib/modules/prompts.test.ts` (uitbreiden)

- [ ] **Step 1: Maak placeholder-fallback registry**

`lib/modules/fallback-prompts.ts`:

```ts
// lib/modules/fallback-prompts.ts
//
// Single source-of-truth voor de FALLBACK_PROMPT per module — gebruikt door:
//  1. Seed-script (initiële DB-populatie)
//  2. Reset-knop in admin-editor (terug naar default)
//  3. Defense-in-depth fallback in getModulePrompt (als DB-veld leeg is)
//
// Voor 'soon' modules: simpele placeholders. Voor actieve modules: import
// van de echte FALLBACK_PROMPT uit modules/<slug>/prompt.ts.

const SOON_PLACEHOLDER = (name: string) =>
  `[Placeholder prompt voor ${name} — vul aan via de admin-editor zodra deze module gebouwd wordt.]`;

export const FALLBACK_PROMPTS: Record<string, string> = {
  // ACTIVE — wordt in Task 6 overschreven met echte import
  "website-check": SOON_PLACEHOLDER("Website Check"),
  "icp-analyse": SOON_PLACEHOLDER("ICP Analyse"),

  // SOON
  "website-check-concurrenten": SOON_PLACEHOLDER("Website Check + Concurrenten"),
  "flyercheck": SOON_PLACEHOLDER("Flyer/Salespresentatie Checker"),
  "marktonderzoek": SOON_PLACEHOLDER("Marktonderzoek"),
  "linkedin-analyse": SOON_PLACEHOLDER("LinkedIn Analyse"),
  "linkedin-concurrentie": SOON_PLACEHOLDER("LinkedIn Analyse + Concurrentie"),
  "propositie-analyse": SOON_PLACEHOLDER("Propositie Analyse"),
  "klantcase-analyse": SOON_PLACEHOLDER("Klantcase Analyse"),
  "linkedin-concurrentie-kwartaal": SOON_PLACEHOLDER("LinkedIn Concurrentie Kwartaal"),
  "gap-analyse": SOON_PLACEHOLDER("Gap Analyse"),
};
```

- [ ] **Step 2: Schrijf failing tests voor getModulePrompt**

Voeg toe aan `lib/modules/prompts.test.ts`:

```ts
import { vi, beforeEach } from "vitest";
import { getModulePrompt } from "./prompts";

// Mock de DB-import
vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
  },
}));

const mockDbSelect = (rows: any[]) => {
  const { db } = require("@/lib/db/client");
  db.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  });
};

describe("getModulePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returnt prompt + provider uit DB als defaultPrompt gevuld is", async () => {
    mockDbSelect([{ defaultPrompt: "Hallo {x}", provider: "perplexity" }]);
    const result = await getModulePrompt("website-check");
    expect(result).toEqual({ prompt: "Hallo {x}", provider: "perplexity" });
  });

  it("valt terug op FALLBACK_PROMPTS als defaultPrompt leeg is", async () => {
    mockDbSelect([{ defaultPrompt: "", provider: "claude" }]);
    const result = await getModulePrompt("website-check");
    expect(result.prompt).toContain("Placeholder"); // de SOON_PLACEHOLDER
    expect(result.provider).toBe("claude");
  });

  it("gooit error bij onbekende slug (niet in DB)", async () => {
    mockDbSelect([]);
    await expect(getModulePrompt("non-existent")).rejects.toThrow(
      /Module non-existent niet in DB/,
    );
  });
});
```

- [ ] **Step 3: Implementeer getModulePrompt**

Voeg toe aan `lib/modules/prompts.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";
import { FALLBACK_PROMPTS } from "./fallback-prompts";
import type { Provider } from "@/lib/ai/pricing";

/**
 * Fetch de actieve prompt voor een module uit de DB.
 * Valt terug op FALLBACK_PROMPTS als het DB-veld leeg is (defense-in-depth).
 */
export async function getModulePrompt(
  slug: string,
): Promise<{ prompt: string; provider: Provider }> {
  const [row] = await db
    .select({ defaultPrompt: modules.defaultPrompt, provider: modules.provider })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);

  if (!row) throw new Error(`Module ${slug} niet in DB`);

  if (!row.defaultPrompt || row.defaultPrompt.length === 0) {
    const fallback = FALLBACK_PROMPTS[slug];
    if (!fallback) throw new Error(`Geen fallback prompt voor module ${slug}`);
    return { prompt: fallback, provider: row.provider as Provider };
  }

  return { prompt: row.defaultPrompt, provider: row.provider as Provider };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/modules/prompts.test.ts
```

Expected: PASS (8 tests totaal).

- [ ] **Step 5: Commit**

```bash
git add lib/modules/prompts.ts lib/modules/prompts.test.ts lib/modules/fallback-prompts.ts
git commit -m "feat(prompts): getModulePrompt + FALLBACK_PROMPTS registry"
```

---

### Task 6: Website Check `FALLBACK_PROMPT` + PLACEHOLDERS

**Files:**
- Modify: `modules/website-check/prompt.ts`
- Modify: `modules/website-check/index.ts`
- Modify: `lib/modules/fallback-prompts.ts`

- [ ] **Step 1: Voeg FALLBACK_PROMPT toe aan prompt.ts**

In `modules/website-check/prompt.ts`, vóór de bestaande exports, voeg toe:

```ts
/**
 * Gecombineerde fallback-prompt — een merge van het oude SYSTEM_PROMPT en het
 * dynamische deel van buildUserPrompt(). Gebruikt door:
 *  - admin-editor: initiële seed + Reset-knop
 *  - runtime: als DB-veld onverhoopt leeg is
 *
 * Placeholders: {companyName}, {websiteUrl}, {scrapedContent}
 */
export const FALLBACK_PROMPT = `Je bent een expert in B2B website analyse en conversie-optimalisatie.
Analyseer de opgegeven websitecontent grondig en geef een gestructureerde beoordeling.
Antwoord ALTIJD in het Nederlands. Geef alleen geldige JSON terug (geen markdown, geen uitleg eromheen).

BEDRIJF: {companyName}
WEBSITE URL: {websiteUrl}

WEBSITE CONTENT:
{scrapedContent}

Beoordeel de volgende 11 onderdelen elk met een score van 1-10 en een korte toelichting:
1. Waardepropositie – Is deze direct duidelijk, onderscheidend en relevant?
2. Klantvoordelen – Zijn de voordelen concreet, resultaatgericht en overtuigend?
3. Diensten/Features – Is helder uitgelegd wat het bedrijf doet en hoe het werkt?
4. Proces – Is het stappenplan duidelijk en logisch?
5. Bewijsvoering – Kwaliteit en zichtbaarheid van cases, referenties en testimonials.
6. Klantcases – Beschrijven ze: klant, uitdaging, oplossing, resultaten?
7. CTA's – Zichtbaarheid, duidelijkheid en conversiekracht.
8. Content – Aanwezigheid en relevantie van blogs, nieuws, whitepapers.
9. Schrijfstijl – Inside-out of outside-in (klantgericht)?
10. Actualiteit – Kloppen data, visuals en content nog?
11. Contactpagina – Vindbaarheid, volledigheid en gebruiksgemak.

Geef je antwoord in EXACT deze JSON-structuur (alle velden verplicht, geen extra velden, geen markdown-fences):
{
  "companyName": "{companyName}",
  "websiteUrl": "{websiteUrl}",
  "overallScore": <getal 1-10, gemiddelde van de onderdeelscores>,
  "executiveSummary": "<2-3 zinnen samenvatting>",
  "onderdelen": [
    { "naam": "Waardepropositie", "score": <1-10>, "toelichting": "<korte uitleg>", "verbeterpunten": ["<punt>", "..."] },
    { "naam": "Klantvoordelen", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Diensten/Features", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Proces", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Bewijsvoering", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Klantcases", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "CTA's", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Content", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Schrijfstijl", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Actualiteit", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] },
    { "naam": "Contactpagina", "score": <1-10>, "toelichting": "...", "verbeterpunten": [] }
  ],
  "sterkePunten": ["<punt 1>", "<punt 2>", "<punt 3>"],
  "verbeterpunten": ["<punt 1>", "<punt 2>", "<punt 3>"],
  "topActies": [
    { "actie": "<actie 1>", "impact": "hoog", "toelichting": "..." },
    { "actie": "<actie 2>", "impact": "<hoog|middel|laag>", "toelichting": "..." },
    { "actie": "<actie 3>", "impact": "<hoog|middel|laag>", "toelichting": "..." },
    { "actie": "<actie 4>", "impact": "<hoog|middel|laag>", "toelichting": "..." },
    { "actie": "<actie 5>", "impact": "<hoog|middel|laag>", "toelichting": "..." }
  ]
}

Belangrijk:
- companyName en websiteUrl: gebruik EXACT de waarden hierboven.
- Exact 11 onderdelen in de bovengenoemde volgorde; "naam" letterlijk overnemen.
- Scores zijn getallen 1-10 (decimalen mogen). Vul "verbeterpunten" als een array van korte strings (mag leeg zijn als er geen zijn).
- Exact 5 acties, gesorteerd op prioriteit (hoogste impact eerst). Impact altijd "hoog", "middel" of "laag".
- Geen extra velden, geen markdown-fences (\\\`\\\`\\\`), geen uitleg buiten de JSON.`;
```

De bestaande `SYSTEM_PROMPT` en `buildUserPrompt()`-exports blijven in deze PR onaangetast — worden in PR 3 verwijderd.

- [ ] **Step 2: Voeg PLACEHOLDERS toe aan index.ts**

In `modules/website-check/index.ts` (controleer eerst inhoud — zou alleen `export const MODULE_SLUG` moeten zijn), voeg toe:

```ts
export const PLACEHOLDERS = [
  {
    key: "websiteUrl",
    label: "Website URL",
    example: "https://example.com",
  },
  {
    key: "companyName",
    label: "Bedrijfsnaam",
    example: "Acme BV",
  },
  {
    key: "scrapedContent",
    label: "Gescrapte inhoud",
    example: "(...html-tekst van de website...)",
  },
] as const;
```

- [ ] **Step 3: Update fallback-prompts.ts**

In `lib/modules/fallback-prompts.ts`, vervang de website-check regel met de echte import:

```ts
import { FALLBACK_PROMPT as websiteCheckFallback } from "@/modules/website-check/prompt";
```

Bovenaan toevoegen. Dan in de Record:

```ts
  "website-check": websiteCheckFallback,
```

(Verwijdert de placeholder voor website-check.)

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: geen errors.

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/prompt.ts modules/website-check/index.ts lib/modules/fallback-prompts.ts
git commit -m "feat(website-check): FALLBACK_PROMPT + PLACEHOLDERS export"
```

---

### Task 7: Provider-abstractie skelet (`lib/ai/analyze.ts`)

**Files:**
- Create: `lib/ai/analyze.ts`
- Test: `lib/ai/analyze.test.ts`

- [ ] **Step 1: Schrijf failing tests**

`lib/ai/analyze.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { analyze } from "./analyze";

vi.mock("./claude", () => ({
  analyzeClaude: vi.fn().mockResolvedValue({
    data: { ok: true },
    llmModel: "claude-sonnet-4-5",
    llmInputTokens: 100,
    llmOutputTokens: 50,
    llmCostCents: 1,
    promptUsed: "test-prompt",
  }),
}));

vi.mock("./perplexity", () => ({
  analyzePerplexity: vi.fn().mockResolvedValue({
    data: { ok: true },
    llmModel: "sonar-pro",
    llmInputTokens: 100,
    llmOutputTokens: 50,
    llmCostCents: 1,
    promptUsed: "test-prompt",
  }),
}));

const schema = z.object({ ok: z.boolean() });

describe("analyze (router)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routeert claude → analyzeClaude", async () => {
    const { analyzeClaude } = await import("./claude");
    const result = await analyze({ provider: "claude", prompt: "hi", schema });
    expect(analyzeClaude).toHaveBeenCalledWith({ prompt: "hi", schema });
    expect(result.llmModel).toBe("claude-sonnet-4-5");
  });

  it("routeert perplexity → analyzePerplexity", async () => {
    const { analyzePerplexity } = await import("./perplexity");
    const result = await analyze({ provider: "perplexity", prompt: "hi", schema });
    expect(analyzePerplexity).toHaveBeenCalledWith({ prompt: "hi", schema });
    expect(result.llmModel).toBe("sonar-pro");
  });
});
```

- [ ] **Step 2: Run en zie 'm falen**

```bash
pnpm test lib/ai/analyze.test.ts
```

Expected: FAIL "Cannot find module './analyze'".

- [ ] **Step 3: Implementeer analyze.ts**

```ts
// lib/ai/analyze.ts
//
// Provider-agnostic entrypoint. Routes naar Claude of Perplexity op basis van
// het meegegeven provider-veld. Beide adapters returnen dezelfde shape zodat
// upstream-services niets hoeven te weten over de provider.

import type { z } from "zod";
import type { Provider } from "./pricing";
import { analyzeClaude } from "./claude";
import { analyzePerplexity } from "./perplexity";

export type AnalyzeArgs<T> = {
  provider: Provider;
  prompt: string;
  schema: z.ZodType<T>;
};

export type AnalyzeResult<T> = {
  data: T;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
  promptUsed: string;
};

export type AdapterArgs<T> = {
  prompt: string;
  schema: z.ZodType<T>;
};

export async function analyze<T>(args: AnalyzeArgs<T>): Promise<AnalyzeResult<T>> {
  const { provider, prompt, schema } = args;
  if (provider === "claude") return analyzeClaude({ prompt, schema });
  if (provider === "perplexity") return analyzePerplexity({ prompt, schema });
  throw new Error(`Onbekende provider: ${provider}`);
}
```

- [ ] **Step 4: Stub de twee adapters tijdelijk zodat de import niet faalt**

In `lib/ai/claude.ts` (bestaand bestand) voeg onderaan een tijdelijke stub toe:

```ts
import type { AdapterArgs, AnalyzeResult } from "./analyze";

export async function analyzeClaude<T>(
  _args: AdapterArgs<T>,
): Promise<AnalyzeResult<T>> {
  throw new Error("analyzeClaude not implemented yet (Task 8)");
}
```

Create `lib/ai/perplexity.ts`:

```ts
import type { AdapterArgs, AnalyzeResult } from "./analyze";

export async function analyzePerplexity<T>(
  _args: AdapterArgs<T>,
): Promise<AnalyzeResult<T>> {
  throw new Error("analyzePerplexity not implemented yet (Task 9)");
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test lib/ai/analyze.test.ts
```

Expected: PASS (2 tests). De adapters worden gemockt dus de stubs worden niet aangeroepen.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/analyze.ts lib/ai/analyze.test.ts lib/ai/claude.ts lib/ai/perplexity.ts
git commit -m "feat(ai): analyze() router + adapter-stubs"
```

---

### Task 8: Claude-adapter (single message, no caching)

**Files:**
- Modify: `lib/ai/claude.ts`
- Test: `lib/ai/claude.test.ts` (mogelijk al bestaand — uitbreiden of nieuw)

- [ ] **Step 1: Check bestaande Claude test-stijl**

```bash
ls lib/ai/*.test.ts
```

Als `claude.test.ts` bestaat: lees 'm en pas het patroon aan. Als niet: maak nieuwe.

- [ ] **Step 2: Schrijf failing test voor analyzeClaude**

In `lib/ai/claude.test.ts` (nieuw of uitgebreid):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

const schema = z.object({ score: z.number() });

describe("analyzeClaude", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    mockCreate = vi.fn();
    Anthropic.mockImplementation(() => ({
      messages: { create: mockCreate },
    }));
  });

  it("stuurt single user-message + parseert JSON-response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"score": 7}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
      model: "claude-sonnet-4-5",
    });
    const { analyzeClaude } = await import("./claude");
    const result = await analyzeClaude({ prompt: "test prompt", schema });
    expect(result.data).toEqual({ score: 7 });
    expect(result.llmModel).toBe("claude-sonnet-4-5");
    expect(result.llmInputTokens).toBe(100);
    expect(result.llmOutputTokens).toBe(50);
    expect(result.promptUsed).toBe("test prompt");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "test prompt" }],
      }),
    );
  });

  it("gooit error bij ongeldig JSON in response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "geen JSON" }],
      usage: { input_tokens: 50, output_tokens: 10 },
      model: "claude-sonnet-4-5",
    });
    const { analyzeClaude } = await import("./claude");
    await expect(analyzeClaude({ prompt: "x", schema })).rejects.toThrow();
  });

  it("gooit error als response niet aan schema voldoet", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"score": "niet een nummer"}' }],
      usage: { input_tokens: 50, output_tokens: 10 },
      model: "claude-sonnet-4-5",
    });
    const { analyzeClaude } = await import("./claude");
    await expect(analyzeClaude({ prompt: "x", schema })).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run, zie 'r 1 falen (de stub gooit "not implemented")**

```bash
pnpm test lib/ai/claude.test.ts
```

Expected: 3 FAILs.

- [ ] **Step 4: Implementeer analyzeClaude in `lib/ai/claude.ts`**

Vervang de stub uit Task 7 met:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { AdapterArgs, AnalyzeResult } from "./analyze";
import { calculateCostCents, PRICING } from "./pricing";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Single-message Claude call (geen system+user split, dus geen prompt-caching).
 * Bewust gekozen om uniformiteit met Perplexity te behouden — zie spec §3.
 */
export async function analyzeClaude<T>(
  args: AdapterArgs<T>,
): Promise<AnalyzeResult<T>> {
  const response = await client.messages.create({
    model: PRICING.claude.model,
    max_tokens: 4096,
    messages: [{ role: "user", content: args.prompt }],
  });

  // Tekst-content uit eerste content-block extraheren
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude response bevat geen tekst-content");
  }

  // JSON parsen en valideren tegen schema
  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `Claude response geen geldige JSON: ${textBlock.text.slice(0, 200)}`,
    );
  }
  const validated = args.schema.parse(parsed);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    data: validated,
    llmModel: response.model,
    llmInputTokens: inputTokens,
    llmOutputTokens: outputTokens,
    llmCostCents: calculateCostCents("claude", inputTokens, outputTokens),
    promptUsed: args.prompt,
  };
}
```

**Behoud `analyzeWithCachedSystem` voor nu** (PR 3 ruimt 'm op zodra Website Check gemigreerd is).

- [ ] **Step 5: Run tests**

```bash
pnpm test lib/ai/claude.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/claude.ts lib/ai/claude.test.ts
git commit -m "feat(ai): analyzeClaude single-message adapter"
```

---

### Task 9: Perplexity-adapter

**Files:**
- Modify: `lib/ai/perplexity.ts`
- Test: `lib/ai/perplexity.test.ts`

- [ ] **Step 1: Schrijf failing tests**

`lib/ai/perplexity.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const schema = z.object({ score: z.number() });

const originalFetch = global.fetch;

describe("analyzePerplexity", () => {
  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "pplx-test-key";
    global.fetch = vi.fn() as any;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("stuurt prompt via fetch + parseert JSON-response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"score": 8}' } }],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
        model: "sonar-pro",
      }),
    });
    const { analyzePerplexity } = await import("./perplexity");
    const result = await analyzePerplexity({ prompt: "hi", schema });
    expect(result.data).toEqual({ score: 8 });
    expect(result.llmModel).toBe("sonar-pro");
    expect(result.llmInputTokens).toBe(120);
    expect(result.llmOutputTokens).toBe(30);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.perplexity.ai/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer pplx-test-key",
        }),
      }),
    );
  });

  it("gooit error bij non-200 response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    const { analyzePerplexity } = await import("./perplexity");
    await expect(analyzePerplexity({ prompt: "x", schema })).rejects.toThrow(
      /401/,
    );
  });

  it("gooit error bij ongeldig JSON in content", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "geen JSON" } }],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
        model: "sonar-pro",
      }),
    });
    const { analyzePerplexity } = await import("./perplexity");
    await expect(analyzePerplexity({ prompt: "x", schema })).rejects.toThrow();
  });
});
```

Note: voeg bovenaan toe: `import { afterAll } from "vitest";`

- [ ] **Step 2: Run, zie ze falen**

```bash
pnpm test lib/ai/perplexity.test.ts
```

Expected: 3 FAILs.

- [ ] **Step 3: Implementeer analyzePerplexity**

Vervang `lib/ai/perplexity.ts`:

```ts
import type { AdapterArgs, AnalyzeResult } from "./analyze";
import { calculateCostCents, PRICING } from "./pricing";

const API_URL = "https://api.perplexity.ai/chat/completions";

/**
 * Perplexity sonar-pro adapter. Geen prompt-caching; voert single-message
 * call uit met ingebouwde web-search.
 */
export async function analyzePerplexity<T>(
  args: AdapterArgs<T>,
): Promise<AnalyzeResult<T>> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY ontbreekt in env");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PRICING.perplexity.model,
      messages: [{ role: "user", content: args.prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Perplexity API ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Perplexity response heeft geen content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `Perplexity response geen geldige JSON: ${content.slice(0, 200)}`,
    );
  }
  const validated = args.schema.parse(parsed);

  const inputTokens = payload.usage.prompt_tokens;
  const outputTokens = payload.usage.completion_tokens;

  return {
    data: validated,
    llmModel: payload.model,
    llmInputTokens: inputTokens,
    llmOutputTokens: outputTokens,
    llmCostCents: calculateCostCents("perplexity", inputTokens, outputTokens),
    promptUsed: args.prompt,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/ai/perplexity.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/perplexity.ts lib/ai/perplexity.test.ts
git commit -m "feat(ai): analyzePerplexity adapter"
```

---

### Task 10: Seed-script voor alle 11 modules

**Files:**
- Create: `scripts/seed-prompts.ts`
- Modify: `package.json` (script-entry)

- [ ] **Step 1: Maak seed-script**

`scripts/seed-prompts.ts`:

```ts
/**
 * Seed de `modules.defaultPrompt` + `modules.provider` velden voor alle
 * modules vanuit de FALLBACK_PROMPTS registry en de default-provider tabel.
 * Idempotent: schrijft alleen waar defaultPrompt nog leeg is.
 *
 * Run: pnpm tsx scripts/seed-prompts.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { modules } from "../lib/db/schema";
import { FALLBACK_PROMPTS } from "../lib/modules/fallback-prompts";
import type { Provider } from "../lib/ai/pricing";

// Default provider per module — admin kan altijd later wijzigen via de UI
const DEFAULT_PROVIDER: Record<string, Provider> = {
  "website-check": "claude",
  "website-check-concurrenten": "perplexity",
  "flyercheck": "claude",
  "marktonderzoek": "perplexity",
  "linkedin-analyse": "perplexity",
  "linkedin-concurrentie": "perplexity",
  "linkedin-concurrentie-kwartaal": "perplexity",
  "propositie-analyse": "claude",
  "icp-analyse": "claude",
  "klantcase-analyse": "claude",
  "gap-analyse": "perplexity",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing in .env.local");
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(client, { schema: { modules } });

  const slugs = Object.keys(FALLBACK_PROMPTS);
  console.log(`Seeding prompts voor ${slugs.length} modules...`);

  for (const slug of slugs) {
    const [existing] = await db
      .select({ defaultPrompt: modules.defaultPrompt, provider: modules.provider })
      .from(modules)
      .where(eq(modules.slug, slug))
      .limit(1);

    if (!existing) {
      console.log(`  ⚠ ${slug} bestaat nog niet in modules-tabel — run eerst seed-modules.ts`);
      continue;
    }

    const provider = DEFAULT_PROVIDER[slug] ?? "claude";

    if (existing.defaultPrompt && existing.defaultPrompt.length > 0) {
      // Niet overschrijven; alleen provider zetten als die nog default is.
      if (existing.provider !== provider) {
        await db.update(modules).set({ provider }).where(eq(modules.slug, slug));
        console.log(`  ↻ ${slug}: provider ${existing.provider} → ${provider}`);
      } else {
        console.log(`  ✓ ${slug}: al gevuld (skip)`);
      }
    } else {
      await db
        .update(modules)
        .set({ defaultPrompt: FALLBACK_PROMPTS[slug], provider })
        .where(eq(modules.slug, slug));
      console.log(`  ✓ ${slug}: prompt geseed (provider=${provider})`);
    }
  }

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Voeg script-entry toe aan package.json**

In `package.json`, in de `"scripts"`-sectie, voeg toe:

```json
    "seed:prompts": "tsx scripts/seed-prompts.ts",
```

(plaats 'm vlak na `db:studio`).

- [ ] **Step 3: Lokale dry-run NIET uitvoeren in deze stap**

(Pas na Task 1 + 2 SQL is uitgevoerd op de DB door de gebruiker. Documenteren in commit-message.)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-prompts.ts package.json
git commit -m "feat(prompts): seed-script populeert defaultPrompt + provider voor 11 modules

Run met 'pnpm seed:prompts' nadat de DB-migratie (0004) en RLS-policies
zijn uitgevoerd in Supabase. Idempotent: skipt al-gevulde rijen."
```

---

### Task 11: PR 1 — afronding (lokaal verifiëren + push voorstellen)

- [ ] **Step 1: Volledige test-suite + build**

```bash
pnpm test
pnpm build
```

Expected: alle tests groen, build slaagt zonder errors.

- [ ] **Step 2: Vraag user om SQL te draaien**

Geef user de inhoud van `drizzle/0004_<auto-name>.sql` en `drizzle/0004_admin_prompts_rls.sql` om te draaien in de Supabase SQL Editor — in deze volgorde:

1. De auto-generated migratie (provider enum + provider column + history table)
2. De RLS-policies

Daarna user laten draaien:

```bash
pnpm seed:prompts
```

Verifiëren in DB Studio (`pnpm db:studio`): `modules.defaultPrompt` is voor alle 11 slugs gevuld.

- [ ] **Step 3: Vraag user akkoord voor push naar origin/main**

Per project-conventie (CLAUDE.md): "Always ask before git push."

```bash
git log --oneline origin/main..HEAD
```

Toon de commits. Bij akkoord:

```bash
git push origin main
```

Daarna PR 1 afgerond.

---

## PR 2 — Editor UI

### Task 12: TipTap-dependencies installeren

**Files:**
- Modify: `package.json` (deps)

- [ ] **Step 1: Installeer dependencies**

```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-placeholder @tiptap/extension-text-align @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-header @tiptap/extension-table-cell marked turndown turndown-plugin-gfm
pnpm add -D @types/turndown
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: geen errors (dependencies klaar voor gebruik).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add TipTap + marked + turndown dependencies"
```

---

### Task 13: RichPromptEditor component (TipTap-wrapper)

**Files:**
- Create: `components/rich-prompt-editor.tsx`

- [ ] **Step 1: Schrijf component**

```tsx
// components/rich-prompt-editor.tsx
"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { useEffect, useRef } from "react";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Heading3, Table as TableIcon, AlignLeft,
  AlignCenter, AlignRight, Undo, Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});
turndown.use(gfm);

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

async function markdownToHtml(md: string): Promise<string> {
  if (!md) return "";
  return await marked(md, { gfm: true, breaks: false });
}

export type RichPromptEditorHandle = {
  insertText: (text: string) => void;
};

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  editorRef?: React.MutableRefObject<RichPromptEditorHandle | null>;
}

export function RichPromptEditor({
  value,
  onChange,
  placeholder = "Voer de prompt in...",
  minHeight = 400,
  editorRef,
}: Props) {
  const lastEmittedValue = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: "",
    onUpdate({ editor }) {
      const md = htmlToMarkdown(editor.getHTML());
      if (md !== lastEmittedValue.current) {
        lastEmittedValue.current = md;
        onChange(md);
      }
    },
    immediatelyRender: false, // Next.js compat (avoid hydration mismatch)
  });

  // Wanneer `value` van buiten verandert (bv. module-wissel): herlaad content
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedValue.current) return;
    let cancelled = false;
    markdownToHtml(value).then((html) => {
      if (cancelled) return;
      editor.commands.setContent(html, false);
      lastEmittedValue.current = value;
    });
    return () => {
      cancelled = true;
    };
  }, [value, editor]);

  // Expose imperatieve handle voor placeholder-chip-insert
  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
    };
    return () => {
      if (editorRef) editorRef.current = null;
    };
  }, [editor, editorRef]);

  if (!editor) return null;

  return (
    <div
      className="rounded-lg border bg-white"
      style={{ minHeight }}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 focus:outline-none"
        style={{ minHeight: minHeight - 48 }}
      />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn =
    "rounded p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-40";
  const active = "bg-purple-100 text-purple-700";
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 px-2 py-1.5">
      <button type="button" className={cn(btn, editor.isActive("bold") && active)}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btn, editor.isActive("italic") && active)}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btn, editor.isActive("underline") && active)}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </button>
      <Sep />
      <button type="button" className={cn(btn, editor.isActive("heading", { level: 1 }) && active)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btn, editor.isActive("heading", { level: 2 }) && active)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btn, editor.isActive("heading", { level: 3 }) && active)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </button>
      <Sep />
      <button type="button" className={cn(btn, editor.isActive("bulletList") && active)}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btn, editor.isActive("orderedList") && active)}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </button>
      <Sep />
      <button type="button" className={btn}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon className="h-4 w-4" />
      </button>
      <Sep />
      <button type="button" className={cn(btn, editor.isActive({ textAlign: "left" }) && active)}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btn, editor.isActive({ textAlign: "center" }) && active)}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btn, editor.isActive({ textAlign: "right" }) && active)}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </button>
      <Sep />
      <button type="button" className={btn}
        onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </button>
      <button type="button" className={btn}
        onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </button>
    </div>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-gray-300" />;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: geen errors.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: build slaagt.

- [ ] **Step 4: Commit**

```bash
git add components/rich-prompt-editor.tsx
git commit -m "feat(ui): RichPromptEditor TipTap-wrapper met Markdown ↔ HTML"
```

---

### Task 14: Server actions (savePrompt, resetPrompt, restoreVersion)

**Files:**
- Create: `app/(admin)/admin/prompts/[slug]/actions.ts`

- [ ] **Step 1: Schrijf de actions**

```ts
// app/(admin)/admin/prompts/[slug]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { modules, modulePromptHistory, profiles } from "@/lib/db/schema";
import { FALLBACK_PROMPTS } from "@/lib/modules/fallback-prompts";

const ProviderSchema = z.enum(["claude", "perplexity"]);
const SaveInputSchema = z.object({
  slug: z.string().min(1),
  prompt: z.string(),
  provider: ProviderSchema,
});

/** Auth-guard: verifieer huidige user is admin. Throwt anders. */
async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd");

  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!p || p.role !== "admin") throw new Error("Alleen admins");
  return { userId: user.id };
}

/** Snapshot huidige prompt naar history. */
async function snapshotToHistory(slug: string, userId: string) {
  const [current] = await db
    .select({ prompt: modules.defaultPrompt, provider: modules.provider })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (!current) throw new Error(`Module ${slug} niet in DB`);
  await db.insert(modulePromptHistory).values({
    moduleSlug: slug,
    prompt: current.prompt ?? "",
    provider: current.provider,
    savedBy: userId,
  });
}

/** Sla een nieuwe prompt + provider op. */
export async function savePrompt(input: unknown): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = SaveInputSchema.parse(input);

  await snapshotToHistory(parsed.slug, userId);

  await db
    .update(modules)
    .set({ defaultPrompt: parsed.prompt, provider: parsed.provider })
    .where(eq(modules.slug, parsed.slug));

  revalidatePath(`/admin/prompts/${parsed.slug}`);
}

/** Zet de prompt terug naar de fallback uit code (Reset-knop). */
export async function resetPrompt(input: { slug: string }): Promise<void> {
  const { userId } = await requireAdmin();
  const slug = z.string().min(1).parse(input.slug);

  const fallback = FALLBACK_PROMPTS[slug];
  if (!fallback) throw new Error(`Geen fallback voor ${slug}`);

  await snapshotToHistory(slug, userId);

  await db
    .update(modules)
    .set({ defaultPrompt: fallback })
    .where(eq(modules.slug, slug));

  revalidatePath(`/admin/prompts/${slug}`);
}

/** Zet een oude versie terug uit history. */
export async function restoreVersion(input: {
  slug: string;
  historyId: string;
}): Promise<void> {
  const { userId } = await requireAdmin();
  const slug = z.string().min(1).parse(input.slug);
  const historyId = z.string().uuid().parse(input.historyId);

  const [hist] = await db
    .select({ prompt: modulePromptHistory.prompt, provider: modulePromptHistory.provider })
    .from(modulePromptHistory)
    .where(
      and(
        eq(modulePromptHistory.id, historyId),
        eq(modulePromptHistory.moduleSlug, slug),
      ),
    )
    .limit(1);
  if (!hist) throw new Error(`History-entry ${historyId} niet gevonden`);

  await snapshotToHistory(slug, userId);

  await db
    .update(modules)
    .set({ defaultPrompt: hist.prompt, provider: hist.provider })
    .where(eq(modules.slug, slug));

  revalidatePath(`/admin/prompts/${slug}`);
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/prompts/\[slug\]/actions.ts
git commit -m "feat(admin): server actions savePrompt/resetPrompt/restoreVersion"
```

---

### Task 15: Sidebar component (lijst van modules)

**Files:**
- Create: `app/(admin)/admin/prompts/[slug]/sidebar.tsx`

- [ ] **Step 1: Schrijf component**

```tsx
// app/(admin)/admin/prompts/[slug]/sidebar.tsx
import Link from "next/link";
import { MODULES } from "@/lib/modules/registry";
import { cn } from "@/lib/utils";

export function PromptsSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <nav className="w-[280px] shrink-0 border-r border-gray-200 bg-gray-50">
      <div className="px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Modules
        </div>
      </div>
      <ul className="space-y-px px-2 pb-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const isActive = m.slug === activeSlug;
          return (
            <li key={m.slug}>
              <Link
                href={`/admin/prompts/${m.slug}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-purple-100 text-purple-900"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", m.iconColor)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">
                    {m.status === "active" ? "Actief" : "Binnenkort"}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/prompts/\[slug\]/sidebar.tsx
git commit -m "feat(admin): PromptsSidebar component"
```

---

### Task 16: Editor pane (client component met provider + placeholders + save)

**Files:**
- Create: `app/(admin)/admin/prompts/[slug]/editor-pane.tsx`

- [ ] **Step 1: Schrijf component**

```tsx
// app/(admin)/admin/prompts/[slug]/editor-pane.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  RichPromptEditor,
  type RichPromptEditorHandle,
} from "@/components/rich-prompt-editor";
import { savePrompt, resetPrompt } from "./actions";
import { cn } from "@/lib/utils";

type Provider = "claude" | "perplexity";
type Placeholder = { key: string; label: string; example: string };

interface Props {
  slug: string;
  moduleName: string;
  moduleStatus: "active" | "soon" | "disabled";
  initialPrompt: string;
  initialProvider: Provider;
  placeholders: readonly Placeholder[];
}

export function EditorPane({
  slug,
  moduleName,
  moduleStatus,
  initialPrompt,
  initialProvider,
  placeholders,
}: Props) {
  const router = useRouter();
  const editorHandleRef = useRef<RichPromptEditorHandle | null>(null);

  const [prompt, setPrompt] = useState(initialPrompt);
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const isDirty =
    prompt !== initialPrompt || provider !== initialProvider;

  // Browser-close beforeunload warning bij dirty state
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  async function handleSave() {
    if (!isDirty) return;
    setSaving(true);
    try {
      await savePrompt({ slug, prompt, provider });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetConfirmOpen(false);
    setSaving(true);
    try {
      await resetPrompt({ slug });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{moduleName}</h1>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            moduleStatus === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-700",
          )}
        >
          {moduleStatus === "active" ? "Actief" : "Binnenkort"}
        </span>
        {isDirty && (
          <span className="ml-auto text-xs font-medium text-amber-700">
            ● Onopgeslagen wijzigingen
          </span>
        )}
      </div>

      {moduleStatus !== "active" && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Deze module heeft nog geen runtime — je wijzigingen worden bewaard
          maar nog niet gebruikt totdat de module is geïmplementeerd.
        </div>
      )}

      <div className="mt-6">
        <label className="text-sm font-medium text-gray-700">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          className="ml-3 rounded-md border border-gray-300 px-3 py-1 text-sm"
        >
          <option value="claude">Claude</option>
          <option value="perplexity">Perplexity</option>
        </select>
      </div>

      {placeholders.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-medium text-gray-700">
            Beschikbare placeholders
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                title={`${p.label} — voorbeeld: ${p.example}`}
                onClick={() => {
                  editorHandleRef.current?.insertText(`{${p.key}}`);
                }}
                className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 font-mono text-xs text-purple-700 hover:bg-purple-100"
              >
                {`{${p.key}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <RichPromptEditor
          value={prompt}
          onChange={setPrompt}
          editorRef={editorHandleRef}
          minHeight={480}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!isDirty || saving}
          onClick={handleSave}
          className={cn(
            "rounded-lg px-4 py-2 font-semibold text-white",
            isDirty && !saving
              ? "bg-gradient-to-r from-purple-600 to-blue-600"
              : "bg-gray-300",
          )}
        >
          {saving ? "Bezig…" : "💾 Opslaan"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setResetConfirmOpen(true)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          ↺ Reset naar default
        </button>
      </div>

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[400px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Reset naar default?</h2>
            <p className="mt-2 text-sm text-gray-700">
              De huidige prompt wordt opgeslagen in version-history en
              vervangen door de fallback uit de code. Doorgaan?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/prompts/\[slug\]/editor-pane.tsx
git commit -m "feat(admin): EditorPane client component met provider + placeholders"
```

---

### Task 17: Version history component

**Files:**
- Create: `app/(admin)/admin/prompts/[slug]/version-history.tsx`

- [ ] **Step 1: Schrijf component**

```tsx
// app/(admin)/admin/prompts/[slug]/version-history.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreVersion } from "./actions";
import { cn } from "@/lib/utils";

export type HistoryEntry = {
  id: string;
  savedAt: string; // ISO string
  savedByName: string;
  provider: "claude" | "perplexity";
  promptPreview: string; // eerste 80 chars
};

interface Props {
  slug: string;
  entries: HistoryEntry[];
}

export function VersionHistory({ slug, entries }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleRestore(historyId: string) {
    setConfirmId(null);
    setBusyId(historyId);
    try {
      await restoreVersion({ slug, historyId });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700"
      >
        <span
          className={cn("transition-transform", open && "rotate-90")}
          aria-hidden
        >
          ▸
        </span>
        Versie-historie ({entries.length})
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {entries.length === 0 && (
            <li className="text-xs text-gray-500">Nog geen saves.</li>
          )}
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {new Date(e.savedAt).toLocaleString("nl-NL")}
                </div>
                <div className="text-xs text-gray-500">
                  {e.savedByName} · {e.provider} · "{e.promptPreview}…"
                </div>
              </div>
              <button
                type="button"
                disabled={busyId === e.id}
                onClick={() => setConfirmId(e.id)}
                className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-50"
              >
                {busyId === e.id ? "Bezig…" : "Terugzetten"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[420px] rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Versie terugzetten?</h2>
            <p className="mt-2 text-sm text-gray-700">
              De huidige prompt wordt opgeslagen in history en vervangen door
              deze oude versie. Doorgaan?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => handleRestore(confirmId)}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Terugzetten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add app/\(admin\)/admin/prompts/\[slug\]/version-history.tsx
git commit -m "feat(admin): VersionHistory accordion + restore-flow"
```

---

### Task 18: Hoofdpagina `[slug]/page.tsx` (server component)

**Files:**
- Create: `app/(admin)/admin/prompts/[slug]/page.tsx`

- [ ] **Step 1: Schrijf de pagina**

```tsx
// app/(admin)/admin/prompts/[slug]/page.tsx
import { notFound, redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { modules, modulePromptHistory, profiles } from "@/lib/db/schema";
import { MODULES, getModule } from "@/lib/modules/registry";
import { PromptsSidebar } from "./sidebar";
import { EditorPane } from "./editor-pane";
import { VersionHistory, type HistoryEntry } from "./version-history";

// Placeholders per module — dynamisch importeren omdat niet elke module 'm exporteert
async function loadPlaceholders(slug: string) {
  try {
    const mod = await import(`@/modules/${slug}/index`);
    return (mod.PLACEHOLDERS ?? []) as readonly {
      key: string;
      label: string;
      example: string;
    }[];
  } catch {
    return [];
  }
}

export default async function PromptEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Auth-guard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/prompts/${slug}`);
  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (!p || p.role !== "admin") notFound();

  // Module-bestaan check
  const meta = getModule(slug);
  if (!meta) notFound();

  // Huidige prompt + provider
  const [row] = await db
    .select({
      defaultPrompt: modules.defaultPrompt,
      provider: modules.provider,
    })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (!row) notFound();

  // History (max 50, nieuwste eerst)
  const histRows = await db
    .select({
      id: modulePromptHistory.id,
      savedAt: modulePromptHistory.savedAt,
      savedBy: modulePromptHistory.savedBy,
      prompt: modulePromptHistory.prompt,
      provider: modulePromptHistory.provider,
    })
    .from(modulePromptHistory)
    .where(eq(modulePromptHistory.moduleSlug, slug))
    .orderBy(desc(modulePromptHistory.savedAt))
    .limit(50);

  // Lookup namen voor savedBy
  const ids = Array.from(new Set(histRows.map((h) => h.savedBy)));
  const nameMap = new Map<string, string>();
  if (ids.length > 0) {
    const profs = await db
      .select({ id: profiles.id, fullName: profiles.fullName })
      .from(profiles);
    for (const pr of profs) {
      if (ids.includes(pr.id)) nameMap.set(pr.id, pr.fullName ?? "—");
    }
  }

  const historyEntries: HistoryEntry[] = histRows.map((h) => ({
    id: h.id,
    savedAt: h.savedAt.toISOString(),
    savedByName: nameMap.get(h.savedBy) ?? "—",
    provider: h.provider as "claude" | "perplexity",
    promptPreview: h.prompt.slice(0, 80),
  }));

  const placeholders = await loadPlaceholders(slug);

  return (
    <div className="flex h-[calc(100vh-60px)]">
      <PromptsSidebar activeSlug={slug} />
      <div className="flex flex-1 flex-col">
        <EditorPane
          slug={slug}
          moduleName={meta.name}
          moduleStatus={meta.status}
          initialPrompt={row.defaultPrompt ?? ""}
          initialProvider={row.provider as "claude" | "perplexity"}
          placeholders={placeholders}
        />
        <div className="border-t border-gray-200 px-8 py-4">
          <VersionHistory slug={slug} entries={historyEntries} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

Expected: build slaagt; route `/admin/prompts/[slug]` verschijnt in output.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/prompts/\[slug\]/page.tsx
git commit -m "feat(admin): /admin/prompts/[slug] editor pagina (sidebar + editor + history)"
```

---

### Task 19: Index-pagina /admin/prompts → redirect

**Files:**
- Modify: `app/(admin)/admin/prompts/page.tsx`

- [ ] **Step 1: Vervang inhoud**

Vervang de bestaande overview-pagina volledig met:

```tsx
import { redirect } from "next/navigation";

export default function PromptsIndexPage() {
  // Sidebar is het overzicht — redirect direct naar de eerste actieve module.
  redirect("/admin/prompts/website-check");
}
```

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: build slaagt. Verifieer dat oude grid niet meer wordt gebouwd.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/prompts/page.tsx
git commit -m "feat(admin): /admin/prompts → redirect naar eerste actieve module"
```

---

### Task 20: PR 2 — afronding

- [ ] **Step 1: Volledige verifie**

```bash
pnpm test
pnpm build
```

Expected: alle tests groen, build slaagt.

- [ ] **Step 2: User-test op een dev-deploy**

Vraag user om te testen op een Vercel-preview-deploy of lokaal via `pnpm dev`:

1. Login als admin
2. Open `/admin/prompts` → moet auto-redirect naar `/admin/prompts/website-check`
3. Klik door alle modules in de sidebar — geen errors
4. Bewerk Website Check prompt, sla op → moet een history-rij produceren
5. Klik Reset → bevestig → prompt wordt teruggezet naar `FALLBACK_PROMPT`
6. Klik op een history-rij → bevestig → prompt wordt teruggezet
7. Wijzig provider naar Perplexity → save → verifieer in DB Studio

- [ ] **Step 3: Vraag user akkoord voor push**

```bash
git log --oneline origin/main..HEAD
git push origin main
```

Daarna PR 2 afgerond.

---

## PR 3 — Website Check runtime-migratie

### Task 21: Website Check service migreren naar nieuw patroon

**Files:**
- Modify: `modules/website-check/service.ts`

- [ ] **Step 1: Lees huidige service.ts ter referentie**

```bash
cat modules/website-check/service.ts
```

- [ ] **Step 2: Vervang `runAnalysis` met nieuwe versie**

Volledige nieuwe `modules/website-check/service.ts`:

```ts
import { randomBytes } from "node:crypto";
import { analyze } from "@/lib/ai/analyze";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { scrapeWebsite } from "./scraper";
import {
  WebsiteCheckOutputSchema,
  type WebsiteCheckOutput,
} from "./schema";
import { MODULE_SLUG } from "./index";

export type ServiceDeps = {
  scrape: (url: string) => Promise<string>;
  analyze: typeof analyze;
  fetchPrompt: typeof getModulePrompt;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
}

export const defaultDeps: ServiceDeps = {
  scrape: scrapeWebsite,
  analyze,
  fetchPrompt: getModulePrompt,
  updateSession: async (id, patch) => {
    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("@/lib/db/client");
    const { sessions } = await import("@/lib/db/schema");
    await db
      .update(sessions)
      .set(patch)
      .where(and(eq(sessions.id, id), eq(sessions.status, "running")));
  },
};

export async function createWebsiteCheckSession(input: {
  userId: string;
  websiteUrl: string;
  companyName: string;
}): Promise<{ sessionId: string; shareSlug: string }> {
  const { db } = await import("@/lib/db/client");
  const { sessions } = await import("@/lib/db/schema");
  const shareSlug = generateShareSlug();
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      moduleSlug: MODULE_SLUG,
      status: "running",
      input: { websiteUrl: input.websiteUrl, companyName: input.companyName },
      shareSlug,
    })
    .returning({ id: sessions.id });
  return { sessionId: row.id, shareSlug };
}

export async function runAnalysis(
  args: { sessionId: string; websiteUrl: string; companyName: string },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    // 1. Scrape de website (zelfde als voorheen)
    const scraped = await deps.scrape(args.websiteUrl);

    // 2. Haal de actieve prompt + provider uit de DB
    const { prompt: template, provider } = await deps.fetchPrompt(MODULE_SLUG);

    // 3. Substitueer placeholders met runtime-waarden
    const prompt = substitutePlaceholders(template, {
      websiteUrl: args.websiteUrl,
      companyName: args.companyName || "Onbekend",
      scrapedContent: scraped || "(Kon website niet laden)",
    });

    // 4. Provider-agnostic analyze
    const result = await deps.analyze({
      provider,
      prompt,
      schema: WebsiteCheckOutputSchema,
    });

    // 5. Sessie afronden
    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: result.data,
      promptUsed: result.promptUsed,
      llmModel: result.llmModel,
      llmInputTokens: result.llmInputTokens,
      llmOutputTokens: result.llmOutputTokens,
      llmCostCents: result.llmCostCents,
      completedAt: new Date(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await deps.updateSession(args.sessionId, {
      status: "failed",
      errorMessage: msg,
      completedAt: new Date(),
    });
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: geen errors.

- [ ] **Step 4: Commit (nog niet pushen — tests moeten eerst geüpdatet)**

```bash
git add modules/website-check/service.ts
git commit -m "refactor(website-check): runAnalysis gebruikt getModulePrompt + analyze"
```

---

### Task 22: service.test.ts bijwerken

**Files:**
- Modify: `modules/website-check/service.test.ts`

- [ ] **Step 1: Bekijk huidige tests**

```bash
cat modules/website-check/service.test.ts
```

- [ ] **Step 2: Update mocks**

Pas alle mock-deps aan zodat ze de nieuwe interface volgen. Belangrijkste verandering:
- `deps.analyze` neemt nu `{ provider, prompt, schema }` (was `{ system, user }`)
- `deps.fetchPrompt` is nieuw — moet 'm meegeven

Voorbeeld van geüpdatet test-blok:

```ts
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { runAnalysis, type ServiceDeps } from "./service";
import { WebsiteCheckOutputSchema, type WebsiteCheckOutput } from "./schema";

const FAKE_OUTPUT: WebsiteCheckOutput = {
  companyName: "Acme",
  websiteUrl: "https://acme.test",
  overallScore: 7,
  executiveSummary: "Test",
  onderdelen: [/* ... */] as any,
  sterkePunten: ["a", "b", "c"],
  verbeterpunten: ["x", "y", "z"],
  topActies: [/* ... */] as any,
};

function makeDeps(overrides: Partial<ServiceDeps> = {}): ServiceDeps {
  return {
    scrape: vi.fn().mockResolvedValue("scraped html content"),
    fetchPrompt: vi.fn().mockResolvedValue({
      prompt: "Analyseer {websiteUrl} van {companyName} met content {scrapedContent}",
      provider: "claude",
    }),
    analyze: vi.fn().mockResolvedValue({
      data: FAKE_OUTPUT,
      llmModel: "claude-sonnet-4-5",
      llmInputTokens: 100,
      llmOutputTokens: 50,
      llmCostCents: 3,
      promptUsed: "...",
    }),
    updateSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("runAnalysis (na refactor)", () => {
  it("scrapt, fetcht prompt, substitueert, analyseert, slaat op", async () => {
    const deps = makeDeps();
    await runAnalysis(
      { sessionId: "s-1", websiteUrl: "https://acme.test", companyName: "Acme" },
      deps,
    );

    expect(deps.scrape).toHaveBeenCalledWith("https://acme.test");
    expect(deps.fetchPrompt).toHaveBeenCalledWith("website-check");
    expect(deps.analyze).toHaveBeenCalledWith({
      provider: "claude",
      prompt: expect.stringContaining("Analyseer https://acme.test van Acme"),
      schema: WebsiteCheckOutputSchema,
    });
    expect(deps.updateSession).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        status: "approved",
        llmInputTokens: 100,
      }),
    );
  });

  it("zet status='failed' bij fout in scrape", async () => {
    const deps = makeDeps({
      scrape: vi.fn().mockRejectedValue(new Error("scrape fail")),
    });
    await runAnalysis(
      { sessionId: "s-2", websiteUrl: "x", companyName: "y" },
      deps,
    );
    expect(deps.updateSession).toHaveBeenCalledWith(
      "s-2",
      expect.objectContaining({
        status: "failed",
        errorMessage: "scrape fail",
      }),
    );
  });

  it("zet status='failed' bij fout in fetchPrompt", async () => {
    const deps = makeDeps({
      fetchPrompt: vi.fn().mockRejectedValue(new Error("DB down")),
    });
    await runAnalysis(
      { sessionId: "s-3", websiteUrl: "x", companyName: "y" },
      deps,
    );
    expect(deps.updateSession).toHaveBeenCalledWith(
      "s-3",
      expect.objectContaining({
        status: "failed",
        errorMessage: "DB down",
      }),
    );
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test modules/website-check/service.test.ts
```

Expected: PASS (3+ tests).

- [ ] **Step 4: Run ook prompt.test.ts**

```bash
pnpm test modules/website-check/prompt.test.ts
```

Als 'r tests breken op `SYSTEM_PROMPT` of `buildUserPrompt`: update ze om de nieuwe `FALLBACK_PROMPT` te testen, of verwijder ze als ze niet meer relevant zijn.

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/service.test.ts modules/website-check/prompt.test.ts
git commit -m "test(website-check): bijwerken voor nieuwe getModulePrompt + analyze flow"
```

---

### Task 23: Opruimen ongebruikte exports

**Files:**
- Modify: `modules/website-check/prompt.ts`
- Modify: `lib/ai/claude.ts`

- [ ] **Step 1: Verwijder `SYSTEM_PROMPT` en `buildUserPrompt`**

In `modules/website-check/prompt.ts`: behoud alleen `FALLBACK_PROMPT` (en `ONDERDELEN` als die elders gebruikt wordt — check via grep).

```bash
grep -r "ONDERDELEN" --include="*.ts" --include="*.tsx" -l
grep -r "SYSTEM_PROMPT" --include="*.ts" --include="*.tsx" -l
grep -r "buildUserPrompt" --include="*.ts" --include="*.tsx" -l
```

Verwijder `SYSTEM_PROMPT` en `buildUserPrompt` als ze nergens meer ge-imported worden.

- [ ] **Step 2: Verwijder `analyzeWithCachedSystem` uit `lib/ai/claude.ts`**

```bash
grep -r "analyzeWithCachedSystem" --include="*.ts" --include="*.tsx" -l
```

Als alleen `service.ts` (oude versie) of 'n test 'm gebruikt — beide weg of beide bijgewerkt — verwijder de export uit `claude.ts`.

- [ ] **Step 3: Typecheck + tests + build**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: alles slaagt.

- [ ] **Step 4: Commit**

```bash
git add modules/website-check/prompt.ts lib/ai/claude.ts
git commit -m "refactor(website-check): verwijder ongebruikte SYSTEM_PROMPT/buildUserPrompt + analyzeWithCachedSystem"
```

---

### Task 24: PR 3 — afronding + smoke-test

- [ ] **Step 1: Push naar origin/main (na akkoord user)**

```bash
git log --oneline origin/main..HEAD
git push origin main
```

- [ ] **Step 2: Wacht op Vercel-deploy**

~1-2 min. Verifieer in Vercel dashboard dat deploy "Ready" is.

- [ ] **Step 3: Smoke-test op productie**

Vraag user om in een ingelogde sessie:

1. Hard refresh `https://positionr.nl/modules/website-check`
2. Start een analyse met `https://www.datapas.nl` (bekend werkende site)
3. Wacht tot de analyse klaar is (~50s)
4. Verifieer in DB:

```sql
select status, llm_model, llm_input_tokens, llm_output_tokens, llm_cost_cents
from sessions where module_slug = 'website-check'
order by created_at desc limit 3;
```

Expected: `status='approved'`, `llm_model='claude-sonnet-4-5'`, tokens > 0.

5. (Optioneel) Wijzig in `/admin/prompts/website-check` de prompt minimaal (bv. typo), save, run opnieuw → verifieer dat de nieuwe prompt is gebruikt (zie `prompt_used` veld in DB).

- [ ] **Step 4: Bij succes — PR 3 afgerond, feature live**

```
git log --oneline -10
```

Alle commits zichtbaar; de feature is volledig live.

---

## Outside-of-scope follow-ups

Documenteer in een GitHub-issue (of feature_requests-tabel) voor later:

1. **ICP Analyse runtime migreren** naar `getModulePrompt + analyze`
2. **Per-user prompt-override** via `sessions.prompt_override`
3. **Diff-view** in version history
4. **Prompt-validatie** (placeholder-typecheck, max-lengte)
5. **De 9 "soon"-modules** runtime bouwen — gebruiken het nieuwe patroon vanaf dag 1
