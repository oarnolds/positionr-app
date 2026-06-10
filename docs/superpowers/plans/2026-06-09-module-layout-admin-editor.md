# Module Layout Admin Editor (PR-L2) Implementation Plan

**Goal:** Admin-UI op `/admin/layouts/[slug]` waarmee Olivier de result-view-layout van een module (in v1: Website Check) kan tweaken — secties slepen, visible togglen, titel/intro overschrijven, vrije Markdown-blokken invoegen — met live preview en versie-historie (laatste 5).

**Architecture:** Server-page `/admin/layouts/[slug]` rendert sidebar + initiale layout-config + meest recente sessie-data. Client component `LayoutEditor` houdt de live edit-state, biedt twee tabs (Editor + Preview), en stuurt save/reset/restore via server-actions. Reorder via `@dnd-kit/sortable`. Vrij blok via bestaande `RichPromptEditor` (TipTap → Markdown via turndown). Versie-historie via `module_layout_history`-tabel (auto-prune naar laatste 5).

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle, Supabase, Zod (PR-L1 schema), `@dnd-kit/core` + `@dnd-kit/sortable` (nieuw), `@tiptap/react` (bestaand), `turndown` (bestaand), Vitest.

---

### Task 1: Server-actions + tests (TDD)

Drie server-actions plus history-fetcher voor de UI. Tests mocken db; geen integratie-DB.

**Files:**
- Create: `lib/modules/layout-actions.ts`
- Test: `lib/modules/layout-actions.test.ts`

- [ ] **Step 1: Failing test**

```ts
// lib/modules/layout-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveModuleLayout,
  resetModuleLayout,
  restoreModuleLayout,
  getModuleLayoutHistory,
} from "./layout-actions";

const dbMock = vi.hoisted(() => ({
  moduleRows: [{ id: "mod-1" }],
  historyRows: [] as Array<{ id: string; layoutConfig: unknown; savedAt: Date; note: string | null }>,
  updates: [] as unknown[],
  inserts: [] as unknown[],
  deletes: [] as unknown[],
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: (t: { name: string }) => ({
        where: () => ({
          limit: async () => (t.name === "modules" ? dbMock.moduleRows : dbMock.historyRows),
          orderBy: () => ({
            limit: async () => dbMock.historyRows,
          }),
        }),
        orderBy: () => ({
          limit: async () => dbMock.historyRows,
        }),
      }),
    }),
    update: () => ({
      set: (vals: unknown) => ({
        where: async () => {
          dbMock.updates.push(vals);
        },
      }),
    }),
    insert: () => ({
      values: async (vals: unknown) => {
        dbMock.inserts.push(vals);
      },
    }),
    delete: () => ({
      where: async () => {
        dbMock.deletes.push(true);
      },
    }),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
  }),
}));

beforeEach(() => {
  dbMock.updates.length = 0;
  dbMock.inserts.length = 0;
  dbMock.deletes.length = 0;
  dbMock.historyRows = [];
});

describe("saveModuleLayout", () => {
  it("valideert config en update modules.layout_config + insert history", async () => {
    const config = {
      version: 1 as const,
      items: [
        { kind: "section" as const, id: "score-banner", title: null, intro: null, visible: true },
      ],
    };
    await saveModuleLayout("website-check", config, "test save");
    expect(dbMock.updates).toHaveLength(1);
    expect(dbMock.inserts).toHaveLength(1);
  });

  it("gooit bij ongeldige config", async () => {
    await expect(
      saveModuleLayout("website-check", { version: 2, items: [] } as never, null),
    ).rejects.toThrow();
  });
});

describe("resetModuleLayout", () => {
  it("zet layout_config op NULL en voegt geen history toe", async () => {
    await resetModuleLayout("website-check");
    expect(dbMock.updates).toHaveLength(1);
    expect(dbMock.inserts).toHaveLength(0);
  });
});

describe("restoreModuleLayout", () => {
  it("maakt een nieuwe save met de oude config + note 'Hersteld'", async () => {
    dbMock.historyRows = [
      {
        id: "hist-1",
        layoutConfig: {
          version: 1,
          items: [
            { kind: "section", id: "score-banner", title: null, intro: null, visible: true },
          ],
        },
        savedAt: new Date(),
        note: null,
      },
    ];
    await restoreModuleLayout("website-check", "hist-1");
    expect(dbMock.updates).toHaveLength(1);
    expect(dbMock.inserts).toHaveLength(1);
  });
});

describe("getModuleLayoutHistory", () => {
  it("returnt laatste 5 entries", async () => {
    dbMock.historyRows = Array.from({ length: 5 }, (_, i) => ({
      id: `h-${i}`,
      layoutConfig: { version: 1, items: [] },
      savedAt: new Date(),
      note: null,
    }));
    const out = await getModuleLayoutHistory("website-check");
    expect(out).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL — module bestaat niet)**

`pnpm test lib/modules/layout-actions.test.ts`

- [ ] **Step 3: Implementatie**

```ts
// lib/modules/layout-actions.ts
"use server";

import { eq, desc, and, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules, moduleLayoutHistory } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { LayoutConfig } from "./layout";
import type { LayoutConfig as LayoutConfigType } from "./layout";

const KEEP_HISTORY = 5;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function getModuleId(slug: string): Promise<string> {
  const [row] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (!row) throw new Error(`Module ${slug} niet in DB`);
  return row.id;
}

async function pruneHistory(moduleId: string): Promise<void> {
  // Keep KEEP_HISTORY meest recente; verwijder de rest.
  const rows = await db
    .select({ id: moduleLayoutHistory.id })
    .from(moduleLayoutHistory)
    .where(eq(moduleLayoutHistory.moduleId, moduleId))
    .orderBy(desc(moduleLayoutHistory.savedAt))
    .limit(KEEP_HISTORY);
  const keepIds = rows.map((r) => r.id);
  if (keepIds.length === 0) return;
  await db
    .delete(moduleLayoutHistory)
    .where(
      and(
        eq(moduleLayoutHistory.moduleId, moduleId),
        notInArray(moduleLayoutHistory.id, keepIds),
      ),
    );
}

export async function saveModuleLayout(
  slug: string,
  config: LayoutConfigType,
  note: string | null = null,
): Promise<void> {
  const parsed = LayoutConfig.parse(config); // throws bij ongeldig
  const moduleId = await getModuleId(slug);
  const userId = await currentUserId();
  await db.update(modules).set({ layoutConfig: parsed }).where(eq(modules.id, moduleId));
  await db.insert(moduleLayoutHistory).values({
    moduleId,
    layoutConfig: parsed,
    savedBy: userId,
    note,
  });
  await pruneHistory(moduleId);
}

export async function resetModuleLayout(slug: string): Promise<void> {
  const moduleId = await getModuleId(slug);
  await db.update(modules).set({ layoutConfig: null }).where(eq(modules.id, moduleId));
  // Geen history-entry — NULL is geen "versie".
}

export async function restoreModuleLayout(slug: string, historyId: string): Promise<void> {
  const [row] = await db
    .select({ layoutConfig: moduleLayoutHistory.layoutConfig })
    .from(moduleLayoutHistory)
    .where(eq(moduleLayoutHistory.id, historyId))
    .limit(1);
  if (!row) throw new Error(`History entry ${historyId} niet gevonden`);
  const parsed = LayoutConfig.parse(row.layoutConfig);
  await saveModuleLayout(slug, parsed, `Hersteld van versie ${historyId.slice(0, 8)}`);
}

export async function getModuleLayoutHistory(
  slug: string,
): Promise<Array<{ id: string; layoutConfig: LayoutConfigType; savedAt: Date; note: string | null }>> {
  const moduleId = await getModuleId(slug);
  const rows = await db
    .select({
      id: moduleLayoutHistory.id,
      layoutConfig: moduleLayoutHistory.layoutConfig,
      savedAt: moduleLayoutHistory.savedAt,
      note: moduleLayoutHistory.note,
    })
    .from(moduleLayoutHistory)
    .where(eq(moduleLayoutHistory.moduleId, moduleId))
    .orderBy(desc(moduleLayoutHistory.savedAt))
    .limit(KEEP_HISTORY);
  return rows.map((r) => ({
    ...r,
    layoutConfig: LayoutConfig.parse(r.layoutConfig),
  }));
}
```

- [ ] **Step 4: Test groen**

`pnpm test lib/modules/layout-actions.test.ts` — verwacht: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/modules/layout-actions.ts lib/modules/layout-actions.test.ts
git commit -m "feat(layout): server-actions save/reset/restore + history-fetch"
```

---

### Task 2: Preview-fixture + getLatestSession helper

**Files:**
- Create: `modules/website-check/preview-fixture.ts`
- Create: `lib/modules/preview-data.ts`

- [ ] **Step 1: Maak preview-fixture**

```ts
// modules/website-check/preview-fixture.ts
import type { WebsiteCheckOutput } from "./schema";

/**
 * Fallback dummy WebsiteCheckOutput voor de preview-tab van de
 * admin-editor — gebruikt wanneer er nog geen echte completed
 * sessie in de DB staat.
 */
export const WEBSITE_CHECK_PREVIEW_FIXTURE: WebsiteCheckOutput = {
  companyName: "Voorbeeld B.V.",
  websiteUrl: "https://voorbeeld.nl",
  overallScore: 6.4,
  executiveSummary:
    "Een degelijke website met een duidelijke propositie, maar de conversie-elementen kunnen sterker en de uitleg over de doelgroep is te algemeen.",
  onderdelen: [
    { naam: "Eerste indruk", score: 7.5, toelichting: "Helder design, snelle laadtijd.", verbeterpunten: ["Headline kan scherper"] },
    { naam: "Propositie", score: 5.8, toelichting: "Wat doe je staat er, voor wie minder duidelijk.", verbeterpunten: ["Doelgroep expliciet noemen", "Concreet voorbeeld toevoegen"] },
    { naam: "Doelgroep & USP's", score: 6.0, toelichting: "USP's blijven generiek.", verbeterpunten: ["Concretere klantvoorbeelden"] },
    { naam: "Content", score: 6.5, toelichting: "Goed leesbaar.", verbeterpunten: [] },
    { naam: "Call to actions", score: 5.5, toelichting: "Te veel keuze, te weinig hierarchie.", verbeterpunten: ["Primaire CTA boven de vouw"] },
    { naam: "Social proof", score: 7.0, toelichting: "Logo's aanwezig, recensies missen.", verbeterpunten: ["Recensies toevoegen"] },
    { naam: "Visueel ontwerp", score: 7.8, toelichting: "Modern en strak.", verbeterpunten: [] },
    { naam: "Mobiel", score: 6.2, toelichting: "Werkt maar voelt traag.", verbeterpunten: ["Beelden optimaliseren"] },
    { naam: "Snelheid", score: 5.5, toelichting: "Laadt rond de 3 seconden.", verbeterpunten: ["Lazy-loading inschakelen"] },
    { naam: "SEO basis", score: 6.0, toelichting: "Title en meta aanwezig.", verbeterpunten: ["H1-structuur verbeteren"] },
    { naam: "Vertrouwen", score: 7.2, toelichting: "Contactgegevens duidelijk.", verbeterpunten: [] },
  ],
  sterkePunten: [
    "Strakke visuele identiteit",
    "Logo's van bekende klanten boven de vouw",
    "Duidelijke contactgegevens en KvK-info",
  ],
  verbeterpunten: [
    "Doelgroep en USP's te generiek",
    "Te veel CTA's zonder duidelijke hierarchie",
    "Mobiele laadsnelheid laat te wensen over",
  ],
  topActies: [
    { impact: "hoog", actie: "Maak één primaire CTA boven de vouw", toelichting: "Eén actie laten zien geeft conversielift." },
    { impact: "hoog", actie: "Voeg drie concrete klantcases toe", toelichting: "Geeft direct vertrouwen + propositie-bewijs." },
    { impact: "middel", actie: "Mobiele beelden comprimeren", toelichting: "Verlaagt laadtijd met ~30%." },
    { impact: "middel", actie: "Recensies of testimonials toevoegen", toelichting: "Social proof versterken." },
    { impact: "laag", actie: "H1-structuur opschonen", toelichting: "Helpt SEO en accessibility." },
  ],
};
```

- [ ] **Step 2: Helper `getLatestSession`**

```ts
// lib/modules/preview-data.ts
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";
import { WEBSITE_CHECK_PREVIEW_FIXTURE } from "@/modules/website-check/preview-fixture";

/**
 * Haalt de meest recente completed sessie voor `slug` op en valideert de
 * output. Bij geen sessie of corrupt output → fallback fixture.
 */
export async function getPreviewData(slug: string): Promise<WebsiteCheckOutput> {
  if (slug !== "website-check") return WEBSITE_CHECK_PREVIEW_FIXTURE;
  const rows = await db
    .select({ output: sessions.output })
    .from(sessions)
    .where(and(eq(sessions.moduleSlug, slug), eq(sessions.status, "completed")))
    .orderBy(desc(sessions.createdAt))
    .limit(1);
  if (rows.length === 0) return WEBSITE_CHECK_PREVIEW_FIXTURE;
  const parsed = WebsiteCheckOutputSchema.safeParse(rows[0].output);
  return parsed.success ? parsed.data : WEBSITE_CHECK_PREVIEW_FIXTURE;
}
```

- [ ] **Step 3: Typecheck**

`pnpm typecheck` — verwacht: geen errors.

- [ ] **Step 4: Commit**

```bash
git add modules/website-check/preview-fixture.ts lib/modules/preview-data.ts
git commit -m "feat(layout): preview-fixture + getPreviewData helper"
```

---

### Task 3: Routes + sidebar (server)

**Files:**
- Create: `app/(admin)/admin/layouts/page.tsx` (redirect)
- Create: `app/(admin)/admin/layouts/[slug]/page.tsx` (server page)
- Create: `app/(admin)/admin/layouts/[slug]/sidebar.tsx` (server component)

- [ ] **Step 1: Install @dnd-kit**

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Redirect-page**

```tsx
// app/(admin)/admin/layouts/page.tsx
import { redirect } from "next/navigation";

export default function LayoutsIndexPage() {
  redirect("/admin/layouts/website-check");
}
```

- [ ] **Step 3: Sidebar**

```tsx
// app/(admin)/admin/layouts/[slug]/sidebar.tsx
import Link from "next/link";

// V1: alleen Website Check. Toekomst: lees uit een centrale registry.
const LAYOUT_MODULES: Array<{ slug: string; title: string }> = [
  { slug: "website-check", title: "Website Check" },
];

export function LayoutsSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-slate-50/50 p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
        Modules
      </h2>
      <ul className="space-y-1">
        {LAYOUT_MODULES.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/admin/layouts/${m.slug}`}
              className={`block rounded-md px-3 py-2 text-sm ${
                m.slug === activeSlug
                  ? "bg-purple-100 font-semibold text-purple-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {m.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 4: Server-page**

```tsx
// app/(admin)/admin/layouts/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getModuleLayout } from "@/lib/modules/layouts";
import { getModuleLayoutHistory } from "@/lib/modules/layout-actions";
import { getPreviewData } from "@/lib/modules/preview-data";
import { LayoutsSidebar } from "./sidebar";
import { LayoutEditor } from "./layout-editor";

const ALLOWED_SLUGS = new Set(["website-check"]);

export default async function LayoutEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.has(slug)) notFound();

  const [layout, history, previewData] = await Promise.all([
    getModuleLayout(slug),
    getModuleLayoutHistory(slug),
    getPreviewData(slug),
  ]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <LayoutsSidebar activeSlug={slug} />
      <main className="flex-1 overflow-y-auto p-6">
        <LayoutEditor
          slug={slug}
          initialLayout={layout}
          history={history}
          previewData={previewData}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + smoke**

```bash
pnpm typecheck
pnpm build  # moet de redirect-page + [slug]-page compileren (LayoutEditor stub OK voor nu)
```

(Voor de build moet er een stub `LayoutEditor` zijn — Task 4 levert de echte. Voor nu: een lege placeholder export om de build groen te krijgen.)

- [ ] **Step 6: Commit**

```bash
git add app/\(admin\)/admin/layouts package.json pnpm-lock.yaml
git commit -m "feat(layout): admin-routes /admin/layouts + sidebar + @dnd-kit deps"
```

---

### Task 4: LayoutEditor (client) — tabs frame + state + dirty

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`

- [ ] **Step 1: Skelet met state, tabs, save-knop, dirty-flag**

```tsx
"use client";
import { useState, useEffect, useTransition, useRef } from "react";
import { Save, RotateCcw } from "lucide-react";
import type { LayoutConfig } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";
import { saveModuleLayout, resetModuleLayout } from "@/lib/modules/layout-actions";
import { EditorTab } from "./editor-tab";
import { PreviewTab } from "./preview-tab";
import { VersionHistory } from "./version-history";

type HistoryEntry = {
  id: string;
  layoutConfig: LayoutConfig;
  savedAt: Date;
  note: string | null;
};

export function LayoutEditor({
  slug,
  initialLayout,
  history,
  previewData,
}: {
  slug: string;
  initialLayout: LayoutConfig;
  history: HistoryEntry[];
  previewData: WebsiteCheckOutput;
}) {
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [layout, setLayout] = useState<LayoutConfig>(initialLayout);
  const [isPending, startTransition] = useTransition();
  const baselineRef = useRef<string>(JSON.stringify(initialLayout));
  const dirty = JSON.stringify(layout) !== baselineRef.current;

  // beforeunload-prompt bij dirty
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
      await saveModuleLayout(slug, layout, null);
      baselineRef.current = JSON.stringify(layout);
      window.location.reload(); // history herladen
    });
  }

  function handleReset() {
    if (!confirm("Layout herstellen naar standaard? Huidige config wordt vervangen.")) return;
    startTransition(async () => {
      await resetModuleLayout(slug);
      window.location.reload();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Layout — {slug}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} /> Opslaan
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </header>

      <div className="flex border-b border-slate-200">
        {(["editor", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-purple-600 text-purple-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "editor" ? "Editor" : "Preview"}
          </button>
        ))}
      </div>

      {tab === "editor" ? (
        <EditorTab layout={layout} onChange={setLayout} />
      ) : (
        <PreviewTab layout={layout} data={previewData} />
      )}

      <VersionHistory slug={slug} history={history} />
    </div>
  );
}
```

- [ ] **Step 2: Stubs voor EditorTab + PreviewTab + VersionHistory zodat compile slaagt**

Maak in dezelfde stap minimal placeholder-bestanden — worden in T5-T8 ingevuld.

- [ ] **Step 3: Typecheck + build**

`pnpm typecheck && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/layout-editor.tsx app/\(admin\)/admin/layouts/\[slug\]/editor-tab.tsx app/\(admin\)/admin/layouts/\[slug\]/preview-tab.tsx app/\(admin\)/admin/layouts/\[slug\]/version-history.tsx
git commit -m "feat(layout): LayoutEditor frame met tabs + dirty-state + save/reset"
```

---

### Task 5: EditorTab — drag-drop items met @dnd-kit

**Files:**
- Modify: `app/(admin)/admin/layouts/[slug]/editor-tab.tsx`
- Create: `app/(admin)/admin/layouts/[slug]/section-item.tsx`
- Create: `app/(admin)/admin/layouts/[slug]/block-item.tsx`

- [ ] **Step 1: EditorTab met SortableContext**

```tsx
"use client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { LayoutConfig, LayoutItem } from "@/lib/modules/layout";
import { SectionItem } from "./section-item";
import { BlockItem } from "./block-item";
import { HoverInsert } from "./hover-insert";

function itemKey(item: LayoutItem): string {
  return `${item.kind}-${item.id}`;
}

export function EditorTab({
  layout,
  onChange,
}: {
  layout: LayoutConfig;
  onChange: (next: LayoutConfig) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = layout.items.findIndex((i) => itemKey(i) === active.id);
    const newIdx = layout.items.findIndex((i) => itemKey(i) === over.id);
    onChange({ ...layout, items: arrayMove(layout.items, oldIdx, newIdx) });
  }

  function updateItem(idx: number, patch: Partial<LayoutItem>) {
    const next = [...layout.items];
    next[idx] = { ...next[idx], ...patch } as LayoutItem;
    onChange({ ...layout, items: next });
  }

  function removeItem(idx: number) {
    const next = layout.items.filter((_, i) => i !== idx);
    onChange({ ...layout, items: next });
  }

  function insertBlock(atIdx: number) {
    const newBlock: LayoutItem = {
      kind: "block",
      id: crypto.randomUUID(),
      markdown: "",
    };
    const next = [...layout.items.slice(0, atIdx), newBlock, ...layout.items.slice(atIdx)];
    onChange({ ...layout, items: next });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={layout.items.map(itemKey)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          <HoverInsert onInsert={() => insertBlock(0)} />
          {layout.items.map((item, idx) => (
            <div key={itemKey(item)}>
              {item.kind === "section" ? (
                <SectionItem
                  item={item}
                  onChange={(patch) => updateItem(idx, patch)}
                />
              ) : (
                <BlockItem
                  item={item}
                  onChange={(patch) => updateItem(idx, patch)}
                  onRemove={() => removeItem(idx)}
                />
              )}
              <HoverInsert onInsert={() => insertBlock(idx + 1)} />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: SectionItem**

```tsx
"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { SECTIONS } from "@/modules/website-check/sections";
import type { LayoutItem } from "@/lib/modules/layout";

type SectionLayoutItem = Extract<LayoutItem, { kind: "section" }>;

export function SectionItem({
  item,
  onChange,
}: {
  item: SectionLayoutItem;
  onChange: (patch: Partial<SectionLayoutItem>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `section-${item.id}`,
  });
  const def = SECTIONS.find((s) => s.id === item.id);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-slate-200 bg-white p-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-700"
          aria-label="Sleep om te herordenen"
        >
          <GripVertical size={16} />
        </button>
        <input
          type="checkbox"
          checked={item.visible}
          onChange={(e) => onChange({ visible: e.target.checked })}
          className="mt-1.5"
          title={item.visible ? "Zichtbaar" : "Verborgen"}
        />
        <div className="flex-1 space-y-2">
          <div>
            <label className="text-xs text-slate-500">Titel</label>
            <input
              type="text"
              value={item.title ?? ""}
              onChange={(e) => onChange({ title: e.target.value || null })}
              placeholder={def?.defaultTitle ?? "(default)"}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Intro (optioneel)</label>
            <textarea
              value={item.intro ?? ""}
              onChange={(e) => onChange({ intro: e.target.value || null })}
              rows={2}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </div>
          {def && <p className="text-xs text-slate-500">{def.description}</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: BlockItem — TipTap via RichPromptEditor**

```tsx
"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { RichPromptEditor } from "@/components/RichPromptEditor"; // bestaand
import type { LayoutItem } from "@/lib/modules/layout";

type BlockLayoutItem = Extract<LayoutItem, { kind: "block" }>;

export function BlockItem({
  item,
  onChange,
  onRemove,
}: {
  item: BlockLayoutItem;
  onChange: (patch: Partial<BlockLayoutItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `block-${item.id}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-700"
        >
          <GripVertical size={16} />
        </button>
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          Vrij blok
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-slate-400 hover:text-rose-600"
          aria-label="Blok verwijderen"
        >
          <X size={16} />
        </button>
      </div>
      <RichPromptEditor
        value={item.markdown}
        onChange={(markdown) => onChange({ markdown })}
        placeholder="Schrijf vrije content (Markdown)…"
      />
    </div>
  );
}
```

> **Let op:** Check de echte interface van `RichPromptEditor` — als de props anders heten (`onValueChange`, `defaultValue` etc.) pas hier aan.

- [ ] **Step 4: Typecheck + build**

`pnpm typecheck && pnpm build`

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/editor-tab.tsx app/\(admin\)/admin/layouts/\[slug\]/section-item.tsx app/\(admin\)/admin/layouts/\[slug\]/block-item.tsx
git commit -m "feat(layout): drag-drop EditorTab met SectionItem + BlockItem"
```

---

### Task 6: HoverInsert — +-knop tussen items

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/hover-insert.tsx`

- [ ] **Step 1: Component**

```tsx
"use client";
import { Plus } from "lucide-react";

export function HoverInsert({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group relative my-1 h-4">
      <button
        type="button"
        onClick={onInsert}
        className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1 rounded border border-dashed border-transparent py-1 text-xs text-slate-400 opacity-0 transition group-hover:border-slate-300 group-hover:opacity-100"
      >
        <Plus size={12} />
        Vrij blok invoegen
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

`pnpm typecheck && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/hover-insert.tsx
git commit -m "feat(layout): HoverInsert +-knop voor vrije blokken"
```

---

### Task 7: PreviewTab — live ResultView

**Files:**
- Modify: `app/(admin)/admin/layouts/[slug]/preview-tab.tsx`

- [ ] **Step 1: Implementatie**

```tsx
"use client";
import type { LayoutConfig } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";

export function PreviewTab({
  layout,
  data,
}: {
  layout: LayoutConfig;
  data: WebsiteCheckOutput;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
        Preview met meest recente echte sessie-data — wijzigingen hier zijn nog niet opgeslagen.
      </div>
      <WebsiteCheckResultView data={data} layout={layout} readOnly />
    </div>
  );
}
```

> **Belangrijk**: `WebsiteCheckResultView` is uit PR-L1 een server-compatible component (geen `"use client"`). Het mag client-side gerenderd worden als het geen async/server-only spullen importeert. Validatie: `pnpm build` moet hier groen blijven. Mocht er een issue zijn met server-component-import in client-tree, voeg dan `"use client"` toe aan ResultView (geen functionele impact omdat het pure JSX render is).

- [ ] **Step 2: Typecheck + build**

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/preview-tab.tsx
git commit -m "feat(layout): PreviewTab met live ResultView op echte sessie-data"
```

---

### Task 8: VersionHistory — laatste 5 + restore

**Files:**
- Modify: `app/(admin)/admin/layouts/[slug]/version-history.tsx`

- [ ] **Step 1: Implementatie**

```tsx
"use client";
import { useState, useTransition } from "react";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import type { LayoutConfig } from "@/lib/modules/layout";
import { restoreModuleLayout } from "@/lib/modules/layout-actions";

type HistoryEntry = {
  id: string;
  layoutConfig: LayoutConfig;
  savedAt: Date;
  note: string | null;
};

export function VersionHistory({
  slug,
  history,
}: {
  slug: string;
  history: HistoryEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRestore(id: string) {
    if (!confirm("Deze versie herstellen? Maakt een nieuwe save aan in de historie.")) return;
    startTransition(async () => {
      await restoreModuleLayout(slug, id);
      window.location.reload();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-slate-700"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <History size={16} />
        Versie-historie ({history.length})
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {history.length === 0 && (
            <li className="text-sm text-slate-500">Nog geen versies opgeslagen.</li>
          )}
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded border border-slate-200 bg-white p-2 text-sm"
            >
              <div>
                <div className="font-medium">
                  {new Intl.DateTimeFormat("nl-NL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(entry.savedAt)}
                </div>
                {entry.note && (
                  <div className="text-xs text-slate-500">{entry.note}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRestore(entry.id)}
                disabled={isPending}
                className="rounded border border-slate-300 px-3 py-1 text-xs"
              >
                Herstel
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/version-history.tsx
git commit -m "feat(layout): VersionHistory accordion met restore"
```

---

### Task 9: Eindcheck

- [ ] **Step 1: Run alle tests + typecheck + build**

```bash
pnpm test
pnpm typecheck
pnpm build
```

Verwacht:
- `pnpm test`: 17+ test files, 81 + 4 nieuwe = **85 passed**
- `pnpm typecheck`: schoon
- `pnpm build`: alle nieuwe routes compileren (`/admin/layouts`, `/admin/layouts/[slug]`)

- [ ] **Step 2: Browser-smoke (lokaal of na deploy)**

1. Navigate naar `/admin/layouts` → moet redirecten naar `/admin/layouts/website-check`
2. Editor-tab: sleep een sectie omhoog/omlaag — order verandert
3. Toggle visible op een sectie — checkbox flipt
4. Klik op +-zone tussen secties — vrij-blok wordt toegevoegd
5. Save — knop reload de pagina; history krijgt nieuwe entry
6. Reset — confirm-dialog; layout valt terug op default
7. Preview-tab: rendert ResultView met live edit-state
8. Versie-historie: open accordion, klik restore op een entry → confirm → reload

- [ ] **Step 3: Ga naar de result-page (`/modules/website-check/<sessieId>`) en verifieer dat de admin-aanpassingen daar zichtbaar zijn**

- [ ] **Step 4: Commit (alleen als nog losse fixes nodig waren)**

Geen commit als alles al groen is.

---

## File-overzicht (per task)

| Task | Create | Modify |
|---|---|---|
| 1 | `lib/modules/layout-actions.ts` + `.test.ts` | - |
| 2 | `modules/website-check/preview-fixture.ts`, `lib/modules/preview-data.ts` | - |
| 3 | `app/(admin)/admin/layouts/page.tsx`, `[slug]/page.tsx`, `sidebar.tsx` | `package.json` |
| 4 | `[slug]/layout-editor.tsx`, stubs voor editor-tab/preview-tab/version-history | - |
| 5 | `[slug]/section-item.tsx`, `block-item.tsx` | `[slug]/editor-tab.tsx` |
| 6 | `[slug]/hover-insert.tsx` | - |
| 7 | - | `[slug]/preview-tab.tsx` |
| 8 | - | `[slug]/version-history.tsx` |
| 9 | - | - |

Geen wijzigingen aan PR-L1 bestanden (`SECTIONS`, `getModuleLayout`, etc.) of consumer-pages.
