# Kennisbibliotheek (subsysteem 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een admin levert een boek (PDF/EPUB) aan; het systeem distilleert het per hoofdstuk tot Nederlandse concept-kaarten; de admin keurt elke kaart goed. Alleen goedgekeurde kaarten zijn later bruikbaar (subsysteem 2).

**Architecture:** Upload → privé Storage-bucket → extractie tot hoofdstukken (EPUB via `jszip`+`cheerio`, PDF via `pdf-parse`) → per-hoofdstuk achtergrond-distillatie (Claude, altijd NL-output) binnen Vercel's 300s-budget, resumebaar → twee gedeelde tabellen `knowledge_sources`/`knowledge_cards` → admin-UI met goedkeur-wachtrij. Server-side writes via de bestaande service-role client.

**Tech Stack:** Next.js (App Router, server components + server actions), Drizzle + Supabase Postgres, Zod, Anthropic SDK, `jszip`, `pdf-parse`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-kennisbibliotheek-design.md`

**Context voor de uitvoerder:**
- Supabase-project-id (via de Supabase MCP): `nirlmczamjrcxciyzkpy`.
- Admin-auth is al geregeld in `app/(admin)/layout.tsx` (redirect als `profiles.role !== 'admin'`). Nieuwe admin-pagina's onder `app/(admin)/admin/kennis/` erven die guard.
- Server-side DB/Storage-writes gaan via `createServiceClient()` uit `lib/supabase/service.ts` (bypasst RLS; alleen server-context).
- Achtergrondwerk: `import { after } from "next/server"` binnen een server-action, met `export const maxDuration = 300` op de route (patroon uit `app/(app)/modules/website-check/actions.ts`).
- Voortgang tonen: hergebruik `app/(app)/modules/_components/running-poll.tsx` (`<RunningPoll />` roept elke 3s `router.refresh()` aan).
- Claude raw-call: `analyzeClaudeRaw({ prompt })` uit `lib/ai/claude-raw.ts` geeft `{ markdown }`; JSON eruit halen met `extractAndParseJson` uit `lib/ai/claude.ts` (bestaand patroon in `modules/generic/service.ts`).

**Gedeelde types (gebruikt door meerdere taken):**
- `ExtractedBook = { title: string | null; author: string | null; language: string | null; chapters: string[] }`
- `KnowledgeCardDraft = { title: string; kern: string; toepassing: string; tags: string[] }`
- source-status: `extracting | distilling | done | failed`; card-status: `concept | goedgekeurd`; kind: `pdf | epub`.

**Refinement t.o.v. de spec:** de spec noemde voor PDF "hergebruik de Claude-conversie per pagina-batch". Dat schaalt niet naar boeklengte (Claude's output-cap ~16k tokens). Daarom extraheert dit plan PDF-tekst met `pdf-parse` (pure tekst, geen LLM) en splitst daarna heuristisch op hoofdstukken. EPUB blijft de betrouwbaarste, geteste route.

---

## File Structure

| Bestand | Verantwoordelijkheid | Actie |
| --- | --- | --- |
| `lib/db/schema.ts` | Enums + tabellen `knowledge_sources`, `knowledge_cards` | Modify |
| DB-migratie (Supabase) | Tabellen, RLS, bucket `knowledge-books` | Apply (SQL) |
| `lib/knowledge/schema.ts` | Zod-schema + parser voor kaart-drafts | Create |
| `lib/knowledge/extract.ts` | Boek (PDF/EPUB) → `ExtractedBook`; hoofdstuk-split | Create |
| `lib/knowledge/distill.ts` | Hoofdstuktekst → `KnowledgeCardDraft[]` (Claude, NL) | Create |
| `lib/knowledge/service.ts` | Orkestratie: bron aanmaken, per-hoofdstuk distillatie, status | Create |
| `app/(admin)/admin/kennis/actions.ts` | Server-actions: upload, resume, goedkeuren, bewerken, verwijderen | Create |
| `app/(admin)/admin/kennis/page.tsx` | Bronnen-lijst + upload | Create |
| `app/(admin)/admin/kennis/[sourceId]/page.tsx` | Goedkeur-wachtrij per boek | Create |
| `app/(admin)/layout.tsx` | `ADMIN_NAV`-entry "Kennisbibliotheek" | Modify |
| `package.json` | Dependencies `jszip`, `pdf-parse` | Modify |

---

## Task 1: Datamodel (enums + tabellen) + migratie + bucket

**Files:**
- Modify: `lib/db/schema.ts`
- Apply: Supabase-migratie (SQL)

- [ ] **Step 1: Drizzle-schema uitbreiden**

Voeg aan het einde van `lib/db/schema.ts` toe (vóór de `// ── Types ──`-sectie):

```ts
// ── Kennisbibliotheek (admin-beheerd, gedeeld) ──────────────────────

export const knowledgeSourceKind = pgEnum("knowledge_source_kind", [
  "pdf",
  "epub",
]);
export const knowledgeSourceStatus = pgEnum("knowledge_source_status", [
  "extracting",
  "distilling",
  "done",
  "failed",
]);
export const knowledgeCardStatus = pgEnum("knowledge_card_status", [
  "concept",
  "goedgekeurd",
]);

export const knowledgeSources = pgTable("knowledge_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  author: text("author"),
  language: text("language"),
  kind: knowledgeSourceKind("kind").notNull(),
  storagePath: text("storage_path").notNull(),
  status: knowledgeSourceStatus("status").default("extracting").notNull(),
  chapters: jsonb("chapters").$type<string[]>().default([]).notNull(),
  chaptersTotal: integer("chapters_total").default(0).notNull(),
  chaptersDone: integer("chapters_done").default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeCards = pgTable("knowledge_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => knowledgeSources.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kern: text("kern").notNull(),
  toepassing: text("toepassing").default("").notNull(),
  tags: text("tags").array().default([]).notNull(),
  sourceLabel: text("source_label").notNull(),
  status: knowledgeCardStatus("status").default("concept").notNull(),
  chapterIndex: integer("chapter_index").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type KnowledgeCard = typeof knowledgeCards.$inferSelect;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen fouten (alle gebruikte helpers `pgEnum/pgTable/uuid/text/jsonb/integer/timestamp` zijn al geïmporteerd bovenaan `schema.ts`).

- [ ] **Step 3: Migratie toepassen (Supabase MCP `apply_migration`, naam `knowledge_library`)**

```sql
CREATE TYPE knowledge_source_kind AS ENUM ('pdf', 'epub');
CREATE TYPE knowledge_source_status AS ENUM ('extracting', 'distilling', 'done', 'failed');
CREATE TYPE knowledge_card_status AS ENUM ('concept', 'goedgekeurd');

CREATE TABLE knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  language text,
  kind knowledge_source_kind NOT NULL,
  storage_path text NOT NULL,
  status knowledge_source_status NOT NULL DEFAULT 'extracting',
  chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  chapters_total integer NOT NULL DEFAULT 0,
  chapters_done integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  title text NOT NULL,
  kern text NOT NULL,
  toepassing text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  source_label text NOT NULL,
  status knowledge_card_status NOT NULL DEFAULT 'concept',
  chapter_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_cards_source_id_idx ON knowledge_cards(source_id);

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;
```

(Geen RLS-policies: zonder policy is de tabel dicht voor de anon/authenticated rollen; alle toegang loopt via de service-role client, die RLS bypasst — consistent met de andere admin-only tabellen.)

- [ ] **Step 4: Storage-bucket aanmaken (Supabase MCP `execute_sql`)**

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-books', 'knowledge-books', false, 52428800,
  ARRAY['application/pdf', 'application/epub+zip']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types
RETURNING id, file_size_limit, allowed_mime_types;
```

Expected: rij `knowledge-books`, limit `52428800`, mimes pdf + epub.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(kennis): datamodel knowledge_sources + knowledge_cards"
```

---

## Task 2: Kaart-schema + LLM-output-parser

**Files:**
- Create: `lib/knowledge/schema.ts`
- Test: `lib/knowledge/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from "vitest";
import { parseCardDrafts, KnowledgeCardDraftSchema } from "./schema";

test("KnowledgeCardDraftSchema: vult defaults en trimt", () => {
  const card = KnowledgeCardDraftSchema.parse({
    title: "  Sociale bewijskracht ",
    kern: "Mensen kijken naar anderen.",
  });
  expect(card.title).toBe("Sociale bewijskracht");
  expect(card.toepassing).toBe("");
  expect(card.tags).toEqual([]);
});

test("parseCardDrafts: pakt geldige kaarten, negeert ongeldige", () => {
  const raw = JSON.stringify([
    { title: "A", kern: "kern A", toepassing: "doe A", tags: ["x"] },
    { title: "", kern: "geen titel" },
    { kern: "geen titel-veld" },
  ]);
  const cards = parseCardDrafts(raw);
  expect(cards).toHaveLength(1);
  expect(cards[0].title).toBe("A");
  expect(cards[0].tags).toEqual(["x"]);
});

test("parseCardDrafts: JSON in ```-fences wordt ook geparsed", () => {
  const raw = "```json\n[{\"title\":\"B\",\"kern\":\"kern B\"}]\n```";
  const cards = parseCardDrafts(raw);
  expect(cards).toHaveLength(1);
  expect(cards[0].title).toBe("B");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/knowledge/schema.test.ts`
Expected: FAIL — module bestaat nog niet.

- [ ] **Step 3: Implement**

```ts
import { z } from "zod";

export const KnowledgeCardDraftSchema = z.object({
  title: z.string().trim().min(1),
  kern: z.string().trim().min(1),
  toepassing: z.string().trim().default(""),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type KnowledgeCardDraft = z.infer<typeof KnowledgeCardDraftSchema>;

/**
 * Haalt de JSON-array uit een (mogelijk in markdown-fences verpakte)
 * LLM-tekst. Strip eerst alle ```-fences, pak dan alles tussen de buitenste
 * [ en ]. Gooit als er geen array in staat. (Let op: de gedeelde helper
 * `extractAndParseJson` in `@/lib/ai/claude` kan alleen top-level objecten,
 * geen arrays — daarom hier een eigen array-aware parse.)
 */
function extractJsonArray(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("geen JSON-array gevonden");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Parse de LLM-output naar geldige kaart-drafts. Verwacht een JSON-array
 * (eventueel in markdown-fences). Ongeldige elementen worden overgeslagen
 * zodat één rotte kaart de hele oogst niet verpest.
 */
export function parseCardDrafts(raw: string): KnowledgeCardDraft[] {
  let parsed: unknown;
  try {
    parsed = extractJsonArray(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const cards: KnowledgeCardDraft[] = [];
  for (const item of parsed) {
    const result = KnowledgeCardDraftSchema.safeParse(item);
    if (result.success) cards.push(result.data);
  }
  return cards;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/knowledge/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/schema.ts lib/knowledge/schema.test.ts
git commit -m "feat(kennis): zod-schema + parser voor concept-kaarten"
```

---

## Task 3: Hoofdstuk-splitsing (pure helper)

**Files:**
- Create: `lib/knowledge/extract.ts`
- Test: `lib/knowledge/extract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from "vitest";
import { splitIntoChapters } from "./extract";

test("splitIntoChapters: splitst op HOOFDSTUK/CHAPTER-koppen", () => {
  const text =
    "HOOFDSTUK 1\nWederkerigheid\nTekst een.\n\nHOOFDSTUK 2\nSchaarste\nTekst twee.";
  const chapters = splitIntoChapters(text);
  expect(chapters).toHaveLength(2);
  expect(chapters[0]).toContain("Wederkerigheid");
  expect(chapters[1]).toContain("Schaarste");
});

test("splitIntoChapters: zonder koppen valt terug op woordblokken", () => {
  const text = Array.from({ length: 13000 }, (_, i) => `w${i}`).join(" ");
  const chapters = splitIntoChapters(text);
  expect(chapters.length).toBeGreaterThanOrEqual(2);
});

test("splitIntoChapters: lege/witruimte-invoer geeft lege lijst", () => {
  expect(splitIntoChapters("   \n  ")).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/knowledge/extract.test.ts`
Expected: FAIL — `splitIntoChapters` bestaat niet.

- [ ] **Step 3: Implement (begin van `lib/knowledge/extract.ts`)**

```ts
export type ExtractedBook = {
  title: string | null;
  author: string | null;
  language: string | null;
  chapters: string[];
};

const CHAPTER_RE = /^\s*(HOOFDSTUK|CHAPTER)\b.*$/im;
const WORDS_PER_BLOCK = 6000;

/**
 * Splitst platte tekst in hoofdstukken. Eerst op HOOFDSTUK/CHAPTER-koppen;
 * als die ontbreken, in blokken van ~WORDS_PER_BLOCK woorden zodat elk blok
 * binnen één LLM-call past.
 */
export function splitIntoChapters(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split("\n");
  const hasHeadings = lines.some((l) => CHAPTER_RE.test(l));

  if (hasHeadings) {
    const chapters: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (CHAPTER_RE.test(line) && current.some((l) => l.trim())) {
        chapters.push(current.join("\n").trim());
        current = [];
      }
      current.push(line);
    }
    if (current.some((l) => l.trim())) chapters.push(current.join("\n").trim());
    return chapters.filter((c) => c.length > 0);
  }

  const words = trimmed.split(/\s+/);
  const blocks: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_BLOCK) {
    blocks.push(words.slice(i, i + WORDS_PER_BLOCK).join(" "));
  }
  return blocks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/knowledge/extract.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/extract.ts lib/knowledge/extract.test.ts
git commit -m "feat(kennis): hoofdstuk-splitsing van boektekst"
```

---

## Task 4: EPUB- en PDF-extractie

**Files:**
- Modify: `lib/knowledge/extract.ts`
- Modify: `lib/knowledge/extract.test.ts`
- Modify: `package.json` (deps `jszip`, `pdf-parse`)

- [ ] **Step 1: Dependencies installeren**

Run: `pnpm add jszip pdf-parse && pnpm add -D @types/pdf-parse`
Expected: `jszip`, `pdf-parse` in `dependencies`.

- [ ] **Step 2: Write the failing test (EPUB round-trip met een gefabriceerd boek)**

Voeg toe aan `lib/knowledge/extract.test.ts`:

```ts
import JSZip from "jszip";
import { extractEpub } from "./extract";

async function makeEpub(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Invloed</dc:title><dc:creator>Robert Cialdini</dc:creator><dc:language>nl</dc:language></metadata><manifest><item id="c1" href="Text/c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="Text/c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`,
  );
  zip.file("OEBPS/Text/c1.xhtml", `<html><body><h1>Wederkerigheid</h1><p>Het oude geven en nemen.</p></body></html>`);
  zip.file("OEBPS/Text/c2.xhtml", `<html><body><h1>Schaarste</h1><p>De regel van het tekort.</p></body></html>`);
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

test("extractEpub: leest metadata en hoofdstukken in spine-volgorde", async () => {
  const book = await extractEpub(await makeEpub());
  expect(book.title).toBe("Invloed");
  expect(book.author).toBe("Robert Cialdini");
  expect(book.language).toBe("nl");
  expect(book.chapters).toHaveLength(2);
  expect(book.chapters[0]).toContain("Wederkerigheid");
  expect(book.chapters[1]).toContain("De regel van het tekort");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run lib/knowledge/extract.test.ts`
Expected: FAIL — `extractEpub` bestaat niet.

- [ ] **Step 4: Implement (aan `lib/knowledge/extract.ts` toevoegen)**

```ts
import JSZip from "jszip";
import * as cheerio from "cheerio";

function stripXhtml(xhtml: string): string {
  const $ = cheerio.load(xhtml);
  $("script, style").remove();
  return $("body").text().replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

function resolvePath(base: string, href: string): string {
  const parts = base.split("/").slice(0, -1);
  for (const seg of href.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

export async function extractEpub(buffer: Buffer): Promise<ExtractedBook> {
  const zip = await JSZip.loadAsync(buffer);

  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("EPUB: container.xml ontbreekt");
  const opfPath = cheerio
    .load(containerXml, { xmlMode: true })("rootfile")
    .attr("full-path");
  if (!opfPath) throw new Error("EPUB: geen rootfile in container.xml");

  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error(`EPUB: ${opfPath} ontbreekt`);
  const $opf = cheerio.load(opfXml, { xmlMode: true });

  const title = $opf("metadata title").first().text().trim() || null;
  const author = $opf("metadata creator").first().text().trim() || null;
  const language = $opf("metadata language").first().text().trim() || null;

  const manifest = new Map<string, string>();
  $opf("manifest item").each((_, el) => {
    const id = $opf(el).attr("id");
    const href = $opf(el).attr("href");
    if (id && href) manifest.set(id, href);
  });

  const chapters: string[] = [];
  const itemrefs = $opf("spine itemref").toArray();
  for (const ref of itemrefs) {
    const idref = $opf(ref).attr("idref");
    const href = idref ? manifest.get(idref) : undefined;
    if (!href) continue;
    const docPath = resolvePath(opfPath, href);
    const xhtml = await zip.file(docPath)?.async("text");
    if (!xhtml) continue;
    const text = stripXhtml(xhtml);
    if (text.split(/\s+/).length >= 50) chapters.push(text);
  }

  return { title, author, language, chapters };
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedBook> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return {
    title: data.info?.Title?.trim() || null,
    author: data.info?.Author?.trim() || null,
    language: null,
    chapters: splitIntoChapters(data.text),
  };
}

export async function extractBook(
  buffer: Buffer,
  kind: "pdf" | "epub",
): Promise<ExtractedBook> {
  return kind === "epub" ? extractEpub(buffer) : extractPdf(buffer);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run lib/knowledge/extract.test.ts`
Expected: PASS (4 tests). Draai ook `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add lib/knowledge/extract.ts lib/knowledge/extract.test.ts package.json pnpm-lock.yaml
git commit -m "feat(kennis): EPUB- en PDF-extractie naar hoofdstukken"
```

---

## Task 5: Distillatie van een hoofdstuk

**Files:**
- Create: `lib/knowledge/distill.ts`
- Test: `lib/knowledge/distill.test.ts`

- [ ] **Step 1: Write the failing test (promptbouw is de te testen logica)**

```ts
import { test, expect } from "vitest";
import { buildDistillPrompt } from "./distill";

test("buildDistillPrompt: vraagt Nederlandse output ongeacht brontaal", () => {
  const prompt = buildDistillPrompt({
    chapterText: "Reciprocity: people repay favors.",
    sourceLabel: "Robert Cialdini — Influence",
    language: "en",
  });
  expect(prompt).toContain("Robert Cialdini — Influence");
  expect(prompt).toMatch(/Nederlands/i);
  expect(prompt).toContain("Reciprocity: people repay favors.");
  expect(prompt).toMatch(/JSON/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/knowledge/distill.test.ts`
Expected: FAIL — module bestaat niet.

- [ ] **Step 3: Implement**

```ts
import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { parseCardDrafts, type KnowledgeCardDraft } from "./schema";

export function buildDistillPrompt(args: {
  chapterText: string;
  sourceLabel: string;
  language: string | null;
}): string {
  const bron = args.language && args.language.toLowerCase().startsWith("nl")
    ? "Het bronhoofdstuk is Nederlands."
    : `Het bronhoofdstuk is anderstalig (${args.language ?? "onbekend"}).`;
  return `Je distilleert één hoofdstuk uit een marketing/sales-boek tot concept-kaarten voor een kennisbibliotheek. ${bron}

Haal de kernprincipes, frameworks en signature-voorbeelden eruit en zet ze om naar korte kaarten. Regels:
- Schrijf ALLE tekst in het Nederlands (B1-niveau), ook als het bronhoofdstuk anderstalig is. Vertaal de ideeën, kopieer geen zinnen letterlijk uit de bron.
- Elke kaart is een principe in je eigen woorden, geen samenvatting van het hoofdstuk.
- Verzin geen feiten; baseer je op het hoofdstuk.

Geef UITSLUITEND een JSON-array terug (geen tekst eromheen). Elk element:
{
  "title": "korte naam van het principe",
  "kern": "2-4 zinnen die het principe uitleggen",
  "toepassing": "één praktische zin: zo pas je het toe",
  "tags": ["thema of situatie", "nog een"]
}
Geef 1 tot 4 kaarten, alleen de sterkste principes.

BRON: ${args.sourceLabel}

HOOFDSTUK:
${args.chapterText}`;
}

/** Distilleert één hoofdstuk tot kaart-drafts via Claude. */
export async function distillChapter(args: {
  chapterText: string;
  sourceLabel: string;
  language: string | null;
}): Promise<KnowledgeCardDraft[]> {
  const prompt = buildDistillPrompt(args);
  const result = await analyzeClaudeRaw({ prompt });
  return parseCardDrafts(result.markdown);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/knowledge/distill.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/distill.ts lib/knowledge/distill.test.ts
git commit -m "feat(kennis): distillatie van een hoofdstuk tot concept-kaarten"
```

---

## Task 6: Service-orkestratie (resumebare distillatie)

**Files:**
- Create: `lib/knowledge/service.ts`
- Test: `lib/knowledge/service.test.ts`

- [ ] **Step 1: Write the failing test (loop-logica met geïnjecteerde deps)**

```ts
import { test, expect, vi } from "vitest";
import { runDistillation, type DistillDeps } from "./service";

function makeDeps(overrides: Partial<DistillDeps> = {}): DistillDeps {
  return {
    loadSource: vi.fn(async () => ({
      id: "s1",
      chapters: ["hfst A", "hfst B", "hfst C"],
      chaptersDone: 1,
      chaptersTotal: 3,
      author: "Cialdini",
      title: "Invloed",
      language: "nl",
    })),
    distillChapter: vi.fn(async () => [
      { title: "P", kern: "k", toepassing: "t", tags: ["x"] },
    ]),
    insertCards: vi.fn(async () => undefined),
    updateSource: vi.fn(async () => undefined),
    nowMs: () => 0,
    budgetMs: 240_000,
    ...overrides,
  };
}

test("runDistillation: verwerkt resterende hoofdstukken en zet status done", async () => {
  const deps = makeDeps();
  await runDistillation("s1", deps);
  // hoofdstuk 2 en 3 (index 1 en 2) worden gedistilleerd
  expect(deps.distillChapter).toHaveBeenCalledTimes(2);
  expect(deps.insertCards).toHaveBeenCalledTimes(2);
  expect(deps.updateSource).toHaveBeenLastCalledWith("s1", {
    chaptersDone: 3,
    status: "done",
  });
});

test("runDistillation: stopt binnen budget en laat status distilling", async () => {
  let t = 0;
  const deps = makeDeps({ nowMs: () => (t += 300_000), budgetMs: 240_000 });
  await runDistillation("s1", deps);
  expect(deps.distillChapter).toHaveBeenCalledTimes(1);
  expect(deps.updateSource).toHaveBeenLastCalledWith("s1", {
    chaptersDone: 2,
    status: "distilling",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/knowledge/service.test.ts`
Expected: FAIL — module bestaat niet.

- [ ] **Step 3: Implement**

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources } from "@/lib/db/schema";
import { distillChapter } from "./distill";
import type { KnowledgeCardDraft } from "./schema";

export type DistillDeps = {
  loadSource: (id: string) => Promise<{
    id: string;
    chapters: string[];
    chaptersDone: number;
    chaptersTotal: number;
    author: string | null;
    title: string;
    language: string | null;
  } | null>;
  distillChapter: (args: {
    chapterText: string;
    sourceLabel: string;
    language: string | null;
  }) => Promise<KnowledgeCardDraft[]>;
  insertCards: (
    sourceId: string,
    sourceLabel: string,
    chapterIndex: number,
    cards: KnowledgeCardDraft[],
  ) => Promise<void>;
  updateSource: (
    id: string,
    patch: { chaptersDone: number; status: "distilling" | "done" | "failed" },
  ) => Promise<void>;
  nowMs: () => number;
  budgetMs: number;
};

function sourceLabelOf(s: { author: string | null; title: string }): string {
  return s.author ? `${s.author} — ${s.title}` : s.title;
}

/**
 * Distilleert de nog niet-verwerkte hoofdstukken van een bron, hoofdstuk voor
 * hoofdstuk. Stopt netjes zodra het wall-clock-budget bijna op is (Vercel 300s)
 * en laat de status op 'distilling' zodat een volgende aanroep hervat vanaf
 * chaptersDone. Klaar → status 'done'.
 */
export async function runDistillation(
  sourceId: string,
  deps: DistillDeps = defaultDeps,
): Promise<void> {
  const source = await deps.loadSource(sourceId);
  if (!source) return;
  const start = deps.nowMs();
  const label = sourceLabelOf(source);
  const total = source.chapters.length;
  let done = source.chaptersDone;

  try {
    for (let i = source.chaptersDone; i < total; i++) {
      const cards = await deps.distillChapter({
        chapterText: source.chapters[i],
        sourceLabel: label,
        language: source.language,
      });
      await deps.insertCards(sourceId, label, i, cards);
      done = i + 1;
      // Voortgang per hoofdstuk wegschrijven: de admin ziet het live en een
      // resume (na budget-stop of een harde Vercel-kill) hervat exact hier.
      await deps.updateSource(sourceId, {
        chaptersDone: done,
        status: done >= total ? "done" : "distilling",
      });
      if (done < total && deps.nowMs() - start > deps.budgetMs) return;
    }
  } catch (err) {
    await deps.updateSource(sourceId, { chaptersDone: done, status: "distilling" });
    throw err;
  }
}

export const defaultDeps: DistillDeps = {
  loadSource: async (id) => {
    const [row] = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      chapters: row.chapters,
      chaptersDone: row.chaptersDone,
      chaptersTotal: row.chaptersTotal,
      author: row.author,
      title: row.title,
      language: row.language,
    };
  },
  distillChapter,
  insertCards: async (sourceId, sourceLabel, chapterIndex, cards) => {
    if (cards.length === 0) return;
    await db.insert(knowledgeCards).values(
      cards.map((c) => ({
        sourceId,
        title: c.title,
        kern: c.kern,
        toepassing: c.toepassing,
        tags: c.tags,
        sourceLabel,
        chapterIndex,
      })),
    );
  },
  updateSource: async (id, patch) => {
    await db
      .update(knowledgeSources)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(knowledgeSources.id, id));
  },
  nowMs: () => Date.now(),
  budgetMs: 240_000,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/knowledge/service.test.ts`
Expected: PASS (2 tests). Draai `pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/service.ts lib/knowledge/service.test.ts
git commit -m "feat(kennis): resumebare per-hoofdstuk distillatie-service"
```

---

## Task 7: Admin server-actions

**Files:**
- Create: `app/(admin)/admin/kennis/actions.ts`

- [ ] **Step 1: Implement**

```ts
"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources, profiles } from "@/lib/db/schema";
import { extractBook } from "@/lib/knowledge/extract";
import { runDistillation } from "@/lib/knowledge/service";

const BUCKET = "knowledge-books";

const MIME_TO_KIND: Record<string, "pdf" | "epub"> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
};

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/kennis");
  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (p?.role !== "admin") redirect("/modules");
}

export async function uploadBookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/kennis?error=" + encodeURIComponent("Geen bestand gekozen"));
  }
  const kind = MIME_TO_KIND[(file as File).type];
  if (!kind) {
    redirect("/admin/kennis?error=" + encodeURIComponent("Alleen PDF of EPUB"));
  }

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const storagePath = `${randomUUID()}.${kind}`;
  const supabase = createServiceClient();
  const up = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: (file as File).type,
    upsert: false,
  });
  if (up.error) {
    redirect("/admin/kennis?error=" + encodeURIComponent(up.error.message));
  }

  let sourceId: string;
  try {
    const book = await extractBook(buffer, kind);
    if (book.chapters.length === 0) throw new Error("Geen tekst gevonden in het boek");
    const [row] = await db
      .insert(knowledgeSources)
      .values({
        title: book.title ?? (file as File).name,
        author: book.author,
        language: book.language,
        kind,
        storagePath,
        status: "distilling",
        chapters: book.chapters,
        chaptersTotal: book.chapters.length,
        chaptersDone: 0,
      })
      .returning({ id: knowledgeSources.id });
    sourceId = row.id;
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    const msg = err instanceof Error ? err.message : "Extractie mislukt";
    redirect("/admin/kennis?error=" + encodeURIComponent(msg));
  }

  after(() => runDistillation(sourceId));
  revalidatePath("/admin/kennis");
  redirect(`/admin/kennis/${sourceId}`);
}

export async function resumeDistillationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return;
  after(() => runDistillation(sourceId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}

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

export async function updateCardAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!cardId) return;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  await db
    .update(knowledgeCards)
    .set({
      title: String(formData.get("title") ?? "").trim(),
      kern: String(formData.get("kern") ?? "").trim(),
      toepassing: String(formData.get("toepassing") ?? "").trim(),
      tags,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeCards.id, cardId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!cardId) return;
  await db.delete(knowledgeCards).where(eq(knowledgeCards.id, cardId));
  revalidatePath(`/admin/kennis/${sourceId}`);
}

export async function deleteSourceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sourceId = String(formData.get("sourceId") ?? "");
  if (!sourceId) return;
  const [row] = await db
    .select({ storagePath: knowledgeSources.storagePath })
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, sourceId))
    .limit(1);
  if (row?.storagePath) {
    createServiceClient().storage.from(BUCKET).remove([row.storagePath]).catch(() => undefined);
  }
  await db.delete(knowledgeSources).where(eq(knowledgeSources.id, sourceId));
  revalidatePath("/admin/kennis");
  redirect("/admin/kennis");
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck`
Expected: geen fouten.

```bash
git add "app/(admin)/admin/kennis/actions.ts"
git commit -m "feat(kennis): admin server-actions (upload, distilleren, goedkeuren)"
```

---

## Task 8: Admin-UI (bronnen-lijst, goedkeur-wachtrij, nav)

**Files:**
- Create: `app/(admin)/admin/kennis/page.tsx`
- Create: `app/(admin)/admin/kennis/[sourceId]/page.tsx`
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Nav-entry toevoegen**

In `app/(admin)/layout.tsx`: importeer een icoon en voeg een `ADMIN_NAV`-item toe. Wijzig de import-regel `lucide-react` naar:

```ts
import { LogOut, FileText, Wand2, LayoutGrid, Users, ArrowLeft, BookOpen } from "lucide-react";
```

en voeg toe aan de `ADMIN_NAV`-array (na `Gebruikers`):

```ts
  { href: "/admin/kennis", label: "Kennisbibliotheek", icon: BookOpen },
```

- [ ] **Step 2: Bronnen-lijst + upload (`app/(admin)/admin/kennis/page.tsx`)**

```tsx
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeSources } from "@/lib/db/schema";
import { uploadBookAction } from "./actions";

export const maxDuration = 300;

export default async function KennisPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const sources = await db
    .select()
    .from(knowledgeSources)
    .orderBy(desc(knowledgeSources.createdAt));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Kennisbibliotheek</h1>
      <p className="mt-1 text-sm text-gray-600">
        Lever een boek (PDF of EPUB) aan. Het wordt gedistilleerd tot concept-kaarten
        die je daarna per stuk goedkeurt.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        action={uploadBookAction}
        encType="multipart/form-data"
        className="mt-6 rounded-xl border bg-white p-4"
      >
        <input
          name="file"
          type="file"
          accept="application/pdf,application/epub+zip,.pdf,.epub"
          required
          className="block w-full text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">Max 50 MB. Auteur en taal worden automatisch herkend.</p>
        <button
          type="submit"
          className="mt-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Boek distilleren
        </button>
      </form>

      <h2 className="mt-8 mb-2 text-lg font-bold">Aangeleverde boeken</h2>
      {sources.length === 0 ? (
        <p className="text-sm text-gray-500">Nog geen boeken.</p>
      ) : (
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/kennis/${s.id}`}
                className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.title}</span>
                  <span className="block text-xs text-gray-500">
                    {s.author ?? "onbekende auteur"} · {s.language ?? "?"} ·{" "}
                    {s.chaptersDone}/{s.chaptersTotal} hoofdstukken
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-purple-700">
                  {s.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Goedkeur-wachtrij (`app/(admin)/admin/kennis/[sourceId]/page.tsx`)**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db/client";
import { knowledgeCards, knowledgeSources } from "@/lib/db/schema";
import { RunningPoll } from "@/app/(app)/modules/_components/running-poll";
import {
  approveCardAction,
  updateCardAction,
  deleteCardAction,
  resumeDistillationAction,
} from "../actions";

export default async function KennisSourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const [source] = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.id, sourceId))
    .limit(1);
  if (!source) notFound();

  const cards = await db
    .select()
    .from(knowledgeCards)
    .where(eq(knowledgeCards.sourceId, sourceId))
    .orderBy(asc(knowledgeCards.chapterIndex), asc(knowledgeCards.createdAt));

  const busy = source.status === "distilling" || source.status === "extracting";

  return (
    <div className="mx-auto max-w-3xl">
      {busy && <RunningPoll />}
      <Link href="/admin/kennis" className="inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{source.title}</h1>
      <p className="text-sm text-gray-600">
        {source.author ?? "onbekende auteur"} · {source.chaptersDone}/{source.chaptersTotal}{" "}
        hoofdstukken · {cards.length} kaarten
      </p>

      {busy && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <span>Bezig met distilleren… ({source.chaptersDone}/{source.chaptersTotal})</span>
          <form action={resumeDistillationAction}>
            <input type="hidden" name="sourceId" value={source.id} />
            <button type="submit" className="rounded bg-white px-3 py-1 text-xs font-semibold text-blue-700 border">
              Ga door
            </button>
          </form>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {cards.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4">
            <form action={updateCardAction} className="space-y-2">
              <input type="hidden" name="cardId" value={c.id} />
              <input type="hidden" name="sourceId" value={source.id} />
              <div className="flex items-center justify-between gap-2">
                <input
                  name="title"
                  defaultValue={c.title}
                  className="w-full rounded border px-2 py-1 text-sm font-semibold"
                />
                <span
                  className={
                    c.status === "goedgekeurd"
                      ? "shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"
                      : "shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                  }
                >
                  {c.status}
                </span>
              </div>
              <textarea name="kern" defaultValue={c.kern} rows={3} className="w-full rounded border px-2 py-1 text-sm" />
              <input name="toepassing" defaultValue={c.toepassing} className="w-full rounded border px-2 py-1 text-sm" />
              <input
                name="tags"
                defaultValue={c.tags.join(", ")}
                placeholder="tags, komma-gescheiden"
                className="w-full rounded border px-2 py-1 text-xs"
              />
              <div className="flex gap-2">
                <button type="submit" className="rounded border px-3 py-1 text-xs font-semibold">
                  Bewaar
                </button>
              </div>
            </form>
            <div className="mt-2 flex gap-2 border-t pt-2">
              <form action={approveCardAction}>
                <input type="hidden" name="cardId" value={c.id} />
                <input type="hidden" name="sourceId" value={source.id} />
                <button
                  type="submit"
                  className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  Goedkeuren
                </button>
              </form>
              <form action={deleteCardAction}>
                <input type="hidden" name="cardId" value={c.id} />
                <input type="hidden" name="sourceId" value={source.id} />
                <button type="submit" className="rounded border px-3 py-1 text-xs text-red-600">
                  Verwijderen
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {cards.length === 0 && !busy && (
        <p className="mt-6 text-sm text-gray-500">Nog geen kaarten gedistilleerd.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: `✓ Compiled successfully`; routes `/admin/kennis` en `/admin/kennis/[sourceId]` in de output.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/kennis/page.tsx" "app/(admin)/admin/kennis/[sourceId]/page.tsx" "app/(admin)/layout.tsx"
git commit -m "feat(kennis): admin-UI met bronnen-lijst, goedkeur-wachtrij en nav"
```

---

## Task 9: End-to-end-verificatie

**Files:** geen (verificatie).

- [ ] **Step 1: Volledige testsuite**

Run: `pnpm test`
Expected: alle tests groen, inclusief de nieuwe (schema, extract, distill, service).

- [ ] **Step 2: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Extractie-rooktest op het echte boek**

Maak tijdelijk `_verify-epub.ts` in de projectroot:

```ts
import { readFileSync } from "node:fs";
import { extractBook } from "./lib/knowledge/extract";
const buf = readFileSync(process.argv[2]);
extractBook(buf, "epub").then((b) => {
  console.log("titel:", b.title, "| auteur:", b.author, "| taal:", b.language);
  console.log("hoofdstukken:", b.chapters.length);
});
```

Run: `pnpm exec tsx _verify-epub.ts "/Users/olivierarnolds/Downloads/_OceanofPDF.com_Invloed_Dutch_Edition_-_Robert_Cialdini.epub"; rm -f _verify-epub.ts`
Expected: titel/auteur/taal herkend en een plausibel aantal hoofdstukken (≥ 8).

- [ ] **Step 4: Push**

```bash
git push origin main
```

## Handmatige eindtest (na deploy, door Olivier)

Ga naar `/admin/kennis`, upload het Cialdini-EPUB, en volg de distillatie-voortgang. Controleer of concept-kaarten verschijnen, keur er een paar goed, bewerk er één, en verwijder er één. Bij een groot boek dat de 300s niet haalt: klik "Ga door" om te hervatten.

## Bekende beperkingen (uit de spec)

- Distillatiekwaliteit varieert → menselijke goedkeuring is verplicht (elke kaart start als `concept`).
- PDF-hoofdstukdetectie is heuristisch; EPUB (met spine) is betrouwbaarder.
- Zeer lange hoofdstukken worden op woordgrens verder gesplitst door `splitIntoChapters` (PDF-pad); EPUB volgt de spine 1-op-1.
- **Afwijking t.o.v. spec (bewuste follow-up):** de spec noemde dat de admin auteur/taal achteraf kan corrigeren in het bron-scherm. Dat inline-bewerken van bron-metadata zit niet in dit plan (v1 leunt op auto-detectie, die bij EPUB betrouwbaar is via de opf-metadata). Taal beïnvloedt de output niet (de distillatie schrijft sowieso Nederlands); auteur voedt alleen de bronvermelding. Een klein bewerk-formulier op de bron-pagina is een makkelijke vervolgstap als de auto-detectie in de praktijk mist. Voor PDF is `language` `null` (geen LLM-taaldetectie in v1) — de distillatie-prompt gaat dan uit van "anderstalig (onbekend)" en levert alsnog Nederlandse kaarten.
