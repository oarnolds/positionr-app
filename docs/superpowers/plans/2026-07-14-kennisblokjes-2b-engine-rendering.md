# Kennisblokjes 2B — Matching-engine & rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bij een module-run kiest een module-agnostische engine tot 3 goedgekeurde kennis-kaarten die bij de secties van de output passen, slaat ze gesnapshot op de sessie op, en toont ze als pull-quote-blokjes náást de relevante secties (generieke runner + website-check).

**Architecture:** Een `MatchableSection`-interface met per-module adapters (generic report, website-check onderdelen). De pijplijn `classify` (LLM → thema's per sectie) → `prefilter` (deterministisch: thema-overlap met kaart-`themes`) → `pick` (LLM → ≤3 kaarten + brug-zin) draait bij generatie en is best-effort (faalt nooit de run). De gekozen blokjes worden gesnapshot in `sessions.knowledge_blocks`. Rendering: een gedeelde `KnowledgeBlock`-pull-quote + een `SectionPair`-layout die het blokje naast de sectie zet, links/rechts afwisselend op `rank`.

**Tech Stack:** TypeScript, React 19 Server Components, Tailwind 4, Drizzle (Postgres/Supabase), Anthropic via `analyzeClaudeRaw`, Vitest (node-env; pure delen TDD, rendering browser-geverifieerd).

**Spec:** `docs/superpowers/specs/2026-07-14-kennisblokjes-subsysteem-2-design.md` (secties "Architectuuroverzicht", "Matching-engine", "Rendering van de kennisblokjes").

**Depends on:** plan **2A** (taxonomie + `knowledge_cards.themes` gevuld). Zonder gevulde `themes` levert `prefilter` niets en blijven blokjes leeg — bouwbaar, maar pas zichtbaar zodra 2A gedraaid is.

**Scope:** Engine + rendering voor de **generieke runner** en **website-check**. NIET: ICP-adapter, gratis-check/`/r/…` (bewust geen blokjes), embeddings, "opnieuw matchen".

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid | Actie |
| --- | --- | --- |
| `lib/db/schema.ts` | `sessions.knowledge_blocks` jsonb-kolom | Modify |
| DB-migratie | `ALTER TABLE sessions ADD COLUMN knowledge_blocks` | Nieuw |
| `lib/knowledge/matching/types.ts` | `MatchableSection`, `KnowledgeBlock`, `ApprovedCard` | Nieuw |
| `lib/knowledge/matching/adapters/generic.ts` | GenericOutput → secties | Nieuw |
| `lib/knowledge/matching/adapters/website-check.ts` | Onderdelen → secties | Nieuw |
| `lib/knowledge/matching/prefilter.ts` | Thema-intersectie → kandidaten | Nieuw |
| `lib/knowledge/matching/classify.ts` | Thema's per sectie (LLM) | Nieuw |
| `lib/knowledge/matching/pick.ts` | Kaart-keuze + brug-zin (LLM) | Nieuw |
| `lib/knowledge/matching/index.ts` | `buildKnowledgeBlocks` orkestratie | Nieuw |
| `lib/modules/KnowledgeBlock.tsx` | Pull-quote-component | Nieuw |
| `lib/modules/SectionPair.tsx` | 2-koloms paar (afwisselend) | Nieuw |
| `modules/generic/service.ts` | Matching-hook + opslag | Modify |
| `modules/website-check/service.ts` | Matching-hook + opslag | Modify |
| `modules/generic/components/GenericReportView.tsx` | Blok-weving | Modify |
| `modules/website-check/report/WebsiteCheckReport.tsx` | Blok-weving | Modify |
| `app/(app)/modules/[slug]/[sessionId]/page.tsx` | Blocks doorgeven | Modify |
| `app/(app)/modules/website-check/[sessionId]/page.tsx` | Blocks doorgeven | Modify |
| `modules/website-check/components/WebsiteCheckResultView.tsx` | Blocks doorgeven | Modify |

---

## Task 1: `sessions.knowledge_blocks`-kolom + migratie

**Files:**
- Modify: `lib/db/schema.ts`
- Create: migratie via `pnpm db:generate`

- [ ] **Step 1: Voeg het type + de kolom toe**

In `lib/db/schema.ts`, boven `export const sessions = pgTable(...)`, voeg het snapshot-type toe:

```ts
export type KnowledgeBlockSnapshot = {
  sectionKey: string;
  rank: number;
  bridge: string;
  cardId: string;
  card: { title: string; kern: string; toepassing: string; sourceLabel: string };
};
```

In `sessions`, ná de `output`-regel (`output: text("output"),`), voeg toe:

```ts
  knowledgeBlocks: jsonb("knowledge_blocks").$type<KnowledgeBlockSnapshot[]>(),
```

- [ ] **Step 2: Schrijf een focused SQL-migratie (handmatig — repo-conventie)**

Dit project gebruikt `drizzle-kit generate`/`migrate` NIET (leeg journal; handgeschreven genummerde SQL, handmatig toegepast — zie `drizzle/0004_admin_prompts.sql` en CLAUDE.md). Draai GEEN `pnpm db:generate`.

Maak `drizzle/00NN_sessions_knowledge_blocks.sql` (NN = hoogste bestaande nummer + 1) met:

```sql
-- Kennisblokjes — gesnapshotte matches op de sessie
alter table "sessions"
  add column "knowledge_blocks" jsonb;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: geen nieuwe fouten (`Session`-type bevat nu `knowledgeBlocks`).

- [ ] **Step 4: Pas toe op de database — DELIBERATE STEP**

Additief/nullable, dus veilig; wel een echte DB-schrijfactie. Plak de SQL in de **Supabase SQL Editor**, of pas 'm toe via de **Supabase-connector** (`apply_migration`). NIET via `pnpm db:migrate` (leeg journal).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(kennis): knowledge_blocks-kolom op sessions"
```

---

## Task 2: Engine-typen

**Files:**
- Create: `lib/knowledge/matching/types.ts`

- [ ] **Step 1: Schrijf het bestand** (geen test — puur typen)

```ts
/** Eén matchbare sectie uit een module-output (adapter-uitvoer). */
export type MatchableSection = { key: string; titel: string; tekst: string };

/** Goedgekeurde kaart zoals de engine 'm leest. */
export type ApprovedCard = {
  id: string;
  title: string;
  kern: string;
  toepassing: string;
  sourceLabel: string;
  themes: string[];
};

/** Gesnapshot blokje zoals opgeslagen op de sessie en gerenderd. */
export type KnowledgeBlock = {
  sectionKey: string;
  rank: number;
  bridge: string;
  cardId: string;
  card: { title: string; kern: string; toepassing: string; sourceLabel: string };
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck` → geen fouten.

```bash
git add lib/knowledge/matching/types.ts
git commit -m "feat(kennis): matching-engine typen"
```

---

## Task 3: Adapters (generic + website-check)

**Files:**
- Create: `lib/knowledge/matching/adapters/generic.ts`
- Create: `lib/knowledge/matching/adapters/website-check.ts`
- Test: `lib/knowledge/matching/adapters/adapters.test.ts`

- [ ] **Step 1: Schrijf de falende test**

`lib/knowledge/matching/adapters/adapters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { genericSections } from "./generic";
import { websiteCheckSections } from "./website-check";

describe("genericSections", () => {
  it("mapt report-secties naar MatchableSection met stabiele keys", () => {
    const out = genericSections({
      kind: "report",
      report: {
        heroTekst: "x",
        secties: [
          { titel: "Waardepropositie", accent: "blue", layout: "volledig", inhoud: "De belofte.", chips: ["a", "b"] },
          { titel: "", eyebrow: "BEWIJS", accent: "red", layout: "volledig", inhoud: "Weinig bewijs.", feiten: [{ label: "Logo's", waarde: "1" }] },
        ],
      },
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: "sectie-0", titel: "Waardepropositie" });
    expect(out[0].tekst).toContain("De belofte.");
    expect(out[0].tekst).toContain("a, b");
    expect(out[1].titel).toBe("BEWIJS");
    expect(out[1].tekst).toContain("Logo's: 1");
  });

  it("markdown-fallback → lege lijst", () => {
    expect(genericSections({ kind: "markdown", markdown: "x" })).toEqual([]);
  });
});

describe("websiteCheckSections", () => {
  it("mapt geparsete onderdelen naar secties met slug-key", () => {
    const md = [
      "### 5. Bewijsvoering — 4,0 / 10", "",
      "#### Wat we zien", "", "Eén aanbeveling.", "",
      "#### Waarom dit telt", "", "Bewijs overtuigt.", "",
      "#### Wat je kunt doen", "", "* Toon logo's.", "",
      "# De vijf belangrijkste acties",
    ].join("\n");
    const out = websiteCheckSections(md);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("bewijsvoering");
    expect(out[0].titel).toBe("Bewijsvoering");
    expect(out[0].tekst).toContain("Eén aanbeveling.");
    expect(out[0].tekst).toContain("Toon logo's.");
  });
});
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `pnpm exec vitest run lib/knowledge/matching/adapters/adapters.test.ts`
Expected: FAIL — modules bestaan niet.

- [ ] **Step 3: Implementeer `generic.ts`**

```ts
import type { GenericOutput } from "@/modules/generic/schema";
import type { MatchableSection } from "../types";

export function genericSections(output: GenericOutput): MatchableSection[] {
  if (output.kind !== "report") return [];
  return output.report.secties.map((s, i) => {
    const feiten = (s.feiten ?? [])
      .map((f) => `${f.label}: ${f.waarde}`)
      .join("; ");
    const chips = (s.chips ?? []).join(", ");
    const tekst = [s.inhoud, feiten, chips].filter((x) => x && x.trim()).join("\n");
    return {
      key: `sectie-${i}`,
      titel: s.eyebrow || s.titel || `Sectie ${i + 1}`,
      tekst,
    };
  });
}
```

- [ ] **Step 4: Implementeer `website-check.ts`**

```ts
import { parseReport } from "@/modules/website-check/report/parseReport";
import type { MatchableSection } from "../types";

export function websiteCheckSections(markdown: string): MatchableSection[] {
  const { onderdelen } = parseReport(markdown);
  return onderdelen.map((o) => ({
    key: o.slug,
    titel: o.titel,
    tekst: [o.watWeZien, o.waaromDitTelt, o.watJeKuntDoen.join(" ")]
      .filter((x) => x && x.trim())
      .join("\n"),
  }));
}
```

- [ ] **Step 5: Run — verwacht PASS**

Run: `pnpm exec vitest run lib/knowledge/matching/adapters/adapters.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/knowledge/matching/adapters/ lib/knowledge/matching/adapters/adapters.test.ts
git commit -m "feat(kennis): module-adapters (generic + website-check) naar secties"
```

---

## Task 4: `prefilter` (puur)

**Files:**
- Create: `lib/knowledge/matching/prefilter.ts`
- Test: `lib/knowledge/matching/prefilter.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
import { describe, expect, it } from "vitest";
import { prefilter } from "./prefilter";
import type { ApprovedCard } from "./types";

const card = (id: string, themes: string[]): ApprovedCard => ({
  id, title: id, kern: "", toepassing: "", sourceLabel: "", themes,
});

describe("prefilter", () => {
  const cards = [
    card("a", ["bewijsvoering", "sociale-bewijskracht"]),
    card("b", ["cta-conversie"]),
    card("c", ["waardepropositie"]),
  ];

  it("houdt per sectie de kaarten met thema-overlap", () => {
    const res = prefilter(
      { "sectie-0": ["bewijsvoering"], "sectie-1": ["cta-conversie", "waardepropositie"] },
      cards,
    );
    expect(res.get("sectie-0")?.map((c) => c.id)).toEqual(["a"]);
    expect(res.get("sectie-1")?.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("secties zonder overlap komen niet in de map", () => {
    const res = prefilter({ "sectie-0": ["schaarste-urgentie"] }, cards);
    expect(res.has("sectie-0")).toBe(false);
  });

  it("lege thema's → geen kandidaten", () => {
    const res = prefilter({ "sectie-0": [] }, cards);
    expect(res.has("sectie-0")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `pnpm exec vitest run lib/knowledge/matching/prefilter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementeer**

```ts
import type { ApprovedCard } from "./types";

/**
 * Per sectie: de kaarten waarvan minstens één thema in de sectie-thema's zit.
 * Secties zonder kandidaten komen NIET in de map.
 */
export function prefilter(
  sectionThemes: Record<string, string[]>,
  cards: ApprovedCard[],
): Map<string, ApprovedCard[]> {
  const out = new Map<string, ApprovedCard[]>();
  for (const [key, themes] of Object.entries(sectionThemes)) {
    if (themes.length === 0) continue;
    const set = new Set(themes);
    const candidates = cards.filter((c) => c.themes.some((t) => set.has(t)));
    if (candidates.length > 0) out.set(key, candidates);
  }
  return out;
}
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `pnpm exec vitest run lib/knowledge/matching/prefilter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/matching/prefilter.ts lib/knowledge/matching/prefilter.test.ts
git commit -m "feat(kennis): prefilter op thema-overlap"
```

---

## Task 5: `classify` (prompt + parse)

**Files:**
- Create: `lib/knowledge/matching/classify.ts`
- Test: `lib/knowledge/matching/classify.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
import { describe, expect, it } from "vitest";
import { buildClassifyPrompt, parseClassify } from "./classify";

describe("buildClassifyPrompt", () => {
  it("bevat de sectie-keys, titels en taxonomie", () => {
    const p = buildClassifyPrompt([{ key: "sectie-0", titel: "Bewijs", tekst: "Weinig logo's." }]);
    expect(p).toContain("sectie-0");
    expect(p).toContain("Bewijs");
    expect(p).toContain("sociale-bewijskracht"); // taxonomie
  });
});

describe("parseClassify", () => {
  it("mapt keys op geldige thema-slugs", () => {
    const raw = '{"sectie-0":["bewijsvoering","onzin"],"sectie-1":["cta-conversie"]}';
    expect(parseClassify(raw, ["sectie-0", "sectie-1"])).toEqual({
      "sectie-0": ["bewijsvoering"],
      "sectie-1": ["cta-conversie"],
    });
  });
  it("onbekende keys en rommel worden genegeerd", () => {
    expect(parseClassify("geen json", ["sectie-0"])).toEqual({});
    expect(parseClassify('{"x":["bewijsvoering"]}', ["sectie-0"])).toEqual({});
  });
});
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `pnpm exec vitest run lib/knowledge/matching/classify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementeer**

```ts
import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { TAXONOMY, filterValidThemes } from "@/lib/knowledge/taxonomy";
import type { MatchableSection } from "./types";

export function buildClassifyPrompt(sections: MatchableSection[]): string {
  const opties = TAXONOMY.map((t) => `- ${t.slug}: ${t.label}`).join("\n");
  const secs = sections
    .map((s) => `[${s.key}] ${s.titel}\n${s.tekst}`)
    .join("\n\n");
  return `Je bepaalt per sectie welke marketing/sales-thema's aan de orde zijn, UITSLUITEND uit een vaste taxonomie.

TAXONOMIE:
${opties}

SECTIES:
${secs}

Geef UITSLUITEND een JSON-object terug dat elke sectie-sleutel (tussen [ ]) mapt op een array van 0 tot 3 passende thema-slugs uit de taxonomie, bijvoorbeeld {"sectie-0":["waardepropositie"],"sectie-1":[]}. Geen tekst eromheen.`;
}

export function parseClassify(
  raw: string,
  keys: string[],
): Record<string, string[]> {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const result: Record<string, string[]> = {};
  if (start === -1 || end === -1 || end < start) return result;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return result;
  }
  if (!parsed || typeof parsed !== "object") return result;
  const obj = parsed as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const [k, v] of Object.entries(obj)) {
    if (!allowed.has(k) || !Array.isArray(v)) continue;
    result[k] = filterValidThemes(v.filter((x): x is string => typeof x === "string"));
  }
  return result;
}

export async function classifySections(
  sections: MatchableSection[],
): Promise<Record<string, string[]>> {
  if (sections.length === 0) return {};
  const { markdown } = await analyzeClaudeRaw({
    prompt: buildClassifyPrompt(sections),
  });
  return parseClassify(markdown, sections.map((s) => s.key));
}
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `pnpm exec vitest run lib/knowledge/matching/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/matching/classify.ts lib/knowledge/matching/classify.test.ts
git commit -m "feat(kennis): classify — thema's per sectie"
```

---

## Task 6: `pick` (prompt + parse)

**Files:**
- Create: `lib/knowledge/matching/pick.ts`
- Test: `lib/knowledge/matching/pick.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
import { describe, expect, it } from "vitest";
import { buildPickPrompt, parsePicks, MAX_BLOCKS } from "./pick";
import type { ApprovedCard, MatchableSection } from "./types";

const sections: MatchableSection[] = [
  { key: "bewijsvoering", titel: "Bewijs", tekst: "Weinig logo's." },
];
const cands = new Map<string, ApprovedCard[]>([
  ["bewijsvoering", [{ id: "c1", title: "Sociale bewijskracht", kern: "Anderen overtuigen.", toepassing: "", sourceLabel: "Cialdini", themes: ["sociale-bewijskracht"] }]],
]);

describe("buildPickPrompt", () => {
  it("bevat de sectie, de kandidaat-id en de max", () => {
    const p = buildPickPrompt(sections, cands);
    expect(p).toContain("bewijsvoering");
    expect(p).toContain("id:c1");
    expect(p).toContain(String(MAX_BLOCKS));
  });
});

describe("parsePicks", () => {
  it("parset geldige items en capt op MAX_BLOCKS", () => {
    const raw = JSON.stringify([
      { sectionKey: "a", cardId: "1", bridge: "x" },
      { sectionKey: "b", cardId: "2", bridge: "y" },
      { sectionKey: "c", cardId: "3", bridge: "z" },
      { sectionKey: "d", cardId: "4", bridge: "w" },
    ]);
    const res = parsePicks(raw);
    expect(res).toHaveLength(MAX_BLOCKS);
    expect(res[0]).toEqual({ sectionKey: "a", cardId: "1", bridge: "x" });
  });
  it("rommel/lege array → leeg", () => {
    expect(parsePicks("[]")).toEqual([]);
    expect(parsePicks("geen json")).toEqual([]);
    expect(parsePicks('[{"sectionKey":"a"}]')).toEqual([]); // incompleet item
  });
});
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `pnpm exec vitest run lib/knowledge/matching/pick.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementeer**

```ts
import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import type { ApprovedCard, MatchableSection } from "./types";

export const MAX_BLOCKS = 3;

export type Pick = { sectionKey: string; cardId: string; bridge: string };

export function buildPickPrompt(
  sections: MatchableSection[],
  candidates: Map<string, ApprovedCard[]>,
): string {
  const blocks = sections
    .filter((s) => candidates.has(s.key))
    .map((s) => {
      const cards = candidates
        .get(s.key)!
        .map((c) => `  - id:${c.id} | ${c.title}: ${c.kern}`)
        .join("\n");
      return `SECTIE [${s.key}] ${s.titel}\n${s.tekst}\nKANDIDAAT-KAARTEN:\n${cards}`;
    })
    .join("\n\n");
  return `Je kiest "kennisblokjes" om bij secties van een marketingrapport te tonen. Per sectie HOOGSTENS één kaart, en in totaal HOOGSTENS ${MAX_BLOCKS} over het hele rapport. Kies alleen als een kaart écht raakt aan wat er in de sectie staat — liever niets dan een zwakke match.

Voor elke gekozen kaart schrijf je één korte brug-zin (Nederlands, B1) die het principe aan díé sectie koppelt. Verzin geen feiten over het bronboek.

${blocks}

Geef UITSLUITEND een JSON-array terug (max ${MAX_BLOCKS} items), van meest naar minst relevant:
[{"sectionKey":"...","cardId":"...","bridge":"..."}]
Lege array [] als niets goed past. Geen tekst eromheen.`;
}

export function parsePicks(raw: string): Pick[] {
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
  const out: Pick[] = [];
  for (const item of parsed) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (
        typeof o.sectionKey === "string" &&
        typeof o.cardId === "string" &&
        typeof o.bridge === "string"
      ) {
        out.push({ sectionKey: o.sectionKey, cardId: o.cardId, bridge: o.bridge });
      }
    }
  }
  return out.slice(0, MAX_BLOCKS);
}

export async function pickBlocks(
  sections: MatchableSection[],
  candidates: Map<string, ApprovedCard[]>,
): Promise<Pick[]> {
  if (candidates.size === 0) return [];
  const { markdown } = await analyzeClaudeRaw({
    prompt: buildPickPrompt(sections, candidates),
  });
  return parsePicks(markdown);
}
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `pnpm exec vitest run lib/knowledge/matching/pick.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/matching/pick.ts lib/knowledge/matching/pick.test.ts
git commit -m "feat(kennis): pick — kaart-keuze + brug-zin"
```

---

## Task 7: `buildKnowledgeBlocks` orkestratie

**Files:**
- Create: `lib/knowledge/matching/index.ts`
- Test: `lib/knowledge/matching/index.test.ts`

- [ ] **Step 1: Schrijf de falende test** (met geïnjecteerde deps — geen echte LLM/DB)

```ts
import { describe, expect, it } from "vitest";
import { buildKnowledgeBlocks } from "./index";
import type { ApprovedCard, MatchableSection } from "./types";

const sections: MatchableSection[] = [
  { key: "bewijsvoering", titel: "Bewijs", tekst: "Weinig logo's." },
  { key: "cta", titel: "CTA", tekst: "Geen knop." },
];
const cards: ApprovedCard[] = [
  { id: "c1", title: "Sociale bewijskracht", kern: "K1", toepassing: "T1", sourceLabel: "Cialdini", themes: ["sociale-bewijskracht"] },
];

it("snapshot een gekozen kaart met rank + bridge", async () => {
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => cards,
    classify: async () => ({ bewijsvoering: ["sociale-bewijskracht"], cta: [] }),
    pick: async () => [{ sectionKey: "bewijsvoering", cardId: "c1", bridge: "Brug." }],
  });
  expect(blocks).toEqual([
    {
      sectionKey: "bewijsvoering",
      rank: 1,
      bridge: "Brug.",
      cardId: "c1",
      card: { title: "Sociale bewijskracht", kern: "K1", toepassing: "T1", sourceLabel: "Cialdini" },
    },
  ]);
});

it("geen kaarten → leeg, zonder classify/pick aan te roepen", async () => {
  let called = false;
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => [],
    classify: async () => { called = true; return {}; },
    pick: async () => [],
  });
  expect(blocks).toEqual([]);
  expect(called).toBe(false);
});

it("onbekende cardId uit pick wordt overgeslagen", async () => {
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => cards,
    classify: async () => ({ bewijsvoering: ["sociale-bewijskracht"] }),
    pick: async () => [{ sectionKey: "bewijsvoering", cardId: "onbekend", bridge: "x" }],
  });
  expect(blocks).toEqual([]);
});

it("fout in een dep → leeg (best-effort)", async () => {
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => cards,
    classify: async () => { throw new Error("boom"); },
    pick: async () => [],
  });
  expect(blocks).toEqual([]);
});
```

- [ ] **Step 2: Run — verwacht FAIL**

Run: `pnpm exec vitest run lib/knowledge/matching/index.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementeer**

```ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards } from "@/lib/db/schema";
import { classifySections } from "./classify";
import { pickBlocks } from "./pick";
import { prefilter } from "./prefilter";
import type { ApprovedCard, KnowledgeBlock, MatchableSection } from "./types";

export type MatchingDeps = {
  loadApprovedCards: () => Promise<ApprovedCard[]>;
  classify: (sections: MatchableSection[]) => Promise<Record<string, string[]>>;
  pick: typeof pickBlocks;
};

export const defaultMatchingDeps: MatchingDeps = {
  loadApprovedCards: async () =>
    db
      .select({
        id: knowledgeCards.id,
        title: knowledgeCards.title,
        kern: knowledgeCards.kern,
        toepassing: knowledgeCards.toepassing,
        sourceLabel: knowledgeCards.sourceLabel,
        themes: knowledgeCards.themes,
      })
      .from(knowledgeCards)
      .where(
        and(
          eq(knowledgeCards.status, "goedgekeurd"),
          sql`array_length(${knowledgeCards.themes}, 1) >= 1`,
        ),
      ),
  classify: classifySections,
  pick: pickBlocks,
};

/**
 * classify → prefilter → pick → snapshot. Best-effort: elke fout of lege
 * tussenstap levert een lege lijst, zodat de module-run nooit faalt.
 */
export async function buildKnowledgeBlocks(
  sections: MatchableSection[],
  deps: MatchingDeps = defaultMatchingDeps,
): Promise<KnowledgeBlock[]> {
  try {
    if (sections.length === 0) return [];
    const cards = await deps.loadApprovedCards();
    if (cards.length === 0) return [];

    const sectionThemes = await deps.classify(sections);
    const candidates = prefilter(sectionThemes, cards);
    if (candidates.size === 0) return [];

    const picks = await deps.pick(sections, candidates);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const blocks: KnowledgeBlock[] = [];
    for (const p of picks) {
      const card = byId.get(p.cardId);
      if (!card) continue;
      blocks.push({
        sectionKey: p.sectionKey,
        rank: blocks.length + 1,
        bridge: p.bridge,
        cardId: card.id,
        card: {
          title: card.title,
          kern: card.kern,
          toepassing: card.toepassing,
          sourceLabel: card.sourceLabel,
        },
      });
    }
    return blocks;
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run — verwacht PASS**

Run: `pnpm exec vitest run lib/knowledge/matching/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/matching/index.ts lib/knowledge/matching/index.test.ts
git commit -m "feat(kennis): buildKnowledgeBlocks orkestratie (best-effort)"
```

---

## Task 8: Matching-hook in de generieke service

**Files:**
- Modify: `modules/generic/service.ts`

- [ ] **Step 1: Voeg een `buildBlocks`-dep toe (default = de engine)**

In `modules/generic/service.ts`:

Imports (bij de andere imports):
```ts
import { buildKnowledgeBlocks } from "@/lib/knowledge/matching";
import { genericSections } from "@/lib/knowledge/matching/adapters/generic";
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";
```

In `ServiceDeps` (na `updateSession`):
```ts
  buildBlocks: (output: GenericOutput) => Promise<KnowledgeBlock[]>;
```

In `defaultDeps` (na `updateSession`):
```ts
  buildBlocks: (output) => buildKnowledgeBlocks(genericSections(output)),
```

- [ ] **Step 2: Roep 'm aan en sla op**

In `runGenericAnalysis`, ná `const output = toGenericOutput(result.markdown);`, voeg toe:
```ts
    const knowledgeBlocks = await deps.buildBlocks(output);
```
en in het `deps.updateSession(args.sessionId, { ... })`-object, voeg toe:
```ts
      knowledgeBlocks,
```

- [ ] **Step 3: Typecheck + bestaande tests**

Run: `pnpm typecheck` → geen nieuwe fouten.
Run: `pnpm exec vitest run modules/generic/service.test.ts`
Expected: groen. Levert een bestaande test een `updateSession`-payload-assertie die nu ook `knowledgeBlocks` bevat? Zo ja, stub `buildBlocks: async () => []` in die test-deps en neem `knowledgeBlocks: []` op in de verwachte payload. (Pas alleen de test aan, niet de service-logica.)

- [ ] **Step 4: Commit**

```bash
git add modules/generic/service.ts modules/generic/service.test.ts
git commit -m "feat(kennis): matching-hook in generieke runner"
```

---

## Task 9: Matching-hook in de website-check service

**Files:**
- Modify: `modules/website-check/service.ts`

- [ ] **Step 1: Voeg de dep toe**

In `modules/website-check/service.ts`:

Imports:
```ts
import { buildKnowledgeBlocks } from "@/lib/knowledge/matching";
import { websiteCheckSections } from "@/lib/knowledge/matching/adapters/website-check";
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";
```

In `ServiceDeps` (na `updateSession`):
```ts
  buildBlocks: (markdown: string) => Promise<KnowledgeBlock[]>;
```

In `defaultDeps` (na `updateSession`):
```ts
  buildBlocks: (markdown) => buildKnowledgeBlocks(websiteCheckSections(markdown)),
```

- [ ] **Step 2: Roep 'm aan en sla op**

In `runAnalysis`, ná `const result = await analyzer({ prompt });`, voeg toe:
```ts
    const knowledgeBlocks = await deps.buildBlocks(result.markdown);
```
en in het `deps.updateSession(args.sessionId, { status: "approved", output: result.markdown, ... })`-object, voeg toe:
```ts
      knowledgeBlocks,
```

- [ ] **Step 3: Typecheck + bestaande tests**

Run: `pnpm typecheck` → geen nieuwe fouten.
Run: `pnpm exec vitest run modules/website-check/service.test.ts`
Expected: groen; stub `buildBlocks: async () => []` in de test-deps waar nodig en voeg `knowledgeBlocks: []` toe aan verwachte payloads (alleen de test aanpassen).

- [ ] **Step 4: Commit**

```bash
git add modules/website-check/service.ts modules/website-check/service.test.ts
git commit -m "feat(kennis): matching-hook in website-check"
```

---

## Task 10: `KnowledgeBlock`-component (pull-quote)

**Files:**
- Create: `lib/modules/KnowledgeBlock.tsx`

Geen unit-test (browser-geverifieerd in Task 14).

- [ ] **Step 1: Schrijf het component**

```tsx
import type { KnowledgeBlock as KnowledgeBlockData } from "@/lib/knowledge/matching/types";

export function KnowledgeBlock({ block }: { block: KnowledgeBlockData }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl border-l-4 border-indigo-500 bg-indigo-50/60 p-5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">
        📖 Uit de theorie
      </p>
      {block.bridge && (
        <p className="mt-1.5 text-[13px] italic text-gray-600">{block.bridge}</p>
      )}
      <span className="-mb-3 text-3xl font-extrabold leading-none text-indigo-300">
        &ldquo;
      </span>
      <p className="text-base font-semibold leading-snug text-gray-900">
        {block.card.kern}
      </p>
      <p className="mt-2.5 text-xs text-gray-600">
        <span className="font-bold">{block.card.title}</span>
        {" — "}
        {block.card.sourceLabel}
      </p>
      {block.card.toepassing && (
        <p className="mt-1.5 text-[11px] text-gray-500">
          → {block.card.toepassing}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck` → geen fouten.

```bash
git add lib/modules/KnowledgeBlock.tsx
git commit -m "feat(kennis): KnowledgeBlock pull-quote-component"
```

---

## Task 11: `SectionPair`-layout (afwisselend)

**Files:**
- Create: `lib/modules/SectionPair.tsx`

- [ ] **Step 1: Schrijf het component**

```tsx
import type { ReactNode } from "react";
import type { KnowledgeBlock as KnowledgeBlockData } from "@/lib/knowledge/matching/types";
import { KnowledgeBlock } from "./KnowledgeBlock";

/**
 * Zet een sectie (children) en zijn kennisblokje naast elkaar (~60/40).
 * Afwisselend: oneven rank → blokje rechts, even rank → blokje links.
 * Mobiel (geen md): de sectie staat altijd boven het blokje.
 */
export function SectionPair({
  block,
  children,
}: {
  block: KnowledgeBlockData;
  children: ReactNode;
}) {
  const blockLeft = block.rank % 2 === 0;
  const cols = blockLeft
    ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]"
    : "md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]";
  return (
    <div className={`grid gap-5 md:items-start ${cols}`}>
      <div className={blockLeft ? "md:order-2" : "md:order-1"}>{children}</div>
      <div className={blockLeft ? "md:order-1" : "md:order-2"}>
        <KnowledgeBlock block={block} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck` → geen fouten.

```bash
git add lib/modules/SectionPair.tsx
git commit -m "feat(kennis): SectionPair 2-koloms afwisselende layout"
```

---

## Task 12: Blok-weving in de generieke runner

**Files:**
- Modify: `modules/generic/components/GenericReportView.tsx`
- Modify: `app/(app)/modules/[slug]/[sessionId]/page.tsx`

- [ ] **Step 1: `GenericReportView` — blocks-prop + weving**

Voeg imports toe:
```ts
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";
import { SectionPair } from "@/lib/modules/SectionPair";
```

Wijzig de component-signatuur:
```tsx
export function GenericReportView({
  moduleName,
  report,
  blocks = [],
}: {
  moduleName: string;
  report: GenericReport;
  blocks?: KnowledgeBlock[];
}) {
```

Vervang het `{groupSections(report.secties).map(...)}`-blok door een index-bewuste weving. Zet dit direct ná de hero-`</div>` en vóór het `volgendeStappen`-blok:

```tsx
      {(() => {
        const blockByKey = new Map(blocks.map((b) => [b.sectionKey, b]));
        const rows: React.ReactNode[] = [];
        let i = 0;
        while (i < report.secties.length) {
          const key = `sectie-${i}`;
          const block = blockByKey.get(key);
          if (block) {
            rows.push(
              <SectionPair key={key} block={block}>
                <SectieCard sectie={report.secties[i]} />
              </SectionPair>,
            );
            i += 1;
            continue;
          }
          const cur = report.secties[i];
          const next = report.secties[i + 1];
          const nextMatched = blockByKey.has(`sectie-${i + 1}`);
          if (cur.layout === "half" && next?.layout === "half" && !nextMatched) {
            rows.push(
              <div key={key} className="grid gap-5 md:grid-cols-2">
                <SectieCard sectie={cur} />
                <SectieCard sectie={next} />
              </div>,
            );
            i += 2;
          } else {
            rows.push(<SectieCard key={key} sectie={cur} />);
            i += 1;
          }
        }
        return rows;
      })()}
```

(De oude `groupSections`-helper mag blijven staan of verwijderd worden — hij wordt niet meer gebruikt; verwijder 'm om dode code te vermijden.)

- [ ] **Step 2: Result-page — blocks doorgeven**

In `app/(app)/modules/[slug]/[sessionId]/page.tsx`, in de `status === "approved"`-render, geef de blocks mee. De `row` bevat nu `knowledgeBlocks` (na Task 1). Wijzig:
```tsx
          <GenericReportView moduleName={moduleMeta.name} report={output.report} />
```
naar:
```tsx
          <GenericReportView
            moduleName={moduleMeta.name}
            report={output.report}
            blocks={row.knowledgeBlocks ?? []}
          />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck` → geen nieuwe fouten.

- [ ] **Step 4: Commit**

```bash
git add modules/generic/components/GenericReportView.tsx "app/(app)/modules/[slug]/[sessionId]/page.tsx"
git commit -m "feat(kennis): kennisblokjes verweven in generieke runner"
```

---

## Task 13: Blok-weving in website-check

**Files:**
- Modify: `modules/website-check/report/WebsiteCheckReport.tsx`
- Modify: `modules/website-check/components/WebsiteCheckResultView.tsx`
- Modify: `app/(app)/modules/website-check/[sessionId]/page.tsx`

- [ ] **Step 1: `WebsiteCheckReport` — blocks-prop + weving**

Voeg imports toe:
```ts
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";
import { SectionPair } from "@/lib/modules/SectionPair";
```

Wijzig de signatuur:
```tsx
export function WebsiteCheckReport({
  markdown,
  blocks = [],
}: {
  markdown: string;
  blocks?: KnowledgeBlock[];
}) {
```

In de structured render, vervang:
```tsx
      {blocks.onderdelen.map((o) => (
        <OnderdeelCard key={o.slug} onderdeel={o} />
      ))}
```
door (let op: `blocks` is nu de prop; hernoem de gemapte variabele niet — de geparsete data heet nu `parsed`):

> Let op naamconflict: het component gebruikt momenteel `const blocks = parseReport(markdown)`. Hernoem die lokale variabele naar `parsed` overal in dit component (zodat de prop `blocks` de kennisblokjes is). Dus: `const parsed = parseReport(markdown);` en overal `parsed.onderdelen`, `parsed.cover`, `parsed.samenvatting`, `parsed.strengths`, `parsed.improvements`, `parsed.acties`, `parsed.bodyMarkdown`.

Vervang daarna de onderdelen-map door:
```tsx
      {(() => {
        const blockByKey = new Map(blocks.map((b) => [b.sectionKey, b]));
        return parsed.onderdelen.map((o) => {
          const block = blockByKey.get(o.slug);
          return block ? (
            <SectionPair key={o.slug} block={block}>
              <OnderdeelCard onderdeel={o} />
            </SectionPair>
          ) : (
            <OnderdeelCard key={o.slug} onderdeel={o} />
          );
        });
      })()}
```

- [ ] **Step 2: `WebsiteCheckResultView` — blocks doorgeven**

```tsx
import { WebsiteCheckReport } from "../report/WebsiteCheckReport";
import type { KnowledgeBlock } from "@/lib/knowledge/matching/types";

export function WebsiteCheckResultView({
  markdown,
  blocks = [],
}: {
  markdown: string;
  blocks?: KnowledgeBlock[];
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <WebsiteCheckReport markdown={markdown} blocks={blocks} />
    </div>
  );
}
```

- [ ] **Step 3: Result-page — blocks doorgeven**

In `app/(app)/modules/website-check/[sessionId]/page.tsx`, wijzig:
```tsx
      <WebsiteCheckResultView markdown={row.output ?? ""} />
```
naar:
```tsx
      <WebsiteCheckResultView markdown={row.output ?? ""} blocks={row.knowledgeBlocks ?? []} />
```

(De gratis-check en `/r/[shareSlug]` renderen bewust ZONDER `blocks` — die laten we op de default `[]`.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck` → geen nieuwe fouten.

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/report/WebsiteCheckReport.tsx modules/website-check/components/WebsiteCheckResultView.tsx "app/(app)/modules/website-check/[sessionId]/page.tsx"
git commit -m "feat(kennis): kennisblokjes verweven in website-check"
```

---

## Task 14: Verificatie

**Files:** geen — dev-server + browser + (deliberate) DB/LLM.

- [ ] **Step 1: Volledige test-suite**

Run: `pnpm test`
Expected: alle tests groen (adapters, prefilter, classify, pick, orchestratie + bestaande).

- [ ] **Step 2: Migraties toegepast?**

Bevestig `sessions.knowledge_blocks` bestaat (Supabase MCP `execute_sql` op `information_schema.columns`), en dat 2A al gedraaid is (er zijn goedgekeurde kaarten met niet-lege `themes` — anders blijft matching leeg). Zo niet: draai eerst 2A's backfill.

- [ ] **Step 3: Tijdelijke preview-route (zonder auth), zoals bij plan 1**

Maak `app/preview/kennisblokjes/page.tsx` (NIET committen) dat een `GenericReportView` en een `WebsiteCheckReport` rendert met een handmatige `blocks`-array (2-3 `KnowledgeBlock`-snapshots met verschillende `rank` en `sectionKey`s die matchen op `sectie-0`/`sectie-1` resp. een onderdeel-slug). Start de dev-server (`preview_start`), open de route, en controleer met read_page/screenshot:
- Blokje staat **naast** de sectie (2-koloms), afwisselend links/rechts op rank.
- Sectie zonder match blijft volle breedte.
- Pull-quote toont brug-zin, kern, `titel — bron`, en toepassing.
- Geen console-errors.
Verwijder de preview-route ná de check.

- [ ] **Step 4: Echte run (deliberate)**

Draai (met echte env) een website-check of een generieke module op een bron; open het resultaat en bevestig dat er (bij voldoende bibliotheek-dekking) tot 3 blokjes naast secties verschijnen, en dat de run ook zónder matches gewoon slaagt (best-effort). Controleer `SELECT knowledge_blocks FROM sessions WHERE id='…'`.

- [ ] **Step 5: Afrondende commit (indien losse fixes)**

```bash
git add -A && git commit -m "chore(kennis): verificatie-fixes" || echo "niets te committen"
```

---

## Self-review (uitgevoerd)

- **Spec-dekking:** `MatchableSection` + adapters (generic/website-check) ✓, classify→prefilter→pick ✓ (mechanisme 2, taxonomie-woordenschat), max 3 + kwaliteitsdrempel (pick mag `[]`) ✓, snapshot in `sessions.knowledge_blocks` ✓ (stabiel, PDF-proof via de opslag), best-effort ✓, pull-quote náást sectie met afwisseling ✓, gratis-check/`/r/` uitgesloten ✓ (default `[]`).
- **Placeholders:** geen — alle code + commands concreet.
- **Type-consistentie:** `MatchableSection`/`ApprovedCard`/`KnowledgeBlock` (Task 2) doorheen adapters (3), prefilter (4), classify (5), pick (6), orkestratie (7), services (8-9), en rendering (10-13). `KnowledgeBlockSnapshot` (schema, Task 1) is structureel gelijk aan `KnowledgeBlock` (Task 2) — beide `{sectionKey,rank,bridge,cardId,card{title,kern,toepassing,sourceLabel}}`; de kolom is getypeerd als `KnowledgeBlockSnapshot[]` en de services schrijven `KnowledgeBlock[]` (toewijsbaar). De result-pages lezen `row.knowledgeBlocks ?? []`.
- **Naamconflict afgevangen:** in `WebsiteCheckReport` botst de bestaande lokale `blocks` (parse-resultaat) met de nieuwe prop `blocks` — Task 13 hernoemt de lokale naar `parsed`.
- **Ambiguïteit:** `rank` bepaalt links/rechts (oneven rechts, even links); mobiel altijd sectie boven blokje (via `md:order`).

## Uit scope / later

- ICP-adapter + weving; handmatige admin-themes-editor (2A-restant); "opnieuw matchen"-actie; embeddings-prefilter bij groei.
