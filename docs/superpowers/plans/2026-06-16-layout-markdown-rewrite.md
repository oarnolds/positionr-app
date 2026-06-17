# Layout-editor wordt markdown-template + runtime herschrijft — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de WYSIWYG layout-editor door één markdown-document per
module. Runtime laat AI dat document gevuld terugleveren; renderer toont het
1-op-1.

**Architecture:** `modules.format_example` (DB text-kolom) is de bron. Admin
bewerkt 'm via split-pane (textarea + live MarkdownBlock-preview). Runtime
voegt 'm aan de AI-prompt toe, krijgt raw markdown terug, slaat op in
`sessions.output` (text). Renderer = `<MarkdownBlock>`.

**Tech Stack:** Next.js 15 (App Router, server-actions), Drizzle ORM,
Supabase (Postgres), Anthropic SDK, `marked`, Tailwind. Migrations applied
via Supabase MCP (`mcp__572a4bf1-21cb-4e93-8c29-d9d4736f2f08__apply_migration`,
project_id `nirlmczamjrcxciyzkpy`).

**Spec:** [docs/superpowers/specs/2026-06-16-layout-markdown-rewrite-design.md](../specs/2026-06-16-layout-markdown-rewrite-design.md)

---

## Bestandsplan

**Nieuw:**
- `drizzle/0012_modules_format_example.sql` — additive migration (column).
- `drizzle/0013_sessions_output_text.sql` — change `sessions.output` type.
- `drizzle/0014_drop_layout_config.sql` — cleanup migration.
- `scripts/seed-format-example.ts` — load website-check markdown uit file naar DB.
- `lib/ai/claude-raw.ts` — `analyzeClaudeRaw()` zonder JSON-parsing/Zod.
- `app/(admin)/admin/layouts/page.tsx` — vervangen door modules-grid.
- `app/(admin)/admin/layouts/[slug]/page.tsx` — vervangen door editor.
- `app/(admin)/admin/layouts/[slug]/layout-editor.tsx` — nieuwe split-pane editor (vervangt huidige).
- `app/(admin)/admin/layouts/[slug]/actions.ts` — `saveFormatExample`-server-action.

**Gewijzigd:**
- `lib/db/schema.ts` — add `formatExample`, change `output` to text, drop `layoutConfig` + `moduleLayoutHistory`.
- `lib/modules/format-examples.ts` + `.test.ts` — DB i.p.v. fs.
- `modules/website-check/service.ts` + `.test.ts` — produce markdown.
- `modules/website-check/freeCheck.ts` + `.test.ts` — idem voor gratis-check.
- `modules/website-check/components/WebsiteCheckResultView.tsx` — thin `<MarkdownBlock>` wrapper.
- `app/(app)/modules/website-check/[sessionId]/page.tsx` — pass markdown string.
- `app/(marketing)/gratis-check/[id]/page.tsx` — idem.
- `app/r/[shareSlug]/page.tsx` — idem.

**Verwijderd (Task 6):**
- `app/(admin)/admin/layouts/[slug]/{layout-canvas,inline-section,inline-block,insert-strip,mode-toggle,format-example-drawer,version-history,sidebar}.tsx`
- `modules/website-check/{sections.tsx, sections-meta.ts, schema.ts, preview-fixture.ts}` (schema input-deel verhuist eventueel naar service.ts)
- `lib/modules/{layout.ts, layouts.ts, layout-actions.ts, layouts.test.ts, layout-actions.test.ts, preview-data.ts}`
- `modules/website-check/format-example.md` — vervangen door DB-seed.

---

## Task 1: DB-migratie `format_example` + schema.ts + seed

**Files:**
- Create: `drizzle/0012_modules_format_example.sql`
- Create: `scripts/seed-format-example.ts`
- Modify: `lib/db/schema.ts` (regel 67-79, voeg `formatExample` toe)

Voorwaarden: het MCP-tool `mcp__572a4bf1-21cb-4e93-8c29-d9d4736f2f08__apply_migration`
is bereikbaar; project_id = `nirlmczamjrcxciyzkpy`.

- [ ] **Step 1: Maak het SQL-migration bestand**

Schrijf `drizzle/0012_modules_format_example.sql`:

```sql
-- Voegt format-template per module toe. Dit is de markdown-blueprint die de
-- runtime aan de AI doorgeeft als doel-format en die de admin bewerkt via
-- /admin/layouts/[slug].
ALTER TABLE modules
  ADD COLUMN format_example text;
```

- [ ] **Step 2: Pas de migration toe op Supabase**

Roep `mcp__572a4bf1-21cb-4e93-8c29-d9d4736f2f08__apply_migration` aan met:
- `project_id`: `nirlmczamjrcxciyzkpy`
- `name`: `modules_format_example`
- `query`: de SQL hierboven (alleen het ALTER TABLE statement, zonder
  comment-headers).

Verwacht: success, geen errors.

- [ ] **Step 3: Update `lib/db/schema.ts`**

Voeg toe binnen de `modules`-tabel-definitie, ná `layoutConfig`:

```ts
formatExample: text("format_example"),
```

- [ ] **Step 4: Schrijf het seed-script**

Maak `scripts/seed-format-example.ts`:

```ts
/**
 * Seed-script voor één module's format_example.
 * Voorbeeld: pnpm tsx scripts/seed-format-example.ts website-check
 * Leest modules/<slug>/format-example.md en schrijft naar
 * modules.format_example in de DB.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";

async function main() {
  const slug = process.argv[2];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    console.error("Gebruik: pnpm tsx scripts/seed-format-example.ts <slug>");
    process.exit(1);
  }
  const path = join(process.cwd(), "modules", slug, "format-example.md");
  const markdown = await readFile(path, "utf8");
  const result = await db
    .update(modules)
    .set({ formatExample: markdown })
    .where(eq(modules.slug, slug))
    .returning({ slug: modules.slug });
  if (result.length === 0) {
    console.error(`Geen module-rij gevonden voor slug=${slug}`);
    process.exit(1);
  }
  console.log(`Seeded format_example voor ${slug} (${markdown.length} chars)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run het seed-script voor website-check**

```
pnpm tsx scripts/seed-format-example.ts website-check
```

Expected: `Seeded format_example voor website-check (XXXX chars)`.

- [ ] **Step 6: Verifieer in DB**

Roep `mcp__572a4bf1-21cb-4e93-8c29-d9d4736f2f08__execute_sql` aan met:
- `project_id`: `nirlmczamjrcxciyzkpy`
- `query`: `SELECT slug, LENGTH(format_example) AS chars FROM modules WHERE slug = 'website-check';`

Expected: één rij, `chars` > 5000.

- [ ] **Step 7: Typecheck + tests**

```
pnpm tsc --noEmit
pnpm vitest run
```

Expected: PASS — additive change, geen consumers gewijzigd.

- [ ] **Step 8: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  drizzle/0012_modules_format_example.sql \
  scripts/seed-format-example.ts \
  lib/db/schema.ts
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(db): modules.format_example kolom + seed-script

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: `getFormatExample` leest uit DB + `saveFormatExample` server-action

**Files:**
- Modify: `lib/modules/format-examples.ts`
- Modify: `lib/modules/format-examples.test.ts`

De helper leest nu uit `modules.format_example` (DB) i.p.v. een file. Daarnaast
komt er een nieuwe server-action voor save vanuit de admin.

- [ ] **Step 1: Update tests eerst (TDD)**

Vervang de inhoud van `lib/modules/format-examples.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => {
  const where = vi.fn();
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
  return {
    db: {
      select,
      _mocks: { where },
    },
  };
});

import { db } from "@/lib/db/client";
import { getFormatExample } from "./format-examples";

const mocks = (db as unknown as { _mocks: { where: ReturnType<typeof vi.fn> } })._mocks;

describe("getFormatExample", () => {
  beforeEach(() => {
    mocks.where.mockReset();
  });

  it("returnt de markdown voor een module die een format_example heeft", async () => {
    mocks.where.mockResolvedValueOnce([{ formatExample: "# Test\n\nMarkdown body" }]);
    const md = await getFormatExample("website-check");
    expect(md).toBe("# Test\n\nMarkdown body");
  });

  it("returnt null als de module geen format_example heeft", async () => {
    mocks.where.mockResolvedValueOnce([{ formatExample: null }]);
    const md = await getFormatExample("zzz");
    expect(md).toBeNull();
  });

  it("returnt null als de module niet bestaat", async () => {
    mocks.where.mockResolvedValueOnce([]);
    const md = await getFormatExample("niet-bestaand");
    expect(md).toBeNull();
  });

  it("returnt null voor slugs die niet aan [a-z0-9-]+ voldoen", async () => {
    expect(await getFormatExample("../etc/passwd")).toBeNull();
    expect(await getFormatExample("UPPERCASE")).toBeNull();
    expect(await getFormatExample("met spatie")).toBeNull();
    expect(await getFormatExample("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests om falen te bevestigen**

```
pnpm vitest run lib/modules/format-examples.test.ts
```

Expected: FAIL — oude file-based implementatie returnt null voor de
mock-rows; mocks niet aangeroepen.

- [ ] **Step 3: Vervang `lib/modules/format-examples.ts`**

Volledige nieuwe inhoud:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Leest het format-template (markdown) voor een module uit de DB.
 * Returnt null als de slug ongeldig is, de module niet bestaat, of
 * `format_example` op die rij null is.
 */
export async function getFormatExample(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) return null;
  const rows = await db
    .select({ formatExample: modules.formatExample })
    .from(modules)
    .where(eq(modules.slug, slug));
  if (rows.length === 0) return null;
  return rows[0].formatExample ?? null;
}
```

- [ ] **Step 4: Run tests groen**

```
pnpm vitest run lib/modules/format-examples.test.ts
```

Expected: PASS — alle 6 cases groen.

- [ ] **Step 5: Volledige test-suite**

```
pnpm vitest run
```

Expected: PASS — totaal 89 tests of meer. Bestaande tests die de oude
file-based helper indirect raakten zijn weg.

- [ ] **Step 6: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  lib/modules/format-examples.ts \
  lib/modules/format-examples.test.ts
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "refactor(modules): getFormatExample leest uit DB i.p.v. file

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Runtime-cutover — markdown-output door de hele pijp

Dit is de grootste task. We voeren alle wijzigingen die met de output-shape te
maken hebben in één commit door, anders breekt de build tussendoor.

**Files:**
- Create: `lib/ai/claude-raw.ts`
- Migration: `drizzle/0013_sessions_output_text.sql`
- Modify: `lib/db/schema.ts` (output: jsonb → text)
- Modify: `modules/website-check/service.ts` + `.test.ts`
- Modify: `modules/website-check/freeCheck.ts` + `.test.ts`
- Modify: `modules/website-check/components/WebsiteCheckResultView.tsx`
- Modify: `app/(app)/modules/website-check/[sessionId]/page.tsx`
- Modify: `app/(marketing)/gratis-check/[id]/page.tsx`
- Modify: `app/r/[shareSlug]/page.tsx`

- [ ] **Step 1: Maak `lib/ai/claude-raw.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { calculateCostCents, PRICING } from "./pricing";

const MAX_TOKENS = 8000;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt of is ongeldig in .env.local");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export type ClaudeRawResult = {
  markdown: string;
  promptUsed: string;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
};

/**
 * Single-message Claude call die raw text retourneert.
 * Geen JSON-parse, geen Zod-schema. Bedoeld voor template-driven modules
 * waar de AI markdown-output produceert.
 */
export async function analyzeClaudeRaw(args: {
  prompt: string;
}): Promise<ClaudeRawResult> {
  const response = await getClient().messages.create({
    model: PRICING.claude.model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: args.prompt }],
  });

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";

  if (!text.trim()) {
    throw new Error("Claude retourneerde lege output");
  }

  const inputTokens = response.usage.input_tokens ?? 0;
  const outputTokens = response.usage.output_tokens ?? 0;

  return {
    markdown: text.trim(),
    promptUsed: args.prompt,
    llmModel: PRICING.claude.model,
    llmInputTokens: inputTokens,
    llmOutputTokens: outputTokens,
    llmCostCents: calculateCostCents("claude", inputTokens, outputTokens),
  };
}
```

- [ ] **Step 2: Maak migration `drizzle/0013_sessions_output_text.sql`**

```sql
-- sessions.output van jsonb naar text. Pre-launch, bestaande output-data
-- wordt vernietigd (geen klant-data).
ALTER TABLE sessions DROP COLUMN output;
ALTER TABLE sessions ADD COLUMN output text;
```

- [ ] **Step 3: Pas migration toe**

Via `mcp__572a4bf1-21cb-4e93-8c29-d9d4736f2f08__apply_migration`:
- `project_id`: `nirlmczamjrcxciyzkpy`
- `name`: `sessions_output_text`
- `query`: de SQL hierboven (zonder comment-headers).

- [ ] **Step 4: Update `lib/db/schema.ts`**

Vervang in de `sessions`-definitie:

```ts
  output: jsonb("output"),
```

door:

```ts
  output: text("output"),
```

- [ ] **Step 5: Herschrijf `modules/website-check/service.ts`**

Volledige nieuwe inhoud:

```ts
import { randomBytes } from "node:crypto";
import { analyzeClaudeRaw, type ClaudeRawResult } from "@/lib/ai/claude-raw";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { globalPlaceholders } from "@/lib/modules/global-placeholders";
import { getFormatExample } from "@/lib/modules/format-examples";
import { scrapeWebsite } from "./scraper";
import { MODULE_SLUG } from "./index";

export type ServiceDeps = {
  scrape: (url: string) => Promise<string>;
  fetchPrompt: typeof getModulePrompt;
  fetchFormatExample: typeof getFormatExample;
  analyze: (args: { prompt: string }) => Promise<ClaudeRawResult>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
}

export const defaultDeps: ServiceDeps = {
  scrape: scrapeWebsite,
  fetchPrompt: getModulePrompt,
  fetchFormatExample: getFormatExample,
  analyze: analyzeClaudeRaw,
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
    const scraped = await deps.scrape(args.websiteUrl);
    const { prompt: template } = await deps.fetchPrompt(MODULE_SLUG);
    const formatTemplate = await deps.fetchFormatExample(MODULE_SLUG);
    if (!formatTemplate) {
      throw new Error("Geen format-template voor website-check gevonden in DB");
    }

    const promptHeader = substitutePlaceholders(template, {
      ...globalPlaceholders(),
      websiteUrl: args.websiteUrl,
      companyName: args.companyName || "Onbekend",
      scrapedContent: scraped || "(Kon website niet laden)",
    });

    const prompt = `${promptHeader}\n\n---\nFORMAT-TEMPLATE (volg deze structuur exact, vervang placeholders door inhoud op basis van de geschraapte data; behoud markdown-structuur, koppen en tabellen):\n\n${formatTemplate}\n\n---\nSchrijf nu de gevulde versie van bovenstaand format. Geef alleen de markdown terug, geen JSON, geen uitleg eromheen.`;

    const result = await deps.analyze({ prompt });

    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: result.markdown,
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

- [ ] **Step 6: Update `modules/website-check/service.test.ts`**

Lees eerst de huidige inhoud van `modules/website-check/service.test.ts`.
Vervang alle Zod-`schema` referenties + `result.data`-asserts door
`{ markdown }`. De DI-shape verandert: `analyze` accepteert nu
`{ prompt: string }` en retourneert `{ markdown, promptUsed, llmModel, llmInputTokens, llmOutputTokens, llmCostCents }`. Voeg in de
test-fixtures een mock voor `fetchFormatExample` toe die de markdown-template
teruggeeft.

Concreet, voor elke `runAnalysis`-test:

```ts
const deps: ServiceDeps = {
  scrape: vi.fn().mockResolvedValue("scraped content"),
  fetchPrompt: vi.fn().mockResolvedValue({
    prompt: "Analyseer {websiteUrl}: {scrapedContent}",
    provider: "claude" as const,
  }),
  fetchFormatExample: vi.fn().mockResolvedValue("# Voorbeeld\n\n[KLANTNAAM]"),
  analyze: vi.fn().mockResolvedValue({
    markdown: "# Resultaat\n\nVolledige analyse hier",
    promptUsed: "...",
    llmModel: "claude-sonnet-4-6",
    llmInputTokens: 100,
    llmOutputTokens: 50,
    llmCostCents: 1,
  }),
  updateSession: vi.fn().mockResolvedValue(undefined),
};

await runAnalysis({ sessionId: "s1", websiteUrl: "https://x", companyName: "X" }, deps);

expect(deps.updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({
  status: "approved",
  output: "# Resultaat\n\nVolledige analyse hier",
}));
```

Verwijder eventuele `WebsiteCheckOutputSchema`-imports en alles wat met
`expect(result.data.overallScore)` of vergelijkbaar te maken heeft.

- [ ] **Step 7: Herschrijf `modules/website-check/components/WebsiteCheckResultView.tsx`**

Volledige nieuwe inhoud:

```tsx
import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

/**
 * Toont het resultaat van een Website Check sessie als gerenderde markdown.
 * De AI heeft de template (modules.format_example) gevuld; wij renderen 1-op-1.
 */
export function WebsiteCheckResultView({
  markdown,
}: {
  markdown: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <MarkdownBlock markdown={markdown} />
    </div>
  );
}
```

- [ ] **Step 8: Update `app/(app)/modules/website-check/[sessionId]/page.tsx`**

Lees eerst het bestand. Verwijder de `layout`-prop + `getModuleLayout`-call.
Verander de `<WebsiteCheckResultView>`-call zodat 'ie alleen `markdown` krijgt.

Concreet: het ophalen van `session.output` levert nu een string (of null). Geef
het door als:

```tsx
<WebsiteCheckResultView markdown={session.output ?? ""} />
```

Verwijder de `getModuleLayout`/`getPreviewData`-imports en aanroepen die deze
pagina nog kent.

- [ ] **Step 9: Update `app/(marketing)/gratis-check/[id]/page.tsx`**

Idem: `<WebsiteCheckResultView markdown={lead.result ?? ""} />` of wat de
lokale shape ook is. Verwijder `layout`-prop. (Let op: gratis-check leest uit
`leads.result` — die kolom is jsonb gebleven en bevat nu nog de oude
JSON-shape. Update mee in de freeCheck-service om hier ook markdown te
schrijven; zie Step 11.)

- [ ] **Step 10: Update `app/r/[shareSlug]/page.tsx`**

Idem: `<WebsiteCheckResultView markdown={session.output ?? ""} />`. Verwijder
layout-call.

- [ ] **Step 11: Herschrijf `modules/website-check/freeCheck.ts`**

Lees het bestand. Pas dezelfde markdown-flow toe als in `service.ts`: gebruik
`getFormatExample` + `analyzeClaudeRaw`. Schrijf markdown (text) i.p.v.
JSON-blob naar `leads.result`.

`leads.result` blijft jsonb in DB. Schrijf als `{ markdown: "..." }`-object —
één veld is genoeg, geen kolomwijziging nodig. Reader (Step 9) leest dan
`lead.result?.markdown ?? ""`.

Update `freeCheck.test.ts` analoog aan Step 6.

- [ ] **Step 12: Schrap `WebsiteCheckOutputSchema` referenties**

`grep -rn "WebsiteCheckOutputSchema\|WebsiteCheckOutput" app/ modules/ lib/ components/`
zou alleen nog hits geven in `modules/website-check/schema.ts` (de definitie
zelf) en `modules/website-check/schema.test.ts`. Verwijder beide files in
deze stap NIET — Task 6 cleanup. Wel: zorg dat geen ander bestand 'm nog
importeert.

- [ ] **Step 13: Typecheck + tests**

```
pnpm tsc --noEmit
pnpm vitest run
```

Expected: PASS. Sommige tests (schema, sections) gaan in Task 6 weg; deze
moeten nu nog groen blijven.

- [ ] **Step 14: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  drizzle/0013_sessions_output_text.sql \
  lib/ai/claude-raw.ts \
  lib/db/schema.ts \
  modules/website-check/service.ts \
  modules/website-check/service.test.ts \
  modules/website-check/freeCheck.ts \
  modules/website-check/freeCheck.test.ts \
  modules/website-check/components/WebsiteCheckResultView.tsx \
  "app/(app)/modules/website-check/[sessionId]/page.tsx" \
  "app/(marketing)/gratis-check/[id]/page.tsx" \
  "app/r/[shareSlug]/page.tsx"
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(runtime): website-check produceert markdown via format-template

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Nieuwe `/admin/layouts` modules-grid

**Files:**
- Replace: `app/(admin)/admin/layouts/page.tsx`

De huidige page redirect naar de eerste actieve module. Vervang door een
grid van kaarten voor alle modules uit de registry.

- [ ] **Step 1: Vervang de inhoud van `app/(admin)/admin/layouts/page.tsx`**

```tsx
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";
import { MODULES } from "@/lib/modules/registry";

// Alle modules uit de registry, gegroepeerd per pakket. Alleen top-level
// (geen sub-prompts), in registry-volgorde.
const TOP_LEVEL = MODULES.filter((m) => !m.parentSlug);

export default async function LayoutsIndexPage() {
  // Welke modules hebben format_example gezet?
  const rows = await db
    .select({ slug: modules.slug, hasExample: modules.formatExample })
    .from(modules)
    .where(inArray(modules.slug, TOP_LEVEL.map((m) => m.slug)));

  const filled = new Set(
    rows.filter((r) => r.hasExample !== null).map((r) => r.slug),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-bold">Layouts</h1>
        <p className="text-sm text-slate-600">
          Markdown-template per module. Bewerk wat de AI moet produceren.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOP_LEVEL.map((m) => {
          const has = filled.has(m.slug);
          return (
            <Link
              key={m.slug}
              href={`/admin/layouts/${m.slug}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-purple-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-900">{m.name}</div>
                {has ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    ingevuld
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    leeg
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">{m.slug}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                {m.minTier}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke-test**

```
pnpm dev
```

Open `http://localhost:3000/admin/layouts` (login als admin). Verwacht:
grid met alle 14 top-level modules (Fundament+Groei+Strategie, geen
sub-prompts). Website-check heeft een groene "ingevuld"-badge; de rest
"leeg".

- [ ] **Step 3: Typecheck + tests**

```
pnpm tsc --noEmit
pnpm vitest run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add "app/(admin)/admin/layouts/page.tsx"
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(admin): modules-grid voor layouts (alle 14 top-level modules)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Nieuwe split-pane editor `/admin/layouts/[slug]`

**Files:**
- Replace: `app/(admin)/admin/layouts/[slug]/page.tsx`
- Replace: `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`
- Create: `app/(admin)/admin/layouts/[slug]/actions.ts`

De huidige page laadt de oude WYSIWYG. Vervang door een markdown-editor met
live preview.

- [ ] **Step 1: Maak de server-action `actions.ts`**

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { modules, profiles } from "@/lib/db/schema";

const SLUG_RE = /^[a-z0-9-]+$/;

async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd");
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (profile?.role !== "admin") throw new Error("Geen admin-rechten");
}

export async function saveFormatExample(slug: string, markdown: string): Promise<void> {
  if (!SLUG_RE.test(slug)) throw new Error("Ongeldige slug");
  await requireAdmin();
  await db
    .update(modules)
    .set({ formatExample: markdown.length === 0 ? null : markdown })
    .where(eq(modules.slug, slug));
  revalidatePath(`/admin/layouts/${slug}`);
}
```

- [ ] **Step 2: Vervang `app/(admin)/admin/layouts/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { MODULES } from "@/lib/modules/registry";
import { getFormatExample } from "@/lib/modules/format-examples";
import { LayoutEditor } from "./layout-editor";

export default async function LayoutEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const moduleMeta = MODULES.find((m) => m.slug === slug && !m.parentSlug);
  if (!moduleMeta) notFound();

  const initialMarkdown = (await getFormatExample(slug)) ?? "";

  return (
    <div className="mx-auto max-w-7xl">
      <LayoutEditor
        slug={slug}
        moduleName={moduleMeta.name}
        initialMarkdown={initialMarkdown}
      />
    </div>
  );
}
```

- [ ] **Step 3: Vervang `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`**

```tsx
"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";
import { saveFormatExample } from "./actions";

export function LayoutEditor({
  slug,
  moduleName,
  initialMarkdown,
}: {
  slug: string;
  moduleName: string;
  initialMarkdown: string;
}) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [isPending, startTransition] = useTransition();
  const baselineRef = useRef(initialMarkdown);
  const dirty = markdown !== baselineRef.current;

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function handleSave() {
    startTransition(async () => {
      await saveFormatExample(slug, markdown);
      baselineRef.current = markdown;
      router.refresh();
    });
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/layouts"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Modules
          </Link>
          <h1 className="text-xl font-bold">Layout — {moduleName}</h1>
          {dirty && (
            <span className="text-xs text-amber-700">● niet-opgeslagen</span>
          )}
        </div>
        <button
          type="button"
          disabled={!dirty || isPending}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Opslaan
        </button>
      </header>

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden">
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Markdown
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Begin met je format-voorbeeld…"
            className="flex-1 resize-none p-3 font-mono text-xs leading-relaxed text-slate-900 focus:outline-none"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <MarkdownBlock markdown={markdown} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Smoke-test**

```
pnpm dev
```

`/admin/layouts/website-check` → split-pane verschijnt, links de markdown
van het format-voorbeeld, rechts de gerenderde versie. Wijzig iets links →
preview update direct. Klik **Opslaan** → herlaad pagina → wijziging staat
er nog.

`/admin/layouts/linkedin-analyse` → lege textarea (geen format_example).
Type iets, opslaan, herlaad → blijft staan.

- [ ] **Step 5: Typecheck + tests**

```
pnpm tsc --noEmit
pnpm vitest run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add \
  "app/(admin)/admin/layouts/[slug]/page.tsx" \
  "app/(admin)/admin/layouts/[slug]/layout-editor.tsx" \
  "app/(admin)/admin/layouts/[slug]/actions.ts"
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "feat(admin): split-pane markdown-editor voor module-layouts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Cleanup — oude WYSIWYG-spullen verwijderen

**Files:**
- Migration: `drizzle/0014_drop_layout_config.sql`
- Modify: `lib/db/schema.ts`
- Delete: 16 bestanden (zie lijst hieronder)

- [ ] **Step 1: Schrijf cleanup-migration `drizzle/0014_drop_layout_config.sql`**

```sql
-- Verwijdert het oude config-driven layout-systeem (WYSIWYG).
DROP TABLE IF EXISTS module_layout_history;
ALTER TABLE modules DROP COLUMN IF EXISTS layout_config;
```

- [ ] **Step 2: Pas migration toe**

Via `mcp__572a4bf1-21cb-4e93-8c29-d9d4736f2f08__apply_migration`:
- `project_id`: `nirlmczamjrcxciyzkpy`
- `name`: `drop_layout_config`
- `query`: de SQL zonder comment.

- [ ] **Step 3: Update `lib/db/schema.ts`**

Verwijder uit het `modules`-blok:

```ts
  layoutConfig: jsonb("layout_config"),
```

Verwijder het hele `moduleLayoutHistory`-tabel-blok (regel ~169-182) en de
bijbehorende type-exports (regel ~235-236):

```ts
export type ModuleLayoutHistory = typeof moduleLayoutHistory.$inferSelect;
export type NewModuleLayoutHistory = typeof moduleLayoutHistory.$inferInsert;
```

- [ ] **Step 4: Verwijder dode bestanden**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app

rm "app/(admin)/admin/layouts/[slug]/layout-canvas.tsx"
rm "app/(admin)/admin/layouts/[slug]/inline-section.tsx"
rm "app/(admin)/admin/layouts/[slug]/inline-block.tsx"
rm "app/(admin)/admin/layouts/[slug]/insert-strip.tsx"
rm "app/(admin)/admin/layouts/[slug]/mode-toggle.tsx"
rm "app/(admin)/admin/layouts/[slug]/format-example-drawer.tsx"
rm "app/(admin)/admin/layouts/[slug]/version-history.tsx"
rm "app/(admin)/admin/layouts/[slug]/sidebar.tsx" 2>/dev/null || true
rm "app/(admin)/admin/layouts/sidebar.tsx" 2>/dev/null || true

rm modules/website-check/sections.tsx
rm modules/website-check/sections-meta.ts
rm modules/website-check/schema.ts
rm modules/website-check/schema.test.ts
rm modules/website-check/preview-fixture.ts
rm modules/website-check/format-example.md

rm lib/modules/layout.ts
rm lib/modules/layouts.ts
rm lib/modules/layouts.test.ts
rm lib/modules/layout-actions.ts
rm lib/modules/layout-actions.test.ts
rm lib/modules/preview-data.ts
```

- [ ] **Step 5: Typecheck — moet schoon zijn na verwijderen**

```
pnpm tsc --noEmit
```

Expected: PASS. Als hier errors zijn, betekent het dat er nog imports naar
verwijderde files staan. Update consumers tot 't groen is.

- [ ] **Step 6: Volledige test-suite**

```
pnpm vitest run
```

Expected: PASS. Het aantal tests is lager dan voor de cleanup (we hebben
de schema.test.ts en de layout-related tests verwijderd).

- [ ] **Step 7: Smoke-test in browser — end-to-end**

```
pnpm dev
```

Doorloop:
1. `/admin/layouts` → modules-grid.
2. `/admin/layouts/website-check` → split-pane editor, save werkt.
3. Start een echte analyse: `/modules/website-check` → vul URL in → submit.
4. Wacht tot status `approved` → result-pagina toont gerenderde markdown
   (niet de oude sections-cards).
5. Open de share-link → idem.

- [ ] **Step 8: Commit cleanup**

```bash
git -C /Users/olivierarnolds/Desktop/positionr-app add -A
git -C /Users/olivierarnolds/Desktop/positionr-app commit -m "chore: verwijder WYSIWYG layout-systeem (DB + code)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
