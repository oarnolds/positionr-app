# WYSIWYG Layout-editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de tabbed lijst-editor op `/admin/layouts/[slug]` door één
canvas met twee modi (Bewerken / Voorbeeld), waarop secties en vrije blokken
direct gerenderd én bewerkt kunnen worden.

**Architecture:** `LayoutEditor` wordt het frame (header, save/reset,
mode-state, dirty-detectie). Eronder zit één `LayoutCanvas` dat afhankelijk
van de modus ofwel een puur preview (Voorbeeld → `WebsiteCheckResultView`)
ofwel het bewerkbare canvas (Bewerken → `InlineSection`/`InlineBlock` +
`InsertStrip`) rendert. Sectie-componenten in `modules/website-check/sections.tsx`
krijgen één extra prop (`hideHeader`) zodat `InlineSection` zijn eigen
editable titel/intro kan tonen.

**Tech Stack:** Next.js 15 (App Router, client-components), React 19,
`@dnd-kit/core` + `@dnd-kit/sortable`, TipTap via bestaande
`RichPromptEditor`, Tailwind, `lucide-react` icons.

**Spec:** [docs/superpowers/specs/2026-06-15-layout-editor-wysiwyg-design.md](../specs/2026-06-15-layout-editor-wysiwyg-design.md)

**Verificatie:** UI-componenten worden niet unit-getest (spec besluit).
Elke task eindigt met een handmatige browser-check via `pnpm dev` op
`http://localhost:3000/admin/layouts/website-check`. Bestaande tests
(`lib/modules/layout*.test.ts`, `modules/website-check/*.test.ts`) moeten
groen blijven.

---

## Bestandsplan

**Nieuw:**

- `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx` — pill-toggle Bewerken/Voorbeeld
- `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx` — mode-aware renderer + DnD-context
- `app/(admin)/admin/layouts/[slug]/inline-section.tsx` — editable wrapper rond gerenderde sectie
- `app/(admin)/admin/layouts/[slug]/inline-block.tsx` — TipTap-blok + chrome
- `app/(admin)/admin/layouts/[slug]/insert-strip.tsx` — altijd-zichtbare "+ Vrij blok"

**Gewijzigd:**

- `modules/website-check/sections.tsx` — alle 7 sectie-componenten krijgen `hideHeader?: boolean`
- `app/(admin)/admin/layouts/[slug]/layout-editor.tsx` — `tab`-state → `mode`-state; toggle in toolbar; rendert `LayoutCanvas`

**Verwijderd (Task 9):**

- `app/(admin)/admin/layouts/[slug]/editor-tab.tsx`
- `app/(admin)/admin/layouts/[slug]/preview-tab.tsx`
- `app/(admin)/admin/layouts/[slug]/section-item.tsx`
- `app/(admin)/admin/layouts/[slug]/block-item.tsx`
- `app/(admin)/admin/layouts/[slug]/hover-insert.tsx`

---

## Task 1: `hideHeader`-prop op alle sectie-componenten

**Files:**
- Modify: `modules/website-check/sections.tsx`

Het type `SectionDef.Component` accepteert al `title` en `intro`. We voegen
een derde optionele prop `hideHeader?: boolean` toe. Bij `true` slaat de
component zowel zijn eigen `<h2>`/`<h3>` als de `<IntroP>` over.
`InlineSection` (Task 4) gebruikt dit om dubbele titels te voorkomen.

- [ ] **Step 1: Type-prop toevoegen aan `SectionDef`**

Vervang in `modules/website-check/sections.tsx` rond regel 8-14:

```ts
export type SectionDef = SectionMeta & {
  Component: (props: {
    data: WebsiteCheckOutput;
    title: string;
    intro: string | null;
    hideHeader?: boolean;
  }) => ReactNode;
};
```

- [ ] **Step 2: `ScoreBanner` aanpassen**

`ScoreBanner` rendert geen eigen `<h2>` maar wel `<IntroP>`. Voeg
`hideHeader?: boolean` toe en sla `IntroP` over wanneer true:

```tsx
function ScoreBanner({
  data,
  intro,
  hideHeader,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
  hideHeader?: boolean;
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
        {!hideHeader && <IntroP intro={intro} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Idem voor de overige 6 sectie-componenten**

Voor `ExecutiveSummary`, `OnderdelenGrid`, `SterkePunten`, `TopActions`
(naam in code kan afwijken — zoek op `<h2>` of `<h3>` + `IntroP`),
`Tone`, `Slot7` — voeg `hideHeader?: boolean` toe aan de props-type
**en** wikkel zowel het h2/h3-element als de `<IntroP>` in
`{!hideHeader && (...)}`. Voorbeeldpatroon (ExecutiveSummary):

```tsx
function ExecutiveSummary({
  data,
  title,
  intro,
  hideHeader,
}: {
  data: WebsiteCheckOutput;
  title: string;
  intro: string | null;
  hideHeader?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      {!hideHeader && (
        <>
          <h2 className="text-lg font-bold">{title}</h2>
          <IntroP intro={intro} />
        </>
      )}
      <p className="mt-2 text-gray-800">{data.executiveSummary}</p>
    </section>
  );
}
```

Hetzelfde patroon voor de overige componenten — gebruik
`grep -n 'function .*({' modules/website-check/sections.tsx` om de
component-defs te vinden.

- [ ] **Step 4: Verifieer dat bestaande tests groen blijven**

Run: `pnpm vitest run`
Expected: PASS — `lib/modules/layouts.test.ts`, `layout.test.ts`,
`layout-actions.test.ts`, en `modules/website-check/*.test.ts` blijven groen.
`hideHeader` is een nieuwe optionele prop; geen bestaande aanroep verandert.

- [ ] **Step 5: Smoke-test in browser**

Run: `pnpm dev`
Open: `http://localhost:3000/r/<willekeurige-share-slug>` (of een testpagina
die `WebsiteCheckResultView` gebruikt).
Expected: het resultaat ziet er ongewijzigd uit. (Geen consumer zet
`hideHeader=true` in deze stap.)

- [ ] **Step 6: Commit**

```bash
git add modules/website-check/sections.tsx
git commit -m "feat(layout): hideHeader-prop op section-componenten"
```

---

## Task 2: `ModeToggle`-component + mode-state in `LayoutEditor`

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`

Vervang de huidige `tab`-state (`"editor" | "preview"`) door `mode`
(`"edit" | "preview"`) en plaats de toggle als pill rechts naast
Opslaan/Reset. Voor deze task blijven `EditorTab` en `PreviewTab` nog in
gebruik onder de header — zodat de pagina blijft werken. De canvas wordt in
Task 3 vervangen.

- [ ] **Step 1: ModeToggle aanmaken**

Maak `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx`:

```tsx
"use client";

import { Edit3, Eye } from "lucide-react";

export type EditorMode = "edit" | "preview";

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (next: EditorMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-300 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("edit")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
          mode === "edit"
            ? "bg-purple-600 text-white"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Edit3 size={14} /> Bewerken
      </button>
      <button
        type="button"
        onClick={() => onChange("preview")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
          mode === "preview"
            ? "bg-purple-600 text-white"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Eye size={14} /> Voorbeeld
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `LayoutEditor` aanpassen — state, toolbar, render**

In `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`:

Vervang de regel `const [tab, setTab] = useState<Tab>("editor");` door:

```tsx
const [mode, setMode] = useState<EditorMode>("edit");
```

Vervang ook `type Tab = "editor" | "preview";` met een import:

```tsx
import { ModeToggle, type EditorMode } from "./mode-toggle";
```

Vervang het tabbed-blok (`<div className="flex border-b border-slate-200">...</div>`)
**en** de toggle-conditional (`{tab === "editor" ? ... : ...}`) door:

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-xl font-bold">Layout — {slug}</h1>
    {dirty && (
      <p className="text-xs text-amber-700">Niet-opgeslagen wijzigingen</p>
    )}
  </div>
  <div className="flex items-center gap-2">
    <button
      type="button"
      disabled={!dirty || isPending}
      onClick={handleSave}
      className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      Opslaan
    </button>
    <button
      type="button"
      onClick={handleReset}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
    >
      <RotateCcw size={16} /> Reset
    </button>
    <ModeToggle mode={mode} onChange={setMode} />
  </div>
</div>

{mode === "edit" ? (
  <EditorTab layout={layout} onChange={setLayout} />
) : (
  <PreviewTab layout={layout} data={previewData} />
)}
```

Verwijder het oude `<header>`-blok (de regels die hierdoor vervangen worden)
en de oude tab-balk. Behoud `<VersionHistory ... />` onderaan.

- [ ] **Step 3: Smoke-test**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`
Expected:
- Header heeft Opslaan, Reset, en daarnaast een pill met Bewerken/Voorbeeld.
- Klikken op Voorbeeld → live preview verschijnt (zoals voorheen Preview-tab).
- Klikken op Bewerken → oude lijst-editor verschijnt (zoals voorheen Editor-tab).
- Geen console-errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/mode-toggle.tsx \
        app/\(admin\)/admin/layouts/\[slug\]/layout-editor.tsx
git commit -m "feat(layout): ModeToggle pill in header + mode-state"
```

---

## Task 3: `LayoutCanvas`-frame (mode-aware renderer)

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`

Introduceer `LayoutCanvas` als één component dat de mode-switch overneemt
van `LayoutEditor`. Voor deze task delegeert het nog naar de bestaande
`EditorTab`/`PreviewTab`. Vanaf Task 4 vervangen we de inhoud stapsgewijs.

- [ ] **Step 1: LayoutCanvas aanmaken**

Maak `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx`:

```tsx
"use client";

import type { LayoutConfig } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

import type { EditorMode } from "./mode-toggle";
import { EditorTab } from "./editor-tab";
import { PreviewTab } from "./preview-tab";

export function LayoutCanvas({
  mode,
  layout,
  data,
  onChange,
}: {
  mode: EditorMode;
  layout: LayoutConfig;
  data: WebsiteCheckOutput;
  onChange: (next: LayoutConfig) => void;
}) {
  if (mode === "preview") {
    return <PreviewTab layout={layout} data={data} />;
  }
  return <EditorTab layout={layout} onChange={onChange} />;
}
```

- [ ] **Step 2: `LayoutEditor` gebruikt `LayoutCanvas`**

In `layout-editor.tsx`:

Vervang de imports van `EditorTab` en `PreviewTab` door:

```tsx
import { LayoutCanvas } from "./layout-canvas";
```

Vervang het mode-conditional renderingsblok door:

```tsx
<LayoutCanvas
  mode={mode}
  layout={layout}
  data={previewData}
  onChange={setLayout}
/>
```

- [ ] **Step 3: Smoke-test**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`
Expected: gedrag identiek aan Task 2 (toggle wisselt nog steeds tussen
oude editor en oude preview). Geen console-errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/layout-canvas.tsx \
        app/\(admin\)/admin/layouts/\[slug\]/layout-editor.tsx
git commit -m "feat(layout): LayoutCanvas frame voor mode-switch"
```

---

## Task 4: `InlineSection`-component (editable wrapper + chrome)

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/inline-section.tsx`

`InlineSection` rendert in Bewerken-modus per sectie-item:
1. Een chrome-balk bovenop met drag-handle, oogje (zichtbaarheid) en
   prullenbak (= verbergen, want secties worden niet uit de array gehaald).
2. Een editable header: input voor titel (looks like h2), textarea voor
   intro.
3. De sectie-component zelf met `hideHeader={true}` zodat alleen de body
   rendert.

Verborgen secties krijgen `opacity-50` + een "verborgen"-badge + een
"Aan"-knop in plaats van het oog-uit-icoon.

Voor deze task gebruiken we nog **geen** `useSortable` — drag-drop komt
in Task 8 erbij. We laten de drag-handle wel zichtbaar staan (cosmetisch),
maar zonder functionaliteit.

- [ ] **Step 1: Component aanmaken**

Maak `app/(admin)/admin/layouts/[slug]/inline-section.tsx`:

```tsx
"use client";

import { Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";

import { SECTIONS } from "@/modules/website-check/sections";
import type { LayoutItem } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

type SectionLayoutItem = Extract<LayoutItem, { kind: "section" }>;

export function InlineSection({
  item,
  data,
  onChange,
}: {
  item: SectionLayoutItem;
  data: WebsiteCheckOutput;
  onChange: (patch: Partial<SectionLayoutItem>) => void;
}) {
  const def = SECTIONS.find((s) => s.id === item.id);

  if (!def) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        Sectie-id <span className="font-mono">{item.id}</span> bestaat niet
        meer in code.
      </div>
    );
  }

  const Component = def.Component;
  const titleValue = item.title ?? "";
  const introValue = item.intro ?? "";
  const isHidden = !item.visible;

  return (
    <div
      className={`group relative rounded-lg border-2 border-dashed border-slate-200 p-3 ${
        isHidden ? "opacity-50" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-700"
          aria-label="Sleep om te herordenen"
        >
          <GripVertical size={16} />
        </button>
        <span className="text-xs font-mono text-slate-400">{def.id}</span>
        {isHidden && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
            verborgen
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => onChange({ visible: !item.visible })}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={item.visible ? "Verbergen" : "Tonen"}
            title={item.visible ? "Verbergen" : "Tonen"}
          >
            {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onChange({ visible: false })}
            className="rounded p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-600"
            aria-label="Sectie verbergen (prullenbak)"
            title="Sectie verbergen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={titleValue}
        placeholder={def.defaultTitle}
        onChange={(e) => onChange({ title: e.target.value || null })}
        className="mb-1 w-full border-0 bg-transparent text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-300"
      />
      <textarea
        value={introValue}
        placeholder="Optionele inleiding (laat leeg om over te slaan)"
        rows={1}
        onChange={(e) => onChange({ intro: e.target.value || null })}
        className="mb-3 w-full resize-none border-0 bg-transparent text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-300"
      />

      <Component
        data={data}
        title={titleValue || def.defaultTitle}
        intro={null}
        hideHeader
      />
    </div>
  );
}
```

- [ ] **Step 2: Geen consumer, geen verifieerbaar gedrag**

`InlineSection` wordt in Task 5 ingebracht in `LayoutCanvas`. Voor nu:
typecheck-controle.

Run: `pnpm tsc --noEmit`
Expected: PASS — geen type-errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/inline-section.tsx
git commit -m "feat(layout): InlineSection met editable header + chrome"
```

---

## Task 5: `LayoutCanvas` rendert `InlineSection` in Bewerken-modus

**Files:**
- Modify: `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx`

Vervang in `LayoutCanvas` (Bewerken-modus) de delegatie aan `EditorTab`
door zelf de items te itereren. Sectie-items renderen met `InlineSection`;
blok-items vallen tijdelijk terug op het oude `BlockItem` (Task 6 vervangt
dat).

- [ ] **Step 1: LayoutCanvas uitbreiden**

Vervang de huidige inhoud van `layout-canvas.tsx` door:

```tsx
"use client";

import type { LayoutConfig, LayoutItem } from "@/lib/modules/layout";
import type { WebsiteCheckOutput } from "@/modules/website-check/schema";

import type { EditorMode } from "./mode-toggle";
import { PreviewTab } from "./preview-tab";
import { InlineSection } from "./inline-section";
import { BlockItem } from "./block-item";

export function LayoutCanvas({
  mode,
  layout,
  data,
  onChange,
}: {
  mode: EditorMode;
  layout: LayoutConfig;
  data: WebsiteCheckOutput;
  onChange: (next: LayoutConfig) => void;
}) {
  if (mode === "preview") {
    return <PreviewTab layout={layout} data={data} />;
  }

  function updateItem(idx: number, patch: Partial<LayoutItem>) {
    const next = [...layout.items];
    next[idx] = { ...next[idx], ...patch } as LayoutItem;
    onChange({ ...layout, items: next });
  }

  function removeBlock(idx: number) {
    onChange({ ...layout, items: layout.items.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      {layout.items.map((item, idx) => {
        if (item.kind === "section") {
          return (
            <InlineSection
              key={`section-${item.id}`}
              item={item}
              data={data}
              onChange={(patch) => updateItem(idx, patch)}
            />
          );
        }
        return (
          <BlockItem
            key={`block-${item.id}`}
            item={item}
            onChange={(patch) => updateItem(idx, patch)}
            onRemove={() => removeBlock(idx)}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Smoke-test in browser**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`

Expected:
- Bewerken-modus toont elke sectie als gerenderde body (score-banner met
  echte data, samenvatting, etc.) in een dashed kader, met editable titel
  en intro erboven.
- Oogje-knop wisselt zichtbaarheid (faded weergave).
- Prullenbak verbergt de sectie (faded weergave).
- Vrije blokken renderen nog in de oude amber-stijl `BlockItem`.
- Voorbeeld-modus toont nog steeds de PreviewTab.
- Wijzig titel → klik Opslaan → herlaad → titel blijft.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/layout-canvas.tsx
git commit -m "feat(layout): LayoutCanvas rendert InlineSection in Bewerken"
```

---

## Task 6: `InlineBlock`-component + gebruik in `LayoutCanvas`

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/inline-block.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx`

`InlineBlock` is een vrij Markdown-blok met TipTap (hergebruikt
`RichPromptEditor`) en compacte chrome (drag-handle + trash). Geen
amber-styling meer — neutrale dashed border zoals secties.

- [ ] **Step 1: InlineBlock aanmaken**

Maak `app/(admin)/admin/layouts/[slug]/inline-block.tsx`:

```tsx
"use client";

import { GripVertical, Trash2 } from "lucide-react";

import { RichPromptEditor } from "@/components/rich-prompt-editor";
import type { LayoutItem } from "@/lib/modules/layout";

type BlockLayoutItem = Extract<LayoutItem, { kind: "block" }>;

export function InlineBlock({
  item,
  onChange,
  onRemove,
}: {
  item: BlockLayoutItem;
  onChange: (patch: Partial<BlockLayoutItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative rounded-lg border-2 border-dashed border-slate-200 p-3">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-700"
          aria-label="Sleep om te herordenen"
        >
          <GripVertical size={16} />
        </button>
        <span className="text-xs font-mono uppercase tracking-wide text-slate-400">
          Vrij blok
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-600"
          aria-label="Blok verwijderen"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <RichPromptEditor
        value={item.markdown}
        onChange={(markdown) => onChange({ markdown })}
        placeholder="Schrijf vrije content (Markdown ondersteund)…"
      />
    </div>
  );
}
```

- [ ] **Step 2: LayoutCanvas gebruikt InlineBlock**

In `layout-canvas.tsx`: vervang de import `import { BlockItem } from "./block-item";`
door:

```tsx
import { InlineBlock } from "./inline-block";
```

Vervang het block-rendering blok door:

```tsx
return (
  <InlineBlock
    key={`block-${item.id}`}
    item={item}
    onChange={(patch) => updateItem(idx, patch)}
    onRemove={() => removeBlock(idx)}
  />
);
```

- [ ] **Step 3: Smoke-test**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`
Expected:
- Vrije blokken renderen nu in dezelfde dashed-stijl als secties (niet meer
  amber).
- TipTap editor werkt; typen werkt; Opslaan → herladen → content blijft.
- Trash verwijdert het blok uit de lijst.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/inline-block.tsx \
        app/\(admin\)/admin/layouts/\[slug\]/layout-canvas.tsx
git commit -m "feat(layout): InlineBlock met TipTap inline"
```

---

## Task 7: `InsertStrip`-component tussen items

**Files:**
- Create: `app/(admin)/admin/layouts/[slug]/insert-strip.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx`

`InsertStrip` is altijd zichtbaar in Bewerken-modus (in tegenstelling tot
de oude `HoverInsert`). Plaats vóór het eerste item, tussen elk paar, en
ná het laatste.

- [ ] **Step 1: InsertStrip aanmaken**

Maak `app/(admin)/admin/layouts/[slug]/insert-strip.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";

export function InsertStrip({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="relative h-6">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-200" />
      <button
        type="button"
        onClick={onInsert}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-slate-300 bg-white px-3 py-0.5 text-xs text-slate-500 hover:border-purple-400 hover:text-purple-700"
      >
        <span className="inline-flex items-center gap-1">
          <Plus size={12} />
          Vrij blok invoegen
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: LayoutCanvas plaatst InsertStrip tussen alle items**

In `layout-canvas.tsx`:

Voeg toe aan de imports:

```tsx
import { InsertStrip } from "./insert-strip";
```

Voeg een `insertBlock`-handler toe boven `return`:

```tsx
function insertBlock(atIdx: number) {
  const newBlock: LayoutItem = {
    kind: "block",
    id: crypto.randomUUID(),
    markdown: "",
  };
  onChange({
    ...layout,
    items: [
      ...layout.items.slice(0, atIdx),
      newBlock,
      ...layout.items.slice(atIdx),
    ],
  });
}
```

Wijzig de render-loop zodat tussen elke twee items (en aan begin en eind)
een `InsertStrip` zit:

```tsx
return (
  <div className="space-y-1">
    <InsertStrip onInsert={() => insertBlock(0)} />
    {layout.items.map((item, idx) => (
      <div key={item.kind === "section" ? `section-${item.id}` : `block-${item.id}`}>
        {item.kind === "section" ? (
          <InlineSection
            item={item}
            data={data}
            onChange={(patch) => updateItem(idx, patch)}
          />
        ) : (
          <InlineBlock
            item={item}
            onChange={(patch) => updateItem(idx, patch)}
            onRemove={() => removeBlock(idx)}
          />
        )}
        <InsertStrip onInsert={() => insertBlock(idx + 1)} />
      </div>
    ))}
  </div>
);
```

- [ ] **Step 3: Smoke-test**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`
Expected:
- Een dunne dashed lijn met "+ Vrij blok invoegen"-knop is **altijd**
  zichtbaar tussen elk paar items (en vóór het eerste / ná het laatste).
- Klik → nieuw vrij blok komt op die plek met TipTap-editor.
- Opslaan → herladen → blok blijft op die plek.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/insert-strip.tsx \
        app/\(admin\)/admin/layouts/\[slug\]/layout-canvas.tsx
git commit -m "feat(layout): InsertStrip altijd zichtbaar tussen items"
```

---

## Task 8: Drag-drop herinrichten op `LayoutCanvas`

**Files:**
- Modify: `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/inline-section.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/inline-block.tsx`

Verplaats `DndContext` + `SortableContext` van de verwijderde `EditorTab`
naar `LayoutCanvas` (Bewerken-modus). Maak `InlineSection` en `InlineBlock`
sortable via `useSortable`.

- [ ] **Step 1: InlineSection sortable maken**

In `inline-section.tsx`:

Voeg imports toe:

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

Voeg in het component-body toe (boven `if (!def) ...`):

```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
  useSortable({ id: `section-${item.id}` });
const dragStyle = {
  transform: CSS.Transform.toString(transform),
  transition,
  // Alleen tijdens drag een inline opacity zetten — anders zou het de
  // Tailwind-class `opacity-50` voor verborgen secties overschrijven.
  ...(isDragging ? { opacity: 0.5 } : {}),
};
```

Vervang het buitenste `<div>` met:

```tsx
<div
  ref={setNodeRef}
  style={dragStyle}
  className={`group relative rounded-lg border-2 border-dashed border-slate-200 p-3 ${
    isHidden ? "opacity-50" : ""
  }`}
>
```

Vervang de drag-handle `<button>` met:

```tsx
<button
  type="button"
  {...attributes}
  {...listeners}
  className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-700"
  aria-label="Sleep om te herordenen"
>
  <GripVertical size={16} />
</button>
```

- [ ] **Step 2: InlineBlock sortable maken**

Analoog in `inline-block.tsx`:

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

In de body:

```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
  useSortable({ id: `block-${item.id}` });
const dragStyle = {
  transform: CSS.Transform.toString(transform),
  transition,
  ...(isDragging ? { opacity: 0.5 } : {}),
};
```

Buitenste `<div>` wordt:

```tsx
<div
  ref={setNodeRef}
  style={dragStyle}
  className="group relative rounded-lg border-2 border-dashed border-slate-200 p-3"
>
```

Drag-handle krijgt `{...attributes} {...listeners}` toegevoegd.

- [ ] **Step 3: DndContext + SortableContext in LayoutCanvas**

In `layout-canvas.tsx`:

Voeg imports toe:

```tsx
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
```

Helper bovenaan het bestand (buiten component):

```tsx
function itemKey(item: LayoutItem): string {
  return `${item.kind}-${item.id}`;
}
```

In de component-body (Bewerken-tak):

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
);

function handleDragEnd(e: DragEndEvent) {
  const { active, over } = e;
  if (!over || active.id === over.id) return;
  const oldIdx = layout.items.findIndex((i) => itemKey(i) === active.id);
  const newIdx = layout.items.findIndex((i) => itemKey(i) === over.id);
  if (oldIdx === -1 || newIdx === -1) return;
  onChange({ ...layout, items: arrayMove(layout.items, oldIdx, newIdx) });
}
```

Wikkel de huidige `return (...)` (de Bewerken-tak) in:

```tsx
return (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={handleDragEnd}
  >
    <SortableContext
      items={layout.items.map(itemKey)}
      strategy={verticalListSortingStrategy}
    >
      <div className="space-y-1">
        <InsertStrip onInsert={() => insertBlock(0)} />
        { /* ... bestaande map ... */ }
      </div>
    </SortableContext>
  </DndContext>
);
```

- [ ] **Step 4: Smoke-test**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`
Expected:
- Drag grip → sleep een sectie naar boven of onder een andere → volgorde
  wijzigt en blijft tijdens slepen visueel correct.
- Drag werkt ook voor vrije blokken.
- Toetsenbord-navigatie (focus op handle + spatie + pijltjes) werkt.
- Opslaan → herladen → nieuwe volgorde blijft.
- Voorbeeld-modus respecteert de nieuwe volgorde.

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/layouts/\[slug\]/layout-canvas.tsx \
        app/\(admin\)/admin/layouts/\[slug\]/inline-section.tsx \
        app/\(admin\)/admin/layouts/\[slug\]/inline-block.tsx
git commit -m "feat(layout): drag-drop reorder op LayoutCanvas"
```

---

## Task 9: Cleanup — verwijder oude tab-componenten

**Files:**
- Delete: `app/(admin)/admin/layouts/[slug]/editor-tab.tsx`
- Delete: `app/(admin)/admin/layouts/[slug]/preview-tab.tsx`
- Delete: `app/(admin)/admin/layouts/[slug]/section-item.tsx`
- Delete: `app/(admin)/admin/layouts/[slug]/block-item.tsx`
- Delete: `app/(admin)/admin/layouts/[slug]/hover-insert.tsx`
- Modify: `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx` (vervang `PreviewTab`-gebruik)

`PreviewTab` was de Voorbeeld-modus van `LayoutCanvas`. We rollen die
ene render direct in `LayoutCanvas` zodat we de file kunnen weggooien.

- [ ] **Step 1: PreviewTab-render inline maken**

In `layout-canvas.tsx`:

Vervang de import `import { PreviewTab } from "./preview-tab";` door:

```tsx
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
```

Vervang de Voorbeeld-tak:

```tsx
if (mode === "preview") {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
        Live preview met huidige edit-state. Wijzigingen worden pas zichtbaar
        voor klanten na <strong>Opslaan</strong>.
      </div>
      <WebsiteCheckResultView data={data} layout={layout} readOnly />
    </div>
  );
}
```

- [ ] **Step 2: Oude files verwijderen**

```bash
rm app/\(admin\)/admin/layouts/\[slug\]/editor-tab.tsx
rm app/\(admin\)/admin/layouts/\[slug\]/preview-tab.tsx
rm app/\(admin\)/admin/layouts/\[slug\]/section-item.tsx
rm app/\(admin\)/admin/layouts/\[slug\]/block-item.tsx
rm app/\(admin\)/admin/layouts/\[slug\]/hover-insert.tsx
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS — geen achtergebleven imports naar de verwijderde files.

- [ ] **Step 4: Bestaande testsuite**

Run: `pnpm vitest run`
Expected: PASS — alle tests blijven groen (geen tests verwijderd of
toegevoegd).

- [ ] **Step 5: Smoke-test in browser**

Run: `pnpm dev`
Open: `http://localhost:3000/admin/layouts/website-check`
Expected:
- Bewerken werkt identiek aan Task 8.
- Voorbeeld toont de result-view met dezelfde "Live preview"-strook
  bovenaan.
- Wisselen tussen modi werkt.
- Save, Reset, Version-history werken zoals voor de refactor.

- [ ] **Step 6: Commit**

```bash
git add -A app/\(admin\)/admin/layouts/\[slug\]/
git commit -m "chore(layout): verwijder oude tab-componenten"
```
