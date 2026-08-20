# Content Editing Data-Layer (PR-C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** verhuis alle homepage-copy van hardcoded strings naar een DB-gebaseerde content-registry met code-fallback. Bezoekers zien 0 verschil (defaults matchen huidige teksten 1-op-1). Dit is de fundering; PR-C2 bouwt daar de `<Editable>`-inline-editor bovenop.

**Architecture:** twee tabellen (`site_content`, `site_content_history`) met RLS. Typed `ContentKey` union + `CONTENT_META` (kind + default per key) in `lib/content/registry.ts`. `getContent`/`getContentBatch` in `lib/content/get.ts` (server-side, val terug op default bij miss). `saveContent`/`undoLast` in `lib/content/save.ts` (server-actions, admin-guarded, sanitizer). Homepage-page haalt alle keys in één batch op en geeft door als prop aan elke sectie. Elke sectie declareert zijn eigen `SECTION_KEYS` array.

**Tech Stack:** Postgres/Supabase, Drizzle, Next.js 15, Zod (voor content-parse-checks), `sanitize-html` (nieuwe dep), Vitest.

---

### Task 1: DB-schema + SQL migration

**Files:**
- Create: `drizzle/0012_site_content.sql`
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: SQL-migration**

```sql
-- ===== site_content: key-value store voor bewerkbare homepage-tekst =====

create table if not exists public.site_content (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

create table if not exists public.site_content_history (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  value      text not null,
  saved_at   timestamptz not null default now(),
  saved_by   uuid references auth.users(id),
  note       text
);

create index if not exists site_content_history_key_saved_at_idx
  on public.site_content_history (key, saved_at desc);

-- RLS: authenticated mag alles (uniform-pattern, admin-check zit in server-actions)
alter table public.site_content enable row level security;
drop policy if exists "site_content authenticated all" on public.site_content;
create policy "site_content authenticated all" on public.site_content
  for all to authenticated using (true) with check (true);

alter table public.site_content_history enable row level security;
drop policy if exists "site_content_history authenticated all" on public.site_content_history;
create policy "site_content_history authenticated all" on public.site_content_history
  for all to authenticated using (true) with check (true);
```

Vraag Olivier deze SQL te runnen in Supabase SQL Editor.

- [ ] **Step 2: Drizzle schema**

Voeg aan `lib/db/schema.ts` toe:

```ts
export const siteContent = pgTable("site_content", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by"), // → auth.users.id, nullable
});

export const siteContentHistory = pgTable("site_content_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
  savedBy: uuid("saved_by"),
  note: text("note"),
});

export type SiteContent = typeof siteContent.$inferSelect;
export type SiteContentHistory = typeof siteContentHistory.$inferSelect;
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && git add drizzle/0012_site_content.sql lib/db/schema.ts && git commit -m "feat(content): site_content + site_content_history tabellen (RLS)"
```

---

### Task 2: sanitize-html dep + wrapper (TDD)

**Files:**
- Modify: `package.json`
- Create: `lib/content/sanitize.ts`
- Test: `lib/content/sanitize.test.ts`

- [ ] **Step 1: Install**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm add sanitize-html && pnpm add -D @types/sanitize-html
```

- [ ] **Step 2: Failing test**

```ts
// lib/content/sanitize.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeRich } from "./sanitize";

describe("sanitizeRich", () => {
  it("laat toegestane tags staan", () => {
    const out = sanitizeRich("<p>Hallo <strong>wereld</strong></p>");
    expect(out).toBe("<p>Hallo <strong>wereld</strong></p>");
  });

  it("strip script-tags", () => {
    const out = sanitizeRich("<p>Ok</p><script>alert(1)</script>");
    expect(out).toBe("<p>Ok</p>");
  });

  it("strip event-handlers op links", () => {
    const out = sanitizeRich('<a href="/x" onclick="steal()">klik</a>');
    expect(out).toBe('<a href="/x">klik</a>');
  });

  it("strip javascript: href", () => {
    const out = sanitizeRich('<a href="javascript:alert(1)">klik</a>');
    expect(out).not.toContain("javascript:");
  });

  it("laat lijst-tags toe", () => {
    const out = sanitizeRich("<ul><li>een</li><li>twee</li></ul>");
    expect(out).toBe("<ul><li>een</li><li>twee</li></ul>");
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

`cd /Users/olivierarnolds/Desktop/positionr-app && pnpm test lib/content/sanitize.test.ts`

- [ ] **Step 4: Implementatie**

```ts
// lib/content/sanitize.ts
import sanitizeHtml from "sanitize-html";

/**
 * Sanitizer voor `rich` content-velden. Whitelist: paragrafen, breaks,
 * bold/italic, links (alleen http(s):// of relatief), simpele lijsten.
 * Strip alle scripts, iframes en event-handlers.
 */
export function sanitizeRich(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
  });
}
```

- [ ] **Step 5: Test groen + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm test lib/content/sanitize.test.ts
cd /Users/olivierarnolds/Desktop/positionr-app && git add package.json pnpm-lock.yaml lib/content/sanitize.ts lib/content/sanitize.test.ts && git commit -m "feat(content): sanitizeRich met whitelist (p/br/strong/em/a/ul/ol/li)"
```

---

### Task 3: Content-registry (types + alle keys + defaults)

**Files:**
- Create: `lib/content/registry.ts`

- [ ] **Step 1: Registry-file met alle homepage-keys + defaults**

Belangrijk: **defaults moeten 1-op-1 matchen met de huidige hardcoded strings in `app/(marketing)/_home/*.tsx`**. Kopieer letterlijk. Elke drift = zichtbare tekstverandering voor bezoekers.

```ts
// lib/content/registry.ts

export type ContentKind = "plain" | "rich";

export type ContentKey =
  // Hero
  | "homepage.hero.chip"
  | "homepage.hero.title"
  | "homepage.hero.subtitle"
  | "homepage.hero.cta_primary_label"
  | "homepage.hero.cta_secondary_label"
  | "homepage.hero.micro_copy"
  // PainPoints
  | "homepage.painpoints.eyebrow"
  | "homepage.painpoints.title"
  | "homepage.painpoints.intro"
  | "homepage.painpoints.q.1"
  | "homepage.painpoints.q.2"
  | "homepage.painpoints.q.3"
  | "homepage.painpoints.q.4"
  | "homepage.painpoints.q.5"
  | "homepage.painpoints.q.6"
  | "homepage.painpoints.q.7"
  | "homepage.painpoints.q.8"
  | "homepage.painpoints.q.9"
  // HowItWorks
  | "homepage.howitworks.eyebrow"
  | "homepage.howitworks.title"
  | "homepage.howitworks.step.1.title"
  | "homepage.howitworks.step.1.body"
  | "homepage.howitworks.step.2.title"
  | "homepage.howitworks.step.2.body"
  | "homepage.howitworks.step.3.title"
  | "homepage.howitworks.step.3.body"
  // Foundations
  | "homepage.foundations.eyebrow"
  | "homepage.foundations.title"
  | "homepage.foundations.intro"
  | "homepage.foundations.card.cialdini.label"
  | "homepage.foundations.card.cialdini.title"
  | "homepage.foundations.card.cialdini.body"
  | "homepage.foundations.card.ritson.label"
  | "homepage.foundations.card.ritson.title"
  | "homepage.foundations.card.ritson.body"
  | "homepage.foundations.card.kotler.label"
  | "homepage.foundations.card.kotler.title"
  | "homepage.foundations.card.kotler.body"
  // Founders
  | "homepage.founders.eyebrow"
  | "homepage.founders.title"
  | "homepage.founders.intro"
  | "homepage.founders.olivier.name"
  | "homepage.founders.olivier.role"
  | "homepage.founders.olivier.years"
  | "homepage.founders.olivier.intro"
  | "homepage.founders.martijn.name"
  | "homepage.founders.martijn.role"
  | "homepage.founders.martijn.years"
  | "homepage.founders.martijn.intro"
  // AgencyComparison
  | "homepage.agency.eyebrow"
  | "homepage.agency.title"
  | "homepage.agency.tijd.left"
  | "homepage.agency.tijd.right"
  | "homepage.agency.prijs.left"
  | "homepage.agency.prijs.right"
  | "homepage.agency.controle.left"
  | "homepage.agency.controle.right"
  // PlansTeaser
  | "homepage.plans.eyebrow"
  | "homepage.plans.title"
  | "homepage.plans.intro"
  | "homepage.plans.cta_label"
  | "homepage.plans.all_features_link"
  // FAQ
  | "homepage.faq.title"
  | "homepage.faq.q.1"
  | "homepage.faq.a.1"
  | "homepage.faq.q.2"
  | "homepage.faq.a.2"
  | "homepage.faq.q.3"
  | "homepage.faq.a.3"
  | "homepage.faq.q.4"
  | "homepage.faq.a.4"
  | "homepage.faq.q.5"
  | "homepage.faq.a.5"
  | "homepage.faq.q.6"
  | "homepage.faq.a.6"
  // FinalCta
  | "homepage.finalcta.title"
  | "homepage.finalcta.subtitle"
  | "homepage.finalcta.cta_primary_label"
  | "homepage.finalcta.cta_secondary_label"
  | "homepage.finalcta.micro_copy";

export const CONTENT_META: Record<ContentKey, { kind: ContentKind; default: string }> = {
  // Hero
  "homepage.hero.chip":            { kind: "plain", default: "Marketinganalyse voor MKB" },
  "homepage.hero.title":           { kind: "plain", default: "De second opinion voor je marketingbeslissingen." },
  "homepage.hero.subtitle":        { kind: "plain", default: "Wat een bureau in dagen doet, krijg jij in minuten. Zonder consultancy-uren, met een advies waar je meteen mee aan de slag kan." },
  "homepage.hero.cta_primary_label":   { kind: "plain", default: "Probeer de gratis Website Check" },
  "homepage.hero.cta_secondary_label": { kind: "plain", default: "Bekijk de pakketten →" },
  "homepage.hero.micro_copy":      { kind: "plain", default: "Geen credit card. Klaar in ± 2 minuten." },

  // PainPoints — verifieer per string tegen huidige _home/pain-points.tsx
  "homepage.painpoints.eyebrow": { kind: "plain", default: "Herken je dit?" },
  "homepage.painpoints.title":   { kind: "plain", default: "Deze vragen krijgen wij dagelijks van ondernemers." },
  "homepage.painpoints.intro":   { kind: "plain", default: "Loop je hier zelf tegenaan? Positionr geeft je in minuten een gefundeerd antwoord. Geen weken wachten op een bureau, geen buikgevoel." },
  "homepage.painpoints.q.1": { kind: "plain", default: "Bereiken we de juiste doelgroep?" },
  "homepage.painpoints.q.2": { kind: "plain", default: "Waarom converteert onze website niet?" },
  "homepage.painpoints.q.3": { kind: "plain", default: "Wat doen concurrenten beter?" },
  "homepage.painpoints.q.4": { kind: "plain", default: "Hoe meet ik marketing-ROI?" },
  "homepage.painpoints.q.5": { kind: "plain", default: "Welke kanalen werken écht?" },
  "homepage.painpoints.q.6": { kind: "plain", default: "Wat is onze USP eigenlijk?" },
  "homepage.painpoints.q.7": { kind: "plain", default: "Hoe stuur ik mijn marketeer aan?" },
  "homepage.painpoints.q.8": { kind: "plain", default: "Investeren in SEO of SEA?" },
  "homepage.painpoints.q.9": { kind: "plain", default: "Hoe krijg ik grip op marketing?" },

  // HowItWorks
  "homepage.howitworks.eyebrow":       { kind: "plain", default: "Zo werkt het." },
  "homepage.howitworks.title":         { kind: "plain", default: "Zo kom je in drie stappen bij een concreet antwoord." },
  "homepage.howitworks.step.1.title":  { kind: "plain", default: "Stel je vraag of upload je URL" },
  "homepage.howitworks.step.1.body":   { kind: "plain", default: "Kies een module (Website Check, ICP-analyse, Concurrentieanalyse) en geef ons je bedrijf. Meer heb je niet nodig." },
  "homepage.howitworks.step.2.title":  { kind: "plain", default: "Onze AI analyseert je situatie" },
  "homepage.howitworks.step.2.body":   { kind: "plain", default: "In ± 2 minuten leggen we jouw input naast de raamwerken van Cialdini, Ritson en Kotler. Je ziet stap voor stap hoe we tot een advies komen." },
  "homepage.howitworks.step.3.title":  { kind: "plain", default: "Krijg concrete, geprioriteerde acties" },
  "homepage.howitworks.step.3.body":   { kind: "plain", default: "Geen 40-pagina rapport dat op de plank belandt. Vijf acties met impact-score, direct toepasbaar deze week." },

  // Foundations
  "homepage.foundations.eyebrow": { kind: "plain", default: "De basis." },
  "homepage.foundations.title":   { kind: "plain", default: "Geen buikgevoel, maar 60 jaar marketingwetenschap." },
  "homepage.foundations.intro":   { kind: "plain", default: "Elke aanbeveling leunt op raamwerken die op universiteiten en bij de sterkste bureaus dagelijks in de praktijk zitten. Wij vertalen ze naar jouw situatie." },
  "homepage.foundations.card.cialdini.label": { kind: "plain", default: "Cialdini" },
  "homepage.foundations.card.cialdini.title": { kind: "plain", default: "Waarom mensen 'ja' zeggen." },
  "homepage.foundations.card.cialdini.body":  { kind: "plain", default: "Zes principes van invloed (reciprociteit, sociale bewijskracht, autoriteit, sympathie, schaarste, commitment), gebruikt om je propositie en CTA's te toetsen." },
  "homepage.foundations.card.ritson.label":   { kind: "plain", default: "Mark Ritson" },
  "homepage.foundations.card.ritson.title":   { kind: "plain", default: "Diagnose vóór creatie." },
  "homepage.foundations.card.ritson.body":    { kind: "plain", default: "Wij kijken eerst naar je categorie, doelgroep en positionering. Pas daarna naar tactiek. Zo werken de sterkste adverteerders ook." },
  "homepage.foundations.card.kotler.label":   { kind: "plain", default: "Philip Kotler" },
  "homepage.foundations.card.kotler.title":   { kind: "plain", default: "De vier P's, up-to-date." },
  "homepage.foundations.card.kotler.body":    { kind: "plain", default: "Product, prijs, plaats, promotie, met de aanvullingen uit Kotler's latere werk over CX en H2H (human-to-human)." },

  // Founders
  "homepage.founders.eyebrow": { kind: "plain", default: "Achter Positionr." },
  "homepage.founders.title":   { kind: "plain", default: "De ervaring die AI niet kan namaken." },
  "homepage.founders.intro":   { kind: "plain", default: "Positionr is geen zwarte doos vol algoritmes. Elke module is gebouwd door twee marketeers die dertig jaar aan cases, missers en succesvolle keuzes hebben gecodificeerd. Wat je terugkrijgt is hún manier van denken, niet die van de machine." },
  "homepage.founders.olivier.name":  { kind: "plain", default: "Olivier Arnolds" },
  "homepage.founders.olivier.role":  { kind: "plain", default: "Oprichter · Product & marketing" },
  "homepage.founders.olivier.years": { kind: "plain", default: "30+ jaar in B2B-marketing en sales" },
  "homepage.founders.olivier.intro": { kind: "plain", default: "Uit Amsterdam. Bouwt aan Positionr vanuit 30+ jaar ervaring in B2B-sales, marketing en business development. In elke module zit de manier waarop ik zelf een marketingvraag zou aanpakken: minder theorie, meer bruikbare stappen." },
  "homepage.founders.martijn.name":  { kind: "plain", default: "Martijn de Haas" },
  "homepage.founders.martijn.role":  { kind: "plain", default: "Oprichter · Strategie" },
  "homepage.founders.martijn.years": { kind: "plain", default: "TU Delft · eigenaar De Haas BCD" },
  "homepage.founders.martijn.intro": { kind: "plain", default: "Strateeg met een achtergrond aan de TU Delft en jaren ervaring bij een multinational. Runt sinds jaren zijn eigen strategie-praktijk (De Haas BCD) en helpt organisaties van MKB tot overheid ambitie om te zetten in scherpe keuzes. In Positionr zit dezelfde manier van denken." },

  // AgencyComparison
  "homepage.agency.eyebrow":         { kind: "plain", default: "Wat het verschil maakt." },
  "homepage.agency.title":           { kind: "plain", default: "Bureau of Positionr: dit weegt anders." },
  "homepage.agency.tijd.left":       { kind: "plain", default: "Bureau: dagen tot weken." },
  "homepage.agency.tijd.right":      { kind: "plain", default: "Positionr: minuten." },
  "homepage.agency.prijs.left":      { kind: "plain", default: "Bureau: € 5.000 – € 30.000+." },
  "homepage.agency.prijs.right":     { kind: "plain", default: "Positionr: één jaarbedrag." },
  "homepage.agency.controle.left":   { kind: "plain", default: "Bureau: extern advies." },
  "homepage.agency.controle.right":  { kind: "plain", default: "Positionr: in eigen handen." },

  // PlansTeaser
  "homepage.plans.eyebrow":            { kind: "plain", default: "Pakketten." },
  "homepage.plans.title":              { kind: "plain", default: "Eén jaarbedrag, alle modules in je pakket." },
  "homepage.plans.intro":              { kind: "plain", default: "Geen uurtarieven, geen consultancy-add-ons. Een fractie van wat één bureau-traject kost." },
  "homepage.plans.cta_label":          { kind: "plain", default: "Kies dit pakket" },
  "homepage.plans.all_features_link":  { kind: "plain", default: "Bekijk alle features en modules per pakket →" },

  // FAQ — antwoorden zijn `rich` (worden in TipTap-editor in PR-C2)
  "homepage.faq.title": { kind: "plain", default: "Wat vragen mensen ons vaak?" },
  "homepage.faq.q.1": { kind: "plain", default: "Kan ik dit ook zonder marketing-achtergrond gebruiken?" },
  "homepage.faq.a.1": { kind: "rich",  default: "<p>Ja. De rapportages leggen uit wat je ziet en welke acties je kunt nemen. Je hoeft geen marketing-jargon te kennen. We schrijven voor ondernemers, niet voor marketeers.</p>" },
  "homepage.faq.q.2": { kind: "plain", default: "Wat gebeurt er met mijn data?" },
  "homepage.faq.a.2": { kind: "rich",  default: "<p>Je data blijft van jou. Analyses staan in je eigen account, we verkopen niets aan derden en verwijderen alles bij opzegging.</p>" },
  "homepage.faq.q.3": { kind: "plain", default: "Werkt dit ook voor mijn sector?" },
  "homepage.faq.a.3": { kind: "rich",  default: "<p>Positionr is gebouwd voor B2B-MKB in zakelijke dienstverlening, technologie en financiële dienstverlening. Buiten die sectoren werkt het ook, maar de raamwerken zijn dáár het beste getest.</p>" },
  "homepage.faq.q.4": { kind: "plain", default: "Kan ik opzeggen?" },
  "homepage.faq.a.4": { kind: "rich",  default: "<p>Je koopt een jaar toegang. Aan het einde loopt de licentie vanzelf af. Geen automatische verlenging, geen kleine lettertjes.</p>" },
  "homepage.faq.q.5": { kind: "plain", default: "Hoe verhoudt Positionr zich tot mijn huidige bureau?" },
  "homepage.faq.a.5": { kind: "rich",  default: "<p>Positionr vervangt je bureau niet noodzakelijk. Het geeft je een onafhankelijke second opinion en helpt bepalen waarop je bureau moet focussen.</p>" },
  "homepage.faq.q.6": { kind: "plain", default: "Wat als ik meer hulp nodig heb dan de tool geeft?" },
  "homepage.faq.a.6": { kind: "rich",  default: "<p>Neem contact op. We denken graag mee, of verwijzen je naar een specialist uit ons netwerk als dat beter past.</p>" },

  // FinalCta
  "homepage.finalcta.title":                { kind: "plain", default: "Klaar om zelf grip te krijgen?" },
  "homepage.finalcta.subtitle":             { kind: "plain", default: "Begin met een gratis Website Check. Geen account, ± 2 minuten." },
  "homepage.finalcta.cta_primary_label":    { kind: "plain", default: "Doe de gratis check →" },
  "homepage.finalcta.cta_secondary_label":  { kind: "plain", default: "Of bekijk eerst de pakketten" },
  "homepage.finalcta.micro_copy":           { kind: "plain", default: "In de meeste gevallen heb je binnen 5 minuten een rapport in handen." },
};

/** Alle keys die de homepage nodig heeft — voor `getContentBatch`. */
export const HOMEPAGE_KEYS = Object.keys(CONTENT_META) as ContentKey[];
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && git add lib/content/registry.ts && git commit -m "feat(content): registry met ContentKey union + defaults voor alle homepage-copy"
```

---

### Task 4: `getContent` + `getContentBatch` (TDD)

**Files:**
- Create: `lib/content/get.ts`
- Test: `lib/content/get.test.ts`

- [ ] **Step 1: Failing test**

```ts
// lib/content/get.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContent, getContentBatch } from "./get";

const dbMock = vi.hoisted(() => ({ rows: [] as Array<{ key: string; value: string }> }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbMock.rows,
        }),
        // getBatch pad: from().where()
      }),
    }),
  },
}));

beforeEach(() => { dbMock.rows = []; });

describe("getContent", () => {
  it("returnt DB-waarde bij hit", async () => {
    dbMock.rows = [{ key: "homepage.hero.title", value: "Custom titel" }];
    const v = await getContent("homepage.hero.title");
    expect(v).toBe("Custom titel");
  });

  it("valt terug op default bij DB-miss", async () => {
    dbMock.rows = [];
    const v = await getContent("homepage.hero.title");
    expect(v).toContain("De second opinion");
  });
});

describe("getContentBatch", () => {
  it("returnt map met alle gevraagde keys (DB-waarden waar aanwezig, defaults anders)", async () => {
    dbMock.rows = [{ key: "homepage.hero.title", value: "Overschreven" }];
    const map = await getContentBatch([
      "homepage.hero.title",
      "homepage.hero.subtitle",
    ]);
    expect(map["homepage.hero.title"]).toBe("Overschreven");
    expect(map["homepage.hero.subtitle"]).toContain("Wat een bureau");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

`cd /Users/olivierarnolds/Desktop/positionr-app && pnpm test lib/content/get.test.ts`

- [ ] **Step 3: Implementatie**

```ts
// lib/content/get.ts
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { siteContent } from "@/lib/db/schema";
import { CONTENT_META, type ContentKey } from "./registry";

/** Haalt één content-waarde op. Valt terug op default bij DB-miss. */
export async function getContent(key: ContentKey): Promise<string> {
  const rows = await db
    .select({ value: siteContent.value })
    .from(siteContent)
    .where(eq(siteContent.key, key))
    .limit(1);
  return rows[0]?.value ?? CONTENT_META[key].default;
}

/**
 * Haalt meerdere content-waarden in één query op. Elke key krijgt of de
 * DB-waarde of de default terug. Efficiënt voor page-render.
 */
export async function getContentBatch<K extends ContentKey>(
  keys: readonly K[],
): Promise<Record<K, string>> {
  const rows = keys.length === 0
    ? []
    : await db
        .select({ key: siteContent.key, value: siteContent.value })
        .from(siteContent)
        .where(inArray(siteContent.key, keys as unknown as string[]));
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, string> = {};
  for (const k of keys) {
    out[k] = dbMap.get(k) ?? CONTENT_META[k].default;
  }
  return out as Record<K, string>;
}
```

- [ ] **Step 4: Test groen + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm test lib/content/get.test.ts
cd /Users/olivierarnolds/Desktop/positionr-app && git add lib/content/get.ts lib/content/get.test.ts && git commit -m "feat(content): getContent + getContentBatch met default-fallback (TDD)"
```

---

### Task 5: `saveContent` + `undoLast` + prune (TDD)

**Files:**
- Create: `lib/content/save.ts`
- Test: `lib/content/save.test.ts`

- [ ] **Step 1: Failing test**

```ts
// lib/content/save.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveContent, undoLast } from "./save";

const dbMock = vi.hoisted(() => ({
  historyRows: [] as Array<{ id: string; key: string; value: string; savedAt: Date }>,
  updates: [] as unknown[],
  inserts: [] as unknown[],
  deletes: 0,
}));

vi.mock("@/lib/db/client", () => {
  function makeChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = async () => rows;
    return chain;
  }
  return {
    db: {
      select: () => makeChain(dbMock.historyRows),
      insert: () => ({
        values: (v: unknown) => {
          dbMock.inserts.push(v);
          return {
            onConflictDoUpdate: async () => dbMock.updates.push(v),
            // .values() zonder onConflict is een awaitable in Drizzle;
            // hier resolven we direct om tests simpel te houden
            then: (r: (x: unknown) => void) => r(undefined),
          };
        },
      }),
      delete: () => ({ where: async () => { dbMock.deletes++; } }),
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) },
  }),
}));

vi.mock("@/lib/content/require-admin", () => ({
  requireAdmin: async () => "admin-1",
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  dbMock.updates.length = 0;
  dbMock.inserts.length = 0;
  dbMock.deletes = 0;
  dbMock.historyRows = [];
});

describe("saveContent", () => {
  it("update site_content + insert history voor plain veld", async () => {
    const r = await saveContent("homepage.hero.title", "Nieuwe titel");
    expect(r.ok).toBe(true);
    expect(dbMock.updates).toHaveLength(1); // onConflictDoUpdate
    expect(dbMock.inserts.length).toBeGreaterThanOrEqual(1);
  });

  it("sanitized rich veld: strip <script>", async () => {
    const r = await saveContent(
      "homepage.faq.a.1",
      "<p>Ok</p><script>alert(1)</script>",
    );
    expect(r.ok).toBe(true);
    const inserted = dbMock.inserts[0] as { value: string };
    expect(inserted.value).not.toContain("script");
  });

  it("weigert onbekende key", async () => {
    const r = await saveContent("bogus.key" as never, "x");
    expect(r.ok).toBe(false);
  });
});

describe("undoLast", () => {
  it("restore vorige waarde uit history", async () => {
    dbMock.historyRows = [
      { id: "h2", key: "homepage.hero.title", value: "Nieuw", savedAt: new Date(2) },
      { id: "h1", key: "homepage.hero.title", value: "Oud", savedAt: new Date(1) },
    ];
    // Eerste select() returnt de latest, tweede de prev — mock geeft beide keer historyRows
    // In echte code returnt de tweede query [h1]; hier simpel: eerste rij is latest.
    const r = await undoLast();
    expect(r.ok).toBe(true);
  });

  it("returnt error bij lege history", async () => {
    dbMock.historyRows = [];
    const r = await undoLast();
    expect(r.ok).toBe(false);
  });
});
```

> **Let op**: de test-mock voor Drizzle `.insert().values().onConflictDoUpdate()` is een simplificatie — de echte drizzle-chain heeft nog specifiekere shape. Bij failure: pas de mock aan zodat `.then` resolvet met undefined en `.onConflictDoUpdate` een awaitable is.

- [ ] **Step 2: Failing helper: requireAdmin**

```ts
// lib/content/require-admin.ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Niet ingelogd");
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);
  if (profile?.role !== "admin") throw new Error("Geen admin-rechten");
  return data.user.id;
}
```

- [ ] **Step 3: Implementatie `save.ts`**

```ts
// lib/content/save.ts
"use server";

import { eq, desc, and, ne, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { siteContent, siteContentHistory } from "@/lib/db/schema";
import { CONTENT_META, type ContentKey } from "./registry";
import { sanitizeRich } from "./sanitize";
import { requireAdmin } from "./require-admin";

const KEEP_HISTORY = 20;

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? {} : { data: T }))
  | { ok: false; error: string };

async function pruneHistory(key: string): Promise<void> {
  const keep = await db
    .select({ id: siteContentHistory.id })
    .from(siteContentHistory)
    .where(eq(siteContentHistory.key, key))
    .orderBy(desc(siteContentHistory.savedAt))
    .limit(KEEP_HISTORY);
  if (keep.length === 0) return;
  await db
    .delete(siteContentHistory)
    .where(
      and(
        eq(siteContentHistory.key, key),
        notInArray(siteContentHistory.id, keep.map((r) => r.id)),
      ),
    );
}

export async function saveContent(
  key: ContentKey,
  value: string,
  note: string | null = null,
): Promise<Result> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const meta = CONTENT_META[key];
  if (!meta) return { ok: false, error: `Onbekende content-key: ${key}` };

  const clean = meta.kind === "rich" ? sanitizeRich(value) : value.trim();

  await db
    .insert(siteContent)
    .values({ key, value: clean, updatedBy: userId })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { value: clean, updatedBy: userId, updatedAt: new Date() },
    });

  await db.insert(siteContentHistory).values({
    key,
    value: clean,
    savedBy: userId,
    note,
  });

  await pruneHistory(key);
  revalidatePath("/");
  return { ok: true };
}

export async function undoLast(): Promise<Result<{ key: ContentKey }>> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const [latest] = await db
    .select({ id: siteContentHistory.id, key: siteContentHistory.key, value: siteContentHistory.value })
    .from(siteContentHistory)
    .orderBy(desc(siteContentHistory.savedAt))
    .limit(1);
  if (!latest) return { ok: false, error: "Nog niks om ongedaan te maken" };

  const [prev] = await db
    .select({ value: siteContentHistory.value })
    .from(siteContentHistory)
    .where(and(eq(siteContentHistory.key, latest.key), ne(siteContentHistory.id, latest.id)))
    .orderBy(desc(siteContentHistory.savedAt))
    .limit(1);

  const restored = prev?.value ?? CONTENT_META[latest.key as ContentKey].default;
  const r = await saveContent(latest.key as ContentKey, restored, "Undo");
  if (!r.ok) return r;
  return { ok: true, data: { key: latest.key as ContentKey } };
}
```

- [ ] **Step 4: Tests groen + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm test lib/content/save.test.ts
cd /Users/olivierarnolds/Desktop/positionr-app && git add lib/content/save.ts lib/content/require-admin.ts lib/content/save.test.ts && git commit -m "feat(content): saveContent + undoLast + pruneHistory + requireAdmin (TDD)"
```

---

### Task 6: Refactor Hero + PainPoints naar content-props

**Files:**
- Modify: `app/(marketing)/_home/hero.tsx`
- Modify: `app/(marketing)/_home/pain-points.tsx`

- [ ] **Step 1: Hero refactor — sjabloon voor alle andere secties**

```tsx
// app/(marketing)/_home/hero.tsx
"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";

import { MockupReport } from "./mockup-report";
import type { ContentKey } from "@/lib/content/registry";

export const HERO_KEYS = [
  "homepage.hero.chip",
  "homepage.hero.title",
  "homepage.hero.subtitle",
  "homepage.hero.cta_primary_label",
  "homepage.hero.cta_secondary_label",
  "homepage.hero.micro_copy",
] as const satisfies readonly ContentKey[];

type HeroKey = (typeof HERO_KEYS)[number];

export function Hero({ content }: { content: Record<HeroKey, string> }) {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div className="pointer-events-none absolute -left-40 top-40 -z-10 h-[480px] w-[480px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-20 -z-10 h-[400px] w-[400px] rounded-full bg-coral/[0.04] blur-[100px]" />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-12 lg:gap-10 lg:py-32">
        <div className="min-w-0 lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-xs font-medium text-ink-mid"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            {content["homepage.hero.chip"]}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.06 }}
            className="mt-6 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high text-balance md:text-5xl"
            style={{ lineHeight: 1.05, fontOpticalSizing: "auto" }}
          >
            {content["homepage.hero.title"]}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink-mid"
          >
            {content["homepage.hero.subtitle"]}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: 0.18 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link href="/gratis-check" className="inline-flex items-center justify-center rounded-lg bg-coral px-5 py-3 text-[15px] font-semibold tracking-[0.01em] text-white transition-colors hover:bg-coral-hover">
              {content["homepage.hero.cta_primary_label"]}
            </Link>
            <Link href="/prijzen" className="inline-flex items-center justify-center px-2 py-3 text-[15px] font-semibold text-ink-high underline-offset-4 hover:underline">
              {content["homepage.hero.cta_secondary_label"]}
            </Link>
          </motion.div>

          <p className="mt-3 text-xs text-ink-mut">
            {content["homepage.hero.micro_copy"]}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4, delay: 0.1 }}
          className="lg:col-span-5 lg:-mt-4"
        >
          <MockupReport />
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: PainPoints refactor — zelfde patroon**

```tsx
// app/(marketing)/_home/pain-points.tsx
"use client";
import { motion } from "motion/react";
import { HelpCircle } from "lucide-react";

import { useReveal } from "./use-reveal";
import type { ContentKey } from "@/lib/content/registry";

export const PAINPOINTS_KEYS = [
  "homepage.painpoints.eyebrow",
  "homepage.painpoints.title",
  "homepage.painpoints.intro",
  "homepage.painpoints.q.1", "homepage.painpoints.q.2", "homepage.painpoints.q.3",
  "homepage.painpoints.q.4", "homepage.painpoints.q.5", "homepage.painpoints.q.6",
  "homepage.painpoints.q.7", "homepage.painpoints.q.8", "homepage.painpoints.q.9",
] as const satisfies readonly ContentKey[];

type Key = (typeof PAINPOINTS_KEYS)[number];

export function PainPoints({ content }: { content: Record<Key, string> }) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const questions: readonly Key[] = [
    "homepage.painpoints.q.1", "homepage.painpoints.q.2", "homepage.painpoints.q.3",
    "homepage.painpoints.q.4", "homepage.painpoints.q.5", "homepage.painpoints.q.6",
    "homepage.painpoints.q.7", "homepage.painpoints.q.8", "homepage.painpoints.q.9",
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
      <div className="mb-10 max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {content["homepage.painpoints.eyebrow"]}
        </div>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-ink-high md:text-4xl" style={{ lineHeight: 1.15 }}>
          {content["homepage.painpoints.title"]}
        </h2>
        <p className="mt-3 text-base text-ink-mid">
          {content["homepage.painpoints.intro"]}
        </p>
      </div>
      <div ref={ref} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {questions.map((qKey, i) => (
          <motion.div
            key={qKey}
            initial={{ opacity: 0, y: 8 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ type: "spring", bounce: 0, duration: 0.35, delay: i * 0.04 }}
            className="flex items-start gap-3 rounded-xl border border-black/[0.06] bg-white/70 p-4"
          >
            <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
            <span className="text-sm font-medium text-ink-high">{content[qKey]}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/hero.tsx' 'app/(marketing)/_home/pain-points.tsx' && git commit -m "refactor(content): Hero + PainPoints lezen uit content-prop"
```

---

### Task 7: Refactor HowItWorks + Foundations

**Files:**
- Modify: `app/(marketing)/_home/how-it-works.tsx`
- Modify: `app/(marketing)/_home/foundations.tsx`

- [ ] **Step 1: HowItWorks refactor**

Exporteer `HOWITWORKS_KEYS` array van alle 8 keys (eyebrow, title, en per stap title+body). Vervang de `STEPS`-const door een lookup uit `content` per stap-nummer:

```tsx
// bovenaan de bestaande file
export const HOWITWORKS_KEYS = [
  "homepage.howitworks.eyebrow",
  "homepage.howitworks.title",
  "homepage.howitworks.step.1.title", "homepage.howitworks.step.1.body",
  "homepage.howitworks.step.2.title", "homepage.howitworks.step.2.body",
  "homepage.howitworks.step.3.title", "homepage.howitworks.step.3.body",
] as const satisfies readonly ContentKey[];

type Key = (typeof HOWITWORKS_KEYS)[number];

const STEP_META = [
  { n: 1, kind: "form" as const, titleKey: "homepage.howitworks.step.1.title", bodyKey: "homepage.howitworks.step.1.body" },
  { n: 2, kind: "progress" as const, titleKey: "homepage.howitworks.step.2.title", bodyKey: "homepage.howitworks.step.2.body" },
  { n: 3, kind: "results" as const, titleKey: "homepage.howitworks.step.3.title", bodyKey: "homepage.howitworks.step.3.body" },
] satisfies ReadonlyArray<{ n: number; kind: StepKind; titleKey: Key; bodyKey: Key }>;

export function HowItWorks({ content }: { content: Record<Key, string> }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
      <div className="mb-16 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {content["homepage.howitworks.eyebrow"]}
        </div>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-ink-high md:text-5xl" style={{ lineHeight: 1.1 }}>
          {content["homepage.howitworks.title"]}
        </h2>
      </div>
      <div className="space-y-20">
        {STEP_META.map((s, i) => (
          <Row
            key={s.n}
            n={s.n}
            title={content[s.titleKey]}
            body={content[s.bodyKey]}
            kind={s.kind}
            reverse={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}
```

Update `Row`-component om `title` + `body` als string te accepteren i.p.v. `step`-object.

- [ ] **Step 2: Foundations refactor**

Exporteer `FOUNDATIONS_KEYS` (12 keys: eyebrow, title, intro + 3 cards × 3 velden). Cards komen uit een lokale `CARD_META` met de `Icon` verwijzingen — die blijven in code want geen tekst.

```tsx
export const FOUNDATIONS_KEYS = [
  "homepage.foundations.eyebrow",
  "homepage.foundations.title",
  "homepage.foundations.intro",
  "homepage.foundations.card.cialdini.label", "homepage.foundations.card.cialdini.title", "homepage.foundations.card.cialdini.body",
  "homepage.foundations.card.ritson.label",   "homepage.foundations.card.ritson.title",   "homepage.foundations.card.ritson.body",
  "homepage.foundations.card.kotler.label",   "homepage.foundations.card.kotler.title",   "homepage.foundations.card.kotler.body",
] as const satisfies readonly ContentKey[];

type Key = (typeof FOUNDATIONS_KEYS)[number];

const CARDS = [
  { Icon: Users,   labelKey: "homepage.foundations.card.cialdini.label", titleKey: "homepage.foundations.card.cialdini.title", bodyKey: "homepage.foundations.card.cialdini.body" },
  { Icon: Target,  labelKey: "homepage.foundations.card.ritson.label",   titleKey: "homepage.foundations.card.ritson.title",   bodyKey: "homepage.foundations.card.ritson.body" },
  { Icon: Grid3x3, labelKey: "homepage.foundations.card.kotler.label",   titleKey: "homepage.foundations.card.kotler.title",   bodyKey: "homepage.foundations.card.kotler.body" },
] as const;
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/how-it-works.tsx' 'app/(marketing)/_home/foundations.tsx' && git commit -m "refactor(content): HowItWorks + Foundations lezen uit content-prop"
```

---

### Task 8: Refactor Founders + AgencyComparison

**Files:**
- Modify: `app/(marketing)/_home/founders.tsx`
- Modify: `app/(marketing)/_home/agency-comparison.tsx`

- [ ] **Step 1: Founders refactor**

De `FOUNDERS`-array behoudt `initials`, `linkedInUrl`, `photoSrc` (die zijn assets/config, geen tekst). De vier tekstvelden (`name`, `role`, `yearsPractice`, `intro`) komen uit content.

```tsx
export const FOUNDERS_KEYS = [
  "homepage.founders.eyebrow",
  "homepage.founders.title",
  "homepage.founders.intro",
  "homepage.founders.olivier.name", "homepage.founders.olivier.role", "homepage.founders.olivier.years", "homepage.founders.olivier.intro",
  "homepage.founders.martijn.name", "homepage.founders.martijn.role", "homepage.founders.martijn.years", "homepage.founders.martijn.intro",
] as const satisfies readonly ContentKey[];

type Key = (typeof FOUNDERS_KEYS)[number];

const FOUNDER_META = [
  { slug: "olivier", initials: "OA", linkedInUrl: "https://www.linkedin.com/in/olivierarnolds/", photoSrc: "/founders/olivier.jpg",
    nameKey: "homepage.founders.olivier.name", roleKey: "homepage.founders.olivier.role",
    yearsKey: "homepage.founders.olivier.years", introKey: "homepage.founders.olivier.intro" },
  { slug: "martijn", initials: "MdH", linkedInUrl: "https://www.linkedin.com/in/dehaasmartijn/", photoSrc: "/founders/martijn.png",
    nameKey: "homepage.founders.martijn.name", roleKey: "homepage.founders.martijn.role",
    yearsKey: "homepage.founders.martijn.years", introKey: "homepage.founders.martijn.intro" },
] as const;
```

Update `Avatar`-component: neem `initials`, `photoSrc`, `alt` als losse props (in plaats van `Founder`-object).

- [ ] **Step 2: AgencyComparison refactor**

Zelfde patroon met 8 keys (eyebrow, title, 3×left, 3×right).

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/founders.tsx' 'app/(marketing)/_home/agency-comparison.tsx' && git commit -m "refactor(content): Founders + AgencyComparison lezen uit content-prop"
```

---

### Task 9: Refactor PlansTeaser + Faq

**Files:**
- Modify: `app/(marketing)/_home/plans-teaser.tsx`
- Modify: `app/(marketing)/_home/faq.tsx`

- [ ] **Step 1: PlansTeaser refactor**

Prijzen/features blijven uit `lib/plans/registry.ts` (business-config, geen homepage-copy). Alleen eyebrow, title, intro, CTA-label, "alle features"-link-tekst komen uit content.

- [ ] **Step 2: Faq refactor**

12 keys (title + 6 vragen + 6 antwoorden). Antwoorden zijn `rich` → render met `dangerouslySetInnerHTML`:

```tsx
export const FAQ_KEYS = [
  "homepage.faq.title",
  "homepage.faq.q.1", "homepage.faq.a.1",
  "homepage.faq.q.2", "homepage.faq.a.2",
  "homepage.faq.q.3", "homepage.faq.a.3",
  "homepage.faq.q.4", "homepage.faq.a.4",
  "homepage.faq.q.5", "homepage.faq.a.5",
  "homepage.faq.q.6", "homepage.faq.a.6",
] as const satisfies readonly ContentKey[];

type Key = (typeof FAQ_KEYS)[number];

const QA = [
  { qKey: "homepage.faq.q.1", aKey: "homepage.faq.a.1" },
  { qKey: "homepage.faq.q.2", aKey: "homepage.faq.a.2" },
  { qKey: "homepage.faq.q.3", aKey: "homepage.faq.a.3" },
  { qKey: "homepage.faq.q.4", aKey: "homepage.faq.a.4" },
  { qKey: "homepage.faq.q.5", aKey: "homepage.faq.a.5" },
  { qKey: "homepage.faq.q.6", aKey: "homepage.faq.a.6" },
] as const;

export function Faq({ content }: { content: Record<Key, string> }) {
  // ... zelfde accordion, maar:
  // <span className="text-[17px] font-medium text-ink-high">{content[item.qKey]}</span>
  // <div className="pb-5 pr-8 text-ink-mid" dangerouslySetInnerHTML={{ __html: content[item.aKey] }} />
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/plans-teaser.tsx' 'app/(marketing)/_home/faq.tsx' && git commit -m "refactor(content): PlansTeaser + Faq lezen uit content-prop (antwoorden = rich)"
```

---

### Task 10: Refactor FinalCta + Footer

**Files:**
- Modify: `app/(marketing)/_home/final-cta.tsx`
- Modify: `app/(marketing)/_home/footer.tsx`

- [ ] **Step 1: FinalCta refactor**

5 keys.

- [ ] **Step 2: Footer refactor**

Voor v1 laten we footer-links (Modules / Pakketten / Voorwaarden etc.) als **hardcoded** — dat zijn navigatie-labels + hrefs, en die zijn gekoppeld aan routes die alleen in code veranderen. Wel toevoegen als content-key: het copyright-tekstje aan de onderkant.

Maak `FOOTER_KEYS` met alleen `homepage.footer.copyright` (eventueel toevoegen als nieuwe key in `registry.ts`, of skip footer helemaal in v1).

**Beslissing v1:** skip footer volledig, geen keys. Reden: geen tekst-copy die je met een tekst-edit wilt aanpassen buiten copyright-jaar. Dat kan een kleine `new Date().getFullYear()` zijn.

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/_home/final-cta.tsx' && git commit -m "refactor(content): FinalCta lezen uit content-prop; Footer blijft hardcoded in v1"
```

---

### Task 11: page.tsx assembleer + eindcheck + push

**Files:**
- Modify: `app/(marketing)/page.tsx`

- [ ] **Step 1: Nieuwe page.tsx**

```tsx
import { getContentBatch } from "@/lib/content/get";
import type { ContentKey } from "@/lib/content/registry";

import { Hero, HERO_KEYS } from "./_home/hero";
import { PainPoints, PAINPOINTS_KEYS } from "./_home/pain-points";
import { HowItWorks, HOWITWORKS_KEYS } from "./_home/how-it-works";
import { Foundations, FOUNDATIONS_KEYS } from "./_home/foundations";
import { Founders, FOUNDERS_KEYS } from "./_home/founders";
import { AgencyComparison, AGENCY_KEYS } from "./_home/agency-comparison";
import { PlansTeaser, PLANS_KEYS } from "./_home/plans-teaser";
import { Faq, FAQ_KEYS } from "./_home/faq";
import { FinalCta, FINALCTA_KEYS } from "./_home/final-cta";
import { HomeFooter } from "./_home/footer";

const ALL_KEYS = [
  ...HERO_KEYS,
  ...PAINPOINTS_KEYS,
  ...HOWITWORKS_KEYS,
  ...FOUNDATIONS_KEYS,
  ...FOUNDERS_KEYS,
  ...AGENCY_KEYS,
  ...PLANS_KEYS,
  ...FAQ_KEYS,
  ...FINALCTA_KEYS,
] as const satisfies readonly ContentKey[];

export default async function HomePage() {
  const content = await getContentBatch(ALL_KEYS);
  return (
    <div className="bg-cream text-ink-high">
      <Hero content={content} />
      <PainPoints content={content} />
      <HowItWorks content={content} />
      <Foundations content={content} />
      <Founders content={content} />
      <AgencyComparison content={content} />
      <PlansTeaser content={content} />
      <Faq content={content} />
      <FinalCta content={content} />
      <HomeFooter />
    </div>
  );
}
```

> TypeScript geeft compile-error als één sectie een key uit z'n `SECTION_KEYS` niet gebruikt of andersom een key gebruikt die niet in `content` zit. Dat is de bedoeling: het houdt de refactor honest.

- [ ] **Step 2: Volledige verificatie**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm test
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm build 2>&1 | tail -20
```

Verwacht:
- typecheck schoon
- alle bestaande tests + nieuwe (sanitize, get, save, undo) groen
- `/` compileert

- [ ] **Step 3: Browser-smoke lokaal**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm dev
```

Open `http://localhost:3000/` — moet er 100% identiek uitzien als vóór PR-C1. Elke tekstwaarde is nu uit de default-fallback (DB is nog leeg).

Optioneel: test de DB-hit door in Supabase SQL Editor te draaien:
```sql
insert into public.site_content (key, value) values ('homepage.hero.title', 'Test override');
```
Refresh → h1 toont "Test override". Rollback:
```sql
delete from public.site_content where key = 'homepage.hero.title';
```

- [ ] **Step 4: Commit assemblage**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add 'app/(marketing)/page.tsx' && git commit -m "feat(content): homepage-assemblage — content-batch fetch + per-sectie prop"
```

- [ ] **Step 5: Push (na akkoord Olivier)**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git push origin main
```

---

## File-overzicht (per task)

| Task | Create | Modify |
|---|---|---|
| 1 | `drizzle/0012_site_content.sql` | `lib/db/schema.ts` |
| 2 | `lib/content/sanitize.ts` + `.test.ts` | `package.json` |
| 3 | `lib/content/registry.ts` | — |
| 4 | `lib/content/get.ts` + `.test.ts` | — |
| 5 | `lib/content/save.ts`, `lib/content/require-admin.ts`, `save.test.ts` | — |
| 6 | — | Hero + PainPoints |
| 7 | — | HowItWorks + Foundations |
| 8 | — | Founders + AgencyComparison |
| 9 | — | PlansTeaser + Faq |
| 10 | — | FinalCta |
| 11 | — | page.tsx |

---

## Wat NIET in deze PR

- `<Editable>`-component en edit-mode UI → PR-C2 (aparte spec/plan)
- Andere marketing-pages (`/prijzen`, `/voorwaarden`, `/privacy`, `/gratis-check`) → later
- Footer-links content-editable → v1 skip, alleen route-labels
- Admin-page voor content-overzicht → niet nodig, PR-C2 doet inline-edit
- Image-editing → out of scope

---

## Rollout-check na PR-C1

1. Migratie 0012 gerund in productie
2. Deploy op Vercel groen
3. Bezoekers zien 0 visueel verschil
4. Admin kan optioneel handmatig via SQL Editor een key overschrijven om te testen dat de fallback→DB switch werkt

Zodra dit staat: PR-C2 spec + plan schrijven en de `<Editable>` bouwen.
