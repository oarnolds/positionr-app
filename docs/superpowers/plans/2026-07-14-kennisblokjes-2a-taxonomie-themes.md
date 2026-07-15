# Kennisblokjes 2A — Taxonomie, datamodel & kaart-themes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Goedgekeurde kennis-kaarten krijgen een `themes[]`-veld dat op een vaste taxonomie is gemapt — automatisch toegewezen bij goedkeuring (LLM-suggestie) én via een backfill voor bestaande kaarten. Dit is de data waarop de matching-engine (plan 2B) draait.

**Architecture:** Een gecureerde, in git geversioneerde taxonomie (`lib/knowledge/taxonomy.ts`). Een pure suggestie-laag (`lib/knowledge/themes.ts`) bouwt een prompt en parset de LLM-output naar geldige taxonomie-slugs. Bij goedkeuring van een kaart start `approveCardAction` — net als de distillatie — via Next `after()` een achtergrond-toewijzing die `suggestThemes` draait en `knowledge_cards.themes` zet. Een eenmalig script doet hetzelfde voor bestaande goedgekeurde kaarten.

**Tech Stack:** TypeScript, Drizzle (Postgres/Supabase), Anthropic SDK via `analyzeClaudeRaw`, Vitest (node-env), `tsx` voor scripts.

**Spec:** `docs/superpowers/specs/2026-07-14-kennisblokjes-subsysteem-2-design.md` (secties "Taxonomie" en "Admin-uitbreiding (subsysteem 1)").

**Scope:** Dit is plan **2A van 2**. De matching-engine + rendering zitten in **plan 2B**. Bewust NIET in 2A: de handmatige admin-multiselect-editor voor themes (auto-toewijzing + backfill dekt de datavraag van 2B; de handmatige editor is een latere polish). Geen `sessions.knowledge_blocks` (die kolom hoort bij 2B).

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid | Actie |
| --- | --- | --- |
| `lib/knowledge/taxonomy.ts` | Gecureerde thema-lijst + `filterValidThemes` | Nieuw |
| `lib/knowledge/taxonomy.test.ts` | Test voor `filterValidThemes` | Nieuw |
| `lib/knowledge/themes.ts` | `buildThemeSuggestionPrompt`, `parseThemeSlugs`, `suggestThemes`, `assignThemes` | Nieuw |
| `lib/knowledge/themes.test.ts` | Test voor prompt-bouw + parse | Nieuw |
| `lib/db/schema.ts` | `knowledge_cards.themes` kolom | Modify |
| DB-migratie | `ALTER TABLE knowledge_cards ADD COLUMN themes` | Nieuw |
| `app/(admin)/admin/kennis/actions.ts` | `approveCardAction` → `after(assignThemes)` | Modify |
| `scripts/backfill-card-themes.ts` | Themes voor bestaande goedgekeurde kaarten | Nieuw |

---

## Task 1: Taxonomie + `filterValidThemes`

**Files:**
- Create: `lib/knowledge/taxonomy.ts`
- Test: `lib/knowledge/taxonomy.test.ts`

- [ ] **Step 1: Schrijf de falende test**

`lib/knowledge/taxonomy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TAXONOMY, THEME_SLUGS, filterValidThemes } from "./taxonomy";

describe("taxonomy", () => {
  it("heeft unieke, kebab-case slugs", () => {
    const slugs = TAXONOMY.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(THEME_SLUGS.size).toBe(slugs.length);
  });

  it("filterValidThemes houdt alleen geldige slugs, genormaliseerd en ontdubbeld", () => {
    expect(filterValidThemes(["bewijsvoering", "onzin", "BEWIJSVOERING", " cta-conversie "]))
      .toEqual(["bewijsvoering", "cta-conversie"]);
  });

  it("filterValidThemes op lege/rommelige input → lege lijst", () => {
    expect(filterValidThemes([])).toEqual([]);
    expect(filterValidThemes(["", "  ", "bestaat-niet"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `pnpm exec vitest run lib/knowledge/taxonomy.test.ts`
Expected: FAIL — module `./taxonomy` bestaat niet.

- [ ] **Step 3: Implementeer**

`lib/knowledge/taxonomy.ts`:

```ts
/**
 * Gecureerde, in git geversioneerde kennis-taxonomie. Dit is de ENIGE
 * toegestane woordenschat voor knowledge_cards.themes én voor de classify-stap
 * in de matching-engine (plan 2B). Uitbreiden = een bewuste git-wijziging.
 */
export type Theme = { slug: string; label: string };

export const TAXONOMY: readonly Theme[] = [
  { slug: "waardepropositie", label: "Waardepropositie" },
  { slug: "klantvoordelen", label: "Klantvoordelen / benefits" },
  { slug: "bewijsvoering", label: "Bewijsvoering" },
  { slug: "sociale-bewijskracht", label: "Sociale bewijskracht" },
  { slug: "autoriteit-expertise", label: "Autoriteit & expertise" },
  { slug: "schaarste-urgentie", label: "Schaarste & urgentie" },
  { slug: "wederkerigheid", label: "Wederkerigheid" },
  { slug: "commitment-consistentie", label: "Commitment & consistentie" },
  { slug: "sympathie-relatie", label: "Sympathie & relatie" },
  { slug: "positionering-onderscheid", label: "Positionering & onderscheid" },
  { slug: "doelgroep-icp", label: "Doelgroep & ideale klant" },
  { slug: "storytelling-klantcase", label: "Storytelling & klantcases" },
  { slug: "cta-conversie", label: "CTA & conversie" },
  { slug: "prijs-waardeperceptie", label: "Prijs & waardeperceptie" },
  { slug: "content-thought-leadership", label: "Content & thought leadership" },
  { slug: "vertrouwen-risicoreductie", label: "Vertrouwen & risicoreductie" },
  { slug: "boodschap-copyhelderheid", label: "Boodschap & copy-helderheid" },
  { slug: "gedrag-besliskunde", label: "Gedrag & besliskunde" },
] as const;

export const THEME_SLUGS: ReadonlySet<string> = new Set(
  TAXONOMY.map((t) => t.slug),
);

/** Normaliseert (trim + lowercase), houdt alleen bestaande slugs, ontdubbelt. */
export function filterValidThemes(slugs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of slugs) {
    const norm = raw.trim().toLowerCase();
    if (THEME_SLUGS.has(norm) && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `pnpm exec vitest run lib/knowledge/taxonomy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/taxonomy.ts lib/knowledge/taxonomy.test.ts
git commit -m "feat(kennis): gecureerde thema-taxonomie + filterValidThemes"
```

---

## Task 2: `knowledge_cards.themes`-kolom + migratie

**Files:**
- Modify: `lib/db/schema.ts`
- Create: een SQL-migratie (via `pnpm db:generate`)

- [ ] **Step 1: Voeg de kolom toe aan het Drizzle-schema**

In `lib/db/schema.ts`, in `knowledgeCards`, direct ná de `tags`-regel (`tags: text("tags").array().default([]).notNull(),`), voeg toe:

```ts
  themes: text("themes").array().default([]).notNull(),
```

- [ ] **Step 2: Schrijf een focused SQL-migratie (handmatig — repo-conventie)**

Dit project gebruikt `drizzle-kit generate`/`migrate` NIET: `drizzle/meta/_journal.json` wordt bewust leeg gehouden en migraties zijn handgeschreven, genummerde SQL-bestanden die handmatig in Supabase worden toegepast (zie `drizzle/0004_admin_prompts.sql` en CLAUDE.md). Draai dus GEEN `pnpm db:generate` — die wil een volledige fresh-start baseline maken.

Maak `drizzle/00NN_knowledge_cards_themes.sql` (NN = hoogste bestaande nummer + 1) met:

```sql
-- Kennisbibliotheek — themes-kolom op knowledge_cards
alter table "knowledge_cards"
  add column "themes" text[] default '{}' not null;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: geen NIEUWE fouten in `lib/` (de afgeleide `KnowledgeCard`-type bevat nu `themes: string[]`). Negeer bestaande `.next/`-ruis.

- [ ] **Step 4: Pas de migratie toe op de database — DELIBERATE STEP**

Dit schrijft naar de echte Supabase-database. De kolom is **additief en non-breaking**, dus veilig, maar het is een DB-schrijfactie: laat de orchestrator/mens dit bewust uitvoeren. Plak de SQL in de **Supabase SQL Editor**, of pas 'm toe via de **Supabase-connector** (`apply_migration`). NIET via `pnpm db:migrate` (het journal is leeg).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(kennis): themes-kolom op knowledge_cards"
```

---

## Task 3: Themes-suggestie-laag

**Files:**
- Create: `lib/knowledge/themes.ts`
- Test: `lib/knowledge/themes.test.ts`

- [ ] **Step 1: Schrijf de falende test** (alleen de pure delen: prompt-bouw + parse)

`lib/knowledge/themes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildThemeSuggestionPrompt, parseThemeSlugs } from "./themes";

describe("buildThemeSuggestionPrompt", () => {
  it("bevat de kaart-inhoud en de taxonomie-slugs", () => {
    const p = buildThemeSuggestionPrompt({
      title: "Sociale bewijskracht",
      kern: "Mensen kijken naar wat anderen doen.",
      tags: ["bewijs", "vertrouwen"],
    });
    expect(p).toContain("Sociale bewijskracht");
    expect(p).toContain("Mensen kijken naar wat anderen doen.");
    expect(p).toContain("sociale-bewijskracht"); // taxonomie-optie
    expect(p).toContain("bewijs, vertrouwen"); // vrije tags meegegeven
  });
});

describe("parseThemeSlugs", () => {
  it("parset een JSON-array en houdt alleen geldige slugs", () => {
    expect(parseThemeSlugs('["bewijsvoering","sociale-bewijskracht","onzin"]'))
      .toEqual(["bewijsvoering", "sociale-bewijskracht"]);
  });
  it("werkt door markdown-fences heen", () => {
    expect(parseThemeSlugs('```json\n["cta-conversie"]\n```')).toEqual(["cta-conversie"]);
  });
  it("rommelige/lege output → lege lijst", () => {
    expect(parseThemeSlugs("geen array hier")).toEqual([]);
    expect(parseThemeSlugs("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `pnpm exec vitest run lib/knowledge/themes.test.ts`
Expected: FAIL — module `./themes` bestaat niet.

- [ ] **Step 3: Implementeer**

`lib/knowledge/themes.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards } from "@/lib/db/schema";
import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { TAXONOMY, filterValidThemes } from "./taxonomy";

export type CardForThemes = { title: string; kern: string; tags: string[] };

export function buildThemeSuggestionPrompt(card: CardForThemes): string {
  const opties = TAXONOMY.map((t) => `- ${t.slug}: ${t.label}`).join("\n");
  return `Je labelt een marketing/sales-kennis-kaart met thema's uit een VASTE taxonomie. Kies alleen slugs die écht op de kaart van toepassing zijn.

KAART
Titel: ${card.title}
Kern: ${card.kern}
Vrije tags: ${card.tags.join(", ") || "(geen)"}

TAXONOMIE (kies UITSLUITEND uit deze slugs):
${opties}

Geef UITSLUITEND een JSON-array van 1 tot 4 slugs die het best passen, bijvoorbeeld ["bewijsvoering","sociale-bewijskracht"]. Geen tekst eromheen.`;
}

/** Strip fences, pak de buitenste array, parse, filter op geldige taxonomie-slugs. */
export function parseThemeSlugs(raw: string): string[] {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const strings = parsed.filter((x): x is string => typeof x === "string");
  return filterValidThemes(strings);
}

/** Eén LLM-call → gesuggereerde taxonomie-thema's voor een kaart. */
export async function suggestThemes(card: CardForThemes): Promise<string[]> {
  const { markdown } = await analyzeClaudeRaw({
    prompt: buildThemeSuggestionPrompt(card),
  });
  return parseThemeSlugs(markdown);
}

/**
 * Zet themes op één kaart (best-effort). Slaat over als de kaart al themes
 * heeft. Faalt stil — thema-toewijzing mag nooit de goedkeuring blokkeren.
 */
export async function assignThemes(cardId: string): Promise<void> {
  const [card] = await db
    .select({
      id: knowledgeCards.id,
      title: knowledgeCards.title,
      kern: knowledgeCards.kern,
      tags: knowledgeCards.tags,
      themes: knowledgeCards.themes,
    })
    .from(knowledgeCards)
    .where(eq(knowledgeCards.id, cardId))
    .limit(1);
  if (!card || (card.themes && card.themes.length > 0)) return;
  try {
    const themes = await suggestThemes(card);
    if (themes.length > 0) {
      await db
        .update(knowledgeCards)
        .set({ themes, updatedAt: new Date() })
        .where(eq(knowledgeCards.id, cardId));
    }
  } catch {
    // best-effort
  }
}
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `pnpm exec vitest run lib/knowledge/themes.test.ts`
Expected: PASS (de pure prompt/parse-tests; `suggestThemes`/`assignThemes` doen echte calls en worden in Task 6 geverifieerd).

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/themes.ts lib/knowledge/themes.test.ts
git commit -m "feat(kennis): themes-suggestie (prompt, parse, assign)"
```

---

## Task 4: Auto-toewijzing bij goedkeuring

**Files:**
- Modify: `app/(admin)/admin/kennis/actions.ts`

- [ ] **Step 1: Importeer `assignThemes`**

In `app/(admin)/admin/kennis/actions.ts`, voeg bij de imports toe (bij de andere `@/lib/knowledge`-imports):

```ts
import { assignThemes } from "@/lib/knowledge/themes";
```

(`after` uit `next/server` is al geïmporteerd bovenin het bestand.)

- [ ] **Step 2: Start de toewijzing na goedkeuring**

Vervang de body van `approveCardAction` zodat na de status-update een achtergrond-toewijzing loopt (net als `runDistillation`). De huidige functie:

```ts
export async function approveCardAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!cardId) return;
  await db
    .update(knowledgeCards)
    .set({ status: "goedgekeurd", updatedAt: new Date() })
    .where(eq(knowledgeCards.id, cardId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}
```

wordt:

```ts
export async function approveCardAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!cardId) return;
  await db
    .update(knowledgeCards)
    .set({ status: "goedgekeurd", updatedAt: new Date() })
    .where(eq(knowledgeCards.id, cardId));
  // Thema's op de achtergrond toewijzen (LLM-suggestie) — mag de snelle
  // goedkeuring niet blokkeren en faalt stil.
  after(() => assignThemes(cardId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: geen nieuwe fouten in `app/(admin)/admin/kennis/`.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/kennis/actions.ts"
git commit -m "feat(kennis): wijs themes automatisch toe bij goedkeuring"
```

---

## Task 5: Backfill-script voor bestaande kaarten

**Files:**
- Create: `scripts/backfill-card-themes.ts`

- [ ] **Step 1: Schrijf het script**

`scripts/backfill-card-themes.ts`:

```ts
/**
 * Eenmalige backfill: geeft bestaande GOEDGEKEURDE kaarten zonder themes een
 * thema-suggestie. Idempotent — kaarten die al themes hebben worden overgeslagen.
 * Draaien: `pnpm exec tsx scripts/backfill-card-themes.ts`
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards } from "@/lib/db/schema";
import { suggestThemes } from "@/lib/knowledge/themes";

async function main() {
  const cards = await db
    .select()
    .from(knowledgeCards)
    .where(eq(knowledgeCards.status, "goedgekeurd"));
  const todo = cards.filter((c) => !c.themes || c.themes.length === 0);
  console.log(`${todo.length} goedgekeurde kaarten zonder themes (van ${cards.length}).`);

  let done = 0;
  for (const c of todo) {
    const themes = await suggestThemes({ title: c.title, kern: c.kern, tags: c.tags });
    if (themes.length > 0) {
      await db
        .update(knowledgeCards)
        .set({ themes, updatedAt: new Date() })
        .where(eq(knowledgeCards.id, c.id));
    }
    done++;
    console.log(`[${done}/${todo.length}] ${c.title} → ${themes.join(", ") || "(geen)"}`);
  }
  console.log("Klaar.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen nieuwe fouten (`scripts/` valt binnen de tsconfig include; zo niet, dan geen typecheck-gate voor scripts — dat is prima).

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-card-themes.ts
git commit -m "feat(kennis): backfill-script voor kaart-themes"
```

---

## Task 6: Verificatie (deliberate — echte DB + LLM)

**Files:** geen.

Deze stap raakt de echte database en doet LLM-calls; voer 'm bewust uit (met een geldige `.env.local`).

- [ ] **Step 1: Volledige test-suite (vangnet)**

Run: `pnpm test`
Expected: alle bestaande + nieuwe tests groen (taxonomy + themes pure-delen).

- [ ] **Step 2: Migratie toegepast?**

Bevestig dat `knowledge_cards` de kolom `themes` heeft (via Supabase MCP `list_tables`/`execute_sql` `SELECT column_name FROM information_schema.columns WHERE table_name='knowledge_cards' AND column_name='themes'`, of drizzle-studio). Verwacht: één rij.

- [ ] **Step 3: Backfill op een kleine set**

Draai het script (met echte env): `pnpm exec tsx scripts/backfill-card-themes.ts`
Verwacht: het logt per kaart de toegewezen thema's; goedgekeurde kaarten krijgen 1-4 geldige taxonomie-slugs. Draai het nog eens: verwacht "0 kaarten zonder themes" (idempotent).

- [ ] **Step 4: Auto-toewijzing (rooktest)**

Keur in `/admin/kennis/[sourceId]` een concept-kaart goed; controleer na enkele seconden (bv. via `execute_sql` `SELECT title, themes FROM knowledge_cards WHERE id='…'`) dat `themes` gevuld is.

---

## Self-review (uitgevoerd)

- **Spec-dekking:** taxonomie ✓, `knowledge_cards.themes` ✓, kaarten hertaggen (auto bij goedkeuring + backfill) ✓. De handmatige admin-multiselect uit de spec is bewust doorgeschoven (auto+backfill dekt de datavraag van 2B; zie "Uit scope"). `sessions.knowledge_blocks` hoort bij 2B.
- **Placeholders:** geen — alle code en commands concreet.
- **Type-consistentie:** `filterValidThemes` (Task 1) gebruikt door `parseThemeSlugs` (Task 3); `assignThemes` (Task 3) gebruikt door `approveCardAction` (Task 4) en het script (Task 5); allemaal op `knowledgeCards.themes` uit Task 2. `CardForThemes` matcht de velden die `suggestThemes`/backfill meegeven.
- **Ambiguïteit:** `assignThemes` slaat kaarten met bestaande themes over (idempotent) — expliciet.

## Uit scope / later

- **Handmatige admin-themes-editor** (multiselect met vooringevulde suggestie, waarschuwing bij goedkeuren zonder thema) — polish, apart plan.
- **Matching-engine + `sessions.knowledge_blocks` + rendering** — plan 2B.
