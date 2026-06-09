# Module Layout — PR-L1: Data-laag + ResultView-refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leg het fundament voor admin-bewerkbare result-view-layouts en refactor `WebsiteCheckResultView` naar een config-driven render. Geen admin-UI in deze PR — dat is PR-L2.

**Architecture:** Zod-schema voor `LayoutConfig` met discriminated union (`section` | `block`). DB-laag: `modules.layout_config jsonb` + `module_layout_history`-tabel met version-history (zelfde patroon als prompts). Runtime: `getModuleLayout(slug)` haalt de config op met code-fallback (`defaultLayoutFor(slug)`) uit een per-module SECTIONS-registry. `WebsiteCheckResultView` wordt opgesplitst in 7 kleine section-componenten en rendert in volgorde van `config.items`.

**Tech Stack:** Next.js 15, Drizzle ORM, Zod, vitest. Geen nieuwe runtime-deps in deze PR.

**Scope-grens:** geen admin-UI (PR-L2), geen ICP-refactor (PR-L3, aparte spec), geen visuele-stijl-customization. Default-config produceert een minieme visuele delta (zie Task 5): sterke-punten + verbeterpunten worden gestapeld i.p.v. side-by-side, en de Samenvatting verhuist uit de hero naar een eigen kaart eronder. Bewust geaccepteerd voor de gewenste flexibiliteit.

**Bestandsstructuur:**

```
lib/modules/
  layout.ts                  ← NIEUW (Zod-schema: LayoutItem, LayoutConfig)
  layout.test.ts             ← NIEUW
  layouts.ts                 ← NIEUW (getModuleLayout, defaultLayoutFor, SECTIONS_BY_SLUG)
  layouts.test.ts            ← NIEUW
  MarkdownBlock.tsx          ← NIEUW (shared component voor vrije blokken)
modules/website-check/
  sections.tsx               ← NIEUW (7 section-componenten + SECTIONS-export)
  components/
    WebsiteCheckResultView.tsx  ← AANPASSEN (config-driven loop)
lib/db/schema.ts             ← AANPASSEN (layout_config + module_layout_history)
drizzle/0007_module_layout_history_rls.sql  ← NIEUW
app/
  (app)/modules/website-check/[sessionId]/page.tsx  ← AANPASSEN (fetch + pass config)
  (marketing)/gratis-check/[id]/page.tsx            ← AANPASSEN (idem)
```

---

### Task 1: DB-schema — `layout_config` op modules + `module_layout_history`-tabel

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/0007_module_layout_history_rls.sql`

- [ ] **Step 1: Voeg `layoutConfig` toe aan modules-tabel**

In `lib/db/schema.ts`, in de `modules`-tabel-definitie, na `minTier`:

```ts
  layoutConfig: jsonb("layout_config"), // null = gebruik default uit registry
```

- [ ] **Step 2: Voeg `moduleLayoutHistory`-tabel + types toe**

Onderaan `lib/db/schema.ts`, naast `modulePromptHistory`:

```ts
// ── Module Layout History ───────────────────────────────────────────
// Snapshot van elke save/reset/restore-actie op modules.layoutConfig.

export const moduleLayoutHistory = pgTable("module_layout_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleSlug: text("module_slug")
    .notNull()
    .references(() => modules.slug, { onDelete: "cascade" }),
  layoutConfig: jsonb("layout_config").notNull(),
  savedBy: uuid("saved_by").notNull(), // = auth.users.id (admin)
  savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
});
```

En bij de `// ── Types ──`-sectie:

```ts
export type ModuleLayoutHistory = typeof moduleLayoutHistory.$inferSelect;
export type NewModuleLayoutHistory = typeof moduleLayoutHistory.$inferInsert;
```

- [ ] **Step 3: Verifieer typecheck**

Run: `cd /Users/olivierarnolds/positionr-website && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Push schema naar Supabase**

Run: `cd /Users/olivierarnolds/positionr-website && pnpm db:push`
Expected: drizzle stelt voor toe te voegen: kolom `modules.layout_config` (nullable jsonb) + tabel `module_layout_history` (5 kolommen). Bevestig met `y`.

- [ ] **Step 5: Maak het RLS-bestand**

Maak `drizzle/0007_module_layout_history_rls.sql`:

```sql
-- Row Level Security voor module_layout_history.
-- Volgt het patroon van module_prompt_history.
-- Run dit ná `pnpm db:push` in de Supabase SQL editor.

alter table module_layout_history enable row level security;

create policy "module_layout_history admin all"
  on module_layout_history for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
```

- [ ] **Step 6: Pas RLS toe op Supabase (via inline script)**

```bash
cat > /Users/olivierarnolds/positionr-website/.apply-layout-rls.mjs <<'EOF'
import postgres from "postgres";
import { config } from "dotenv";
config({ path: "/Users/olivierarnolds/positionr-website/.env.local" });
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
try {
  await sql.unsafe(`
    alter table module_layout_history enable row level security;
    create policy "module_layout_history admin all"
      on module_layout_history for all
      using (exists (select 1 from profiles
                     where profiles.id = auth.uid() and profiles.role = 'admin'));
  `);
  const policies = await sql`
    select policyname from pg_policies
    where schemaname='public' and tablename='module_layout_history'`;
  console.log("Policies:", policies.map(r => r.policyname).join(", "));
} finally { await sql.end(); }
EOF
node /Users/olivierarnolds/positionr-website/.apply-layout-rls.mjs
rm -f /Users/olivierarnolds/positionr-website/.apply-layout-rls.mjs
```

Expected: "Policies: module_layout_history admin all".

- [ ] **Step 7: Commit**

```bash
cd /Users/olivierarnolds/positionr-website && git add lib/db/schema.ts drizzle/0007_module_layout_history_rls.sql
git commit -m "feat(db): modules.layout_config + module_layout_history (RLS)"
```

---

### Task 2: Zod-schema voor `LayoutConfig` (TDD)

**Files:**
- Create: `lib/modules/layout.ts`
- Test: `lib/modules/layout.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/modules/layout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { LayoutConfig } from "./layout";

describe("LayoutConfig", () => {
  it("accepteert een config met alleen section-items", () => {
    const ok = {
      version: 1,
      items: [
        { kind: "section", id: "score-banner", title: null, intro: null, visible: true },
      ],
    };
    expect(LayoutConfig.safeParse(ok).success).toBe(true);
  });

  it("accepteert een config met gemengde section + block-items", () => {
    const ok = {
      version: 1,
      items: [
        { kind: "section", id: "score-banner", title: "Score", intro: "Intro-tekst", visible: true },
        { kind: "block", id: "blk-1", markdown: "# Header\n\nTekst." },
        { kind: "section", id: "top-acties", title: null, intro: null, visible: false },
      ],
    };
    expect(LayoutConfig.safeParse(ok).success).toBe(true);
  });

  it("weigert een onbekend kind", () => {
    const bad = {
      version: 1,
      items: [{ kind: "header", id: "x" }],
    };
    expect(LayoutConfig.safeParse(bad).success).toBe(false);
  });

  it("weigert een section zonder visible-veld", () => {
    const bad = {
      version: 1,
      items: [{ kind: "section", id: "score-banner", title: null, intro: null }],
    };
    expect(LayoutConfig.safeParse(bad).success).toBe(false);
  });

  it("weigert version != 1", () => {
    const bad = { version: 2, items: [] };
    expect(LayoutConfig.safeParse(bad).success).toBe(false);
  });

  it("accepteert lege items-array (fallback in runtime)", () => {
    expect(LayoutConfig.safeParse({ version: 1, items: [] }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/olivierarnolds/positionr-website && pnpm test lib/modules/layout.test.ts`
Expected: FAIL — "Cannot find module './layout'".

- [ ] **Step 3: Write implementation**

Maak `lib/modules/layout.ts`:

```ts
import { z } from "zod";

/**
 * Eén item in de result-view-layout. Discriminated union:
 *  - "section" verwijst naar een vooraf gedefinieerde bouwblok uit de
 *    SECTIONS-registry van de module.
 *  - "block" is een vrij Markdown-blok, door admin geschreven.
 */
export const LayoutItem = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("section"),
    id: z.string(),                  // verwijst naar SECTIONS[i].id
    title: z.string().nullable(),    // null = gebruik default uit registry
    intro: z.string().nullable(),    // optionele inleidende tekst boven de sectie
    visible: z.boolean(),
  }),
  z.object({
    kind: z.literal("block"),
    id: z.string(),                  // uniek (crypto.randomUUID bij aanmaken)
    markdown: z.string(),
  }),
]);
export type LayoutItem = z.infer<typeof LayoutItem>;

export const LayoutConfig = z.object({
  version: z.literal(1),
  items: z.array(LayoutItem),
});
export type LayoutConfig = z.infer<typeof LayoutConfig>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/modules/layout.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/olivierarnolds/positionr-website && git add lib/modules/layout.ts lib/modules/layout.test.ts
git commit -m "feat(layout): Zod-schema LayoutConfig (section/block-items, version=1)"
```

---

### Task 3: `MarkdownBlock`-component

Shared component voor het renderen van vrije Markdown-blokken. Gebruikt `marked` (al in deps) → HTML → `dangerouslySetInnerHTML`. Admin is trusted; geen sanitization.

**Files:**
- Create: `lib/modules/MarkdownBlock.tsx`

- [ ] **Step 1: Maak het component**

Maak `lib/modules/MarkdownBlock.tsx`:

```tsx
import { marked } from "marked";

/**
 * Rendert een vrij Markdown-blok in de result-view.
 * `marked` produceert HTML — admin is vertrouwd, geen sanitization-laag.
 * Synchrone parse (marked.parse zonder async-flag).
 */
export function MarkdownBlock({ markdown }: { markdown: string }) {
  if (!markdown || !markdown.trim()) return null;
  const html = marked.parse(markdown, { async: false }) as string;
  return (
    <div
      className="prose prose-slate prose-sm max-w-none rounded-xl border border-slate-200 bg-slate-50/60 p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 2: Verifieer typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/modules/MarkdownBlock.tsx
git commit -m "feat(layout): MarkdownBlock-component voor vrije blokken"
```

---

### Task 4: SECTIONS-registry voor Website Check — decomposeer view in 7 componenten

Splits de huidige `WebsiteCheckResultView` op in 7 kleine section-componenten, elk in één bestand `modules/website-check/sections.tsx`. Geen runtime-wijziging in deze taak — de view gebruikt ze nog niet (Task 6 doet de hookup).

**Files:**
- Create: `modules/website-check/sections.tsx`

- [ ] **Step 1: Maak het registry-bestand**

Maak `modules/website-check/sections.tsx`:

```tsx
import type { ReactNode } from "react";
import type { WebsiteCheckOutput } from "./schema";
import { WEBSITE_CHECK_KNOWN_FIELDS } from "./schema";

// ── Section-type ───────────────────────────────────────────────────

export type SectionDef = {
  id: string;
  defaultTitle: string;
  description: string;          // voor admin-UI: korte omschrijving
  Component: (props: {
    data: WebsiteCheckOutput;
    title: string;
    intro: string | null;
  }) => ReactNode;
};

// ── Helpers (eerder in WebsiteCheckResultView) ─────────────────────

function scoreColor(score: number): {
  bg: string;
  text: string;
  bar: string;
} {
  if (score >= 7.5)
    return { bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (score >= 5)
    return { bg: "bg-amber-100", text: "text-amber-700", bar: "bg-amber-500" };
  return { bg: "bg-rose-100", text: "text-rose-700", bar: "bg-rose-500" };
}

function impactBadge(impact: "hoog" | "middel" | "laag") {
  const cls =
    impact === "hoog"
      ? "bg-purple-600 text-white"
      : impact === "middel"
        ? "bg-amber-500 text-white"
        : "bg-gray-300 text-gray-800";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${cls}`}>
      {impact}
    </span>
  );
}

function renderExtraValue(value: unknown): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }
  if (typeof value === "string") {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return (
      <ul className="list-disc pl-5 text-sm">
        {value.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    );
  }
  return (
    <pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function IntroP({ intro }: { intro: string | null }) {
  if (!intro) return null;
  return <p className="mt-2 text-sm text-gray-600">{intro}</p>;
}

// ── Section-componenten ────────────────────────────────────────────

function ScoreBanner({
  data,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-[7px] border-purple-600 text-purple-700">
        <div className="text-2xl font-extrabold leading-none">
          {data.overallScore.toFixed(1)}
        </div>
        <div className="text-[10px] text-purple-500">/ 10</div>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{data.companyName}</h1>
        <p className="text-gray-600">{data.websiteUrl}</p>
        <IntroP intro={intro} />
      </div>
    </div>
  );
}

function ExecutiveSummary({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <IntroP intro={intro} />
      <p className="mt-2 text-gray-800">{data.executiveSummary}</p>
    </section>
  );
}

function OnderdelenGrid({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">
        {title} ({data.onderdelen.length})
      </h2>
      <IntroP intro={intro} />
      <div className="space-y-2">
        {data.onderdelen.map((o, i) => {
          const c = scoreColor(o.score);
          return (
            <div key={i} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <strong>
                  {i + 1}. {o.naam}
                </strong>
                <span
                  className={`rounded-md px-2.5 py-0.5 text-sm font-extrabold ${c.bg} ${c.text}`}
                >
                  {o.score}/10
                </span>
              </div>
              <div className="my-2 h-1.5 w-full rounded bg-gray-200">
                <div
                  className={`h-1.5 rounded ${c.bar}`}
                  style={{ width: `${(o.score / 10) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-700">{o.toelichting}</p>
              {o.verbeterpunten.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">
                  {o.verbeterpunten.map((vp, j) => (
                    <li key={j}>{vp}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SterkePunten({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="font-bold text-emerald-700">{title}</h3>
      <IntroP intro={intro} />
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
        {data.sterkePunten.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

function Verbeterpunten({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-bold text-amber-700">{title}</h3>
      <IntroP intro={intro} />
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
        {data.verbeterpunten.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

function TopActies({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <IntroP intro={intro} />
      <ol className="space-y-2">
        {data.topActies.map((a, i) => (
          <li key={i} className="rounded-xl border p-3">
            <div className="flex items-start gap-2">
              {impactBadge(a.impact)}
              <strong>{a.actie}</strong>
            </div>
            <p className="mt-1 text-sm text-gray-700">{a.toelichting}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AanvullendeInfo({
  data,
  title,
  intro,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
}) {
  const extras = Object.entries(data as Record<string, unknown>).filter(
    ([k]) => !WEBSITE_CHECK_KNOWN_FIELDS.has(k),
  );
  if (extras.length === 0) return null;
  return (
    <section className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
      <h2 className="mb-3 text-lg font-bold text-purple-900">{title}</h2>
      <IntroP intro={intro} />
      <p className="mb-3 text-xs text-purple-700/70">
        Extra velden uit de admin-prompt — verschijnen automatisch als de prompt
        naar een veld vraagt dat niet in het standaardresultaat zit.
      </p>
      <dl className="space-y-3 text-sm">
        {extras.map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold text-purple-900">{humanizeKey(k)}</dt>
            <dd className="mt-0.5 text-gray-800">{renderExtraValue(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ── SECTIONS-registry ──────────────────────────────────────────────

export const SECTIONS: SectionDef[] = [
  {
    id: "score-banner",
    defaultTitle: "Overall score",
    description: "Paarse banner met overall score + bedrijfsnaam + URL.",
    Component: ScoreBanner,
  },
  {
    id: "executive-summary",
    defaultTitle: "Samenvatting",
    description: "Korte uitleg-paragraaf.",
    Component: ExecutiveSummary,
  },
  {
    id: "onderdelen-grid",
    defaultTitle: "Score per onderdeel",
    description: "Lijst met 11 sub-score-kaarten.",
    Component: OnderdelenGrid,
  },
  {
    id: "sterke-punten",
    defaultTitle: "Top 3 sterke punten",
    description: "Bullets met sterke punten (groen).",
    Component: SterkePunten,
  },
  {
    id: "verbeterpunten",
    defaultTitle: "Top 3 verbeterpunten",
    description: "Bullets met verbeterpunten (amber).",
    Component: Verbeterpunten,
  },
  {
    id: "top-acties",
    defaultTitle: "Top 5 prioriteitsacties",
    description: "Genummerde lijst met acties + impact-badges.",
    Component: TopActies,
  },
  {
    id: "aanvullende-info",
    defaultTitle: "Aanvullende info",
    description: "Dynamische extras uit de admin-prompt (passthrough-velden).",
    Component: AanvullendeInfo,
  },
];
```

- [ ] **Step 2: Verifieer typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/website-check/sections.tsx
git commit -m "feat(website-check): SECTIONS-registry met 7 bouwblokken"
```

---

### Task 5: `getModuleLayout` + `defaultLayoutFor` + SECTIONS_BY_SLUG (TDD)

**Files:**
- Create: `lib/modules/layouts.ts`
- Test: `lib/modules/layouts.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/modules/layouts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { defaultLayoutFor, getModuleLayout } from "./layouts";

// Mock de db-laag — we testen niet de Drizzle-queries zelf, alleen
// de fallback-logica van getModuleLayout.
const dbMock = vi.hoisted(() => ({ rows: [] as Array<{ layoutConfig: unknown }> }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbMock.rows,
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  dbMock.rows = [];
});

describe("defaultLayoutFor", () => {
  it("bouwt een config met alle 7 secties zichtbaar, in registry-volgorde", () => {
    const cfg = defaultLayoutFor("website-check");
    expect(cfg.version).toBe(1);
    expect(cfg.items).toHaveLength(7);
    expect(cfg.items.map((i) => (i.kind === "section" ? i.id : null))).toEqual([
      "score-banner",
      "executive-summary",
      "onderdelen-grid",
      "sterke-punten",
      "verbeterpunten",
      "top-acties",
      "aanvullende-info",
    ]);
    expect(cfg.items.every((i) => i.kind === "section" && i.visible)).toBe(true);
  });

  it("gooit een Error voor een onbekende module-slug", () => {
    expect(() => defaultLayoutFor("onbekend")).toThrow();
  });
});

describe("getModuleLayout", () => {
  it("returnt default als layoutConfig in DB null is", async () => {
    dbMock.rows = [{ layoutConfig: null }];
    const cfg = await getModuleLayout("website-check");
    expect(cfg.items).toHaveLength(7);
  });

  it("returnt parsed config als layoutConfig valide is", async () => {
    const custom = {
      version: 1,
      items: [
        { kind: "section", id: "score-banner", title: "Score!", intro: null, visible: true },
      ],
    };
    dbMock.rows = [{ layoutConfig: custom }];
    const cfg = await getModuleLayout("website-check");
    expect(cfg.items).toHaveLength(1);
    expect(cfg.items[0]).toMatchObject({ id: "score-banner", title: "Score!" });
  });

  it("returnt default bij corrupt JSON in DB", async () => {
    dbMock.rows = [{ layoutConfig: { version: 1, items: [{ kind: "alien" }] } }];
    const cfg = await getModuleLayout("website-check");
    expect(cfg.items).toHaveLength(7); // fallback
  });

  it("gooit Error als module niet in DB staat", async () => {
    dbMock.rows = [];
    await expect(getModuleLayout("website-check")).rejects.toThrow(/niet in DB/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/modules/layouts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Maak `lib/modules/layouts.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";
import { LayoutConfig } from "./layout";
import type { LayoutConfig as LayoutConfigType } from "./layout";
import { SECTIONS as WEBSITE_CHECK_SECTIONS } from "@/modules/website-check/sections";
import type { SectionDef } from "@/modules/website-check/sections";

/** Per module-slug de SECTIONS-registry die de runtime nodig heeft. */
const SECTIONS_BY_SLUG: Record<string, SectionDef[]> = {
  "website-check": WEBSITE_CHECK_SECTIONS,
};

/**
 * Bouwt de default-layout voor een module uit zijn SECTIONS-registry:
 * alle secties zichtbaar, in registry-volgorde, zonder titel-overrides.
 */
export function defaultLayoutFor(slug: string): LayoutConfigType {
  const sections = SECTIONS_BY_SLUG[slug];
  if (!sections) {
    throw new Error(`Geen SECTIONS-registry voor module ${slug}`);
  }
  return {
    version: 1,
    items: sections.map((s) => ({
      kind: "section" as const,
      id: s.id,
      title: null,
      intro: null,
      visible: true,
    })),
  };
}

/**
 * Haalt de actieve layout-config voor een module op uit de DB.
 * Valt terug op `defaultLayoutFor(slug)` als:
 *  - `modules.layout_config` is NULL (geen admin-config ingesteld)
 *  - DB-waarde is corrupt (Zod safeParse faalt)
 * Gooit een Error als de module niet in de DB staat.
 */
export async function getModuleLayout(slug: string): Promise<LayoutConfigType> {
  const [row] = await db
    .select({ layoutConfig: modules.layoutConfig })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);

  if (!row) throw new Error(`Module ${slug} niet in DB`);

  if (!row.layoutConfig) {
    return defaultLayoutFor(slug);
  }

  const parsed = LayoutConfig.safeParse(row.layoutConfig);
  if (!parsed.success) {
    console.warn(`[layout] corrupt config voor ${slug} — fallback op default`);
    return defaultLayoutFor(slug);
  }
  return parsed.data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/modules/layouts.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/modules/layouts.ts lib/modules/layouts.test.ts
git commit -m "feat(layout): getModuleLayout + defaultLayoutFor met code-fallback"
```

---

### Task 6: Refactor `WebsiteCheckResultView` naar config-driven render

Vervang de monolithische JSX-render door een loop over `config.items` die per item het juiste component aanroept of een `MarkdownBlock` rendert. Component-signature wijzigt: krijgt nu ook `config` mee.

**Files:**
- Modify: `modules/website-check/components/WebsiteCheckResultView.tsx`

- [ ] **Step 1: Vervang het bestand volledig**

```tsx
// modules/website-check/components/WebsiteCheckResultView.tsx
import type { WebsiteCheckOutput } from "../schema";
import { SECTIONS } from "../sections";
import type { LayoutConfig } from "@/lib/modules/layout";
import { MarkdownBlock } from "@/lib/modules/MarkdownBlock";

export function WebsiteCheckResultView({
  data,
  config,
}: {
  data: WebsiteCheckOutput;
  config: LayoutConfig;
  readOnly?: boolean;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      {config.items.map((item, idx) => {
        if (item.kind === "block") {
          return <MarkdownBlock key={item.id} markdown={item.markdown} />;
        }
        if (!item.visible) return null;
        const def = SECTIONS.find((s) => s.id === item.id);
        if (!def) return null; // section verwijderd uit code → skip
        const Cmp = def.Component;
        return (
          <Cmp
            key={`${item.id}-${idx}`}
            data={data}
            title={item.title ?? def.defaultTitle}
            intro={item.intro}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verifieer typecheck**

Run: `pnpm typecheck`
Expected: ERRORS — de twee consumers passen nog niet `config` door. Dat lossen we op in Tasks 7 en 8.

(Dit is verwacht. De volgende twee tasks lossen het op. Skip commit nu, batch met taak 7+8.)

---

### Task 7: Update ingelogde consumer (page) — fetch + pass config

**Files:**
- Modify: `app/(app)/modules/website-check/[sessionId]/page.tsx`

- [ ] **Step 1: Voeg `getModuleLayout`-aanroep toe en geef config door**

Zoek (importsectie bovenin):

```tsx
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
```

Voeg eronder toe:

```tsx
import { getModuleLayout } from "@/lib/modules/layouts";
```

Zoek (de JSX waar `WebsiteCheckResultView` wordt gerenderd, status === "approved"):

```tsx
      <WebsiteCheckResultView data={parsed.data} />
```

Vervang door:

```tsx
      <WebsiteCheckResultView data={parsed.data} config={await getModuleLayout("website-check")} />
```

> NB: de pagina is al een async function (vanwege bestaande `await params`); `await getModuleLayout` is direct inline gebruikbaar.

- [ ] **Step 2: Verifieer typecheck**

Run: `pnpm typecheck`
Expected: nog steeds errors door de gratis-check-consumer (Task 8 lost dat op). Geen commit nu.

---

### Task 8: Update gratis-check consumer (page) — fetch + pass config

**Files:**
- Modify: `app/(marketing)/gratis-check/[id]/page.tsx`

- [ ] **Step 1: Voeg `getModuleLayout`-aanroep toe**

Zoek:

```tsx
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
```

Voeg eronder toe:

```tsx
import { getModuleLayout } from "@/lib/modules/layouts";
```

Zoek (de JSX waar `WebsiteCheckResultView` wordt gerenderd, op de completed-state):

```tsx
      <WebsiteCheckResultView data={parsed.data} readOnly />
```

Vervang door:

```tsx
      <WebsiteCheckResultView
        data={parsed.data}
        config={await getModuleLayout("website-check")}
        readOnly
      />
```

- [ ] **Step 2: Verifieer typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: ALLE typecheck-errors weg, alle bestaande tests groen.

- [ ] **Step 3: Commit (Tasks 6 + 7 + 8 samen)**

```bash
git add modules/website-check/components/WebsiteCheckResultView.tsx \
        "app/(app)/modules/website-check/[sessionId]/page.tsx" \
        "app/(marketing)/gratis-check/[id]/page.tsx"
git commit -m "refactor(website-check): config-driven result-view via getModuleLayout

WebsiteCheckResultView loopt nu over config.items uit getModuleLayout.
Beide consumers (ingelogd + gratis-check) halen de config op en geven
'm door. Default-config uit SECTIONS-registry zorgt dat zonder admin-
overrides de view zoals voorheen rendert (met 2 kleine visuele delta's:
sterke/verbeterpunten gestapeld i.p.v. side-by-side, en Samenvatting
in eigen kaart i.p.v. in de hero)."
```

---

### Task 9: Eindcheck — typecheck, tests, smoke

**Files:** (geen wijzigingen)

- [ ] **Step 1: Typecheck**

Run: `cd /Users/olivierarnolds/positionr-website && pnpm typecheck`
Expected: PASS — geen errors.

- [ ] **Step 2: Volledige testsuite**

Run: `pnpm test`
Expected: PASS — bestaande tests + nieuwe `lib/modules/layout.test.ts` (6) + `lib/modules/layouts.test.ts` (6) = **+12 tests**.

- [ ] **Step 3: Handmatige smoke (door Olivier)**

```bash
unset ANTHROPIC_API_KEY && cd /Users/olivierarnolds/positionr-website && pnpm dev
```

In de browser:
1. `/modules/website-check` → start nieuwe analyse (ingelogd). Resultaat-pagina toont alle 7 secties: score-banner, samenvatting (apart!), onderdelen-grid, sterke punten (gestapeld), verbeterpunten (gestapeld), top-acties, aanvullende info (alleen als prompt extra velden teruggaf).
2. `/gratis-check` → idem voor gratis check. Resultaat-pagina toont dezelfde secties.
3. Bestaande sessies via direct-URL openen → moeten ook werken (default-config wordt toegepast).
4. Geen visuele crashes; geen JSON-uitvoer-leak.

- [ ] **Step 4: Vraag Olivier om push-toestemming**

Niet zelf pushen. Conform werkstijl: vraag eerst.

---

## Self-review (na voltooiing PR-L1)

- [ ] `pnpm typecheck` — schoon
- [ ] `pnpm test` — alle tests groen (verwacht baseline + 12)
- [ ] `modules.layout_config`-kolom + `module_layout_history`-tabel + RLS-policy bestaan in Supabase
- [ ] Default-layout via `defaultLayoutFor("website-check")` levert 7 secties
- [ ] `WebsiteCheckResultView` rendert zonder admin-config zoals verwacht
- [ ] Beide consumers (ingelogd + gratis-check) geven config door
- [ ] Geen secrets/credentials toegevoegd

## Wat deze PR NIET doet

- Admin-UI op `/admin/layouts/[slug]` → PR-L2 (aparte plan).
- ICP-`FinalIcpView` refactor → PR-L3 (aparte spec + plan, later).
- Visuele stijl-customization (kleuren/spacing) → out of scope.
- Side-by-side rendering van sterke + verbeterpunten — bewuste, geaccepteerde visuele delta tegen de huidige view, in ruil voor de nieuwe flexibiliteit.
