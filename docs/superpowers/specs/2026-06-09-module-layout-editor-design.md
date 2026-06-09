# Module Layout Editor — ontwerp (v1)

- **Datum:** 2026-06-09
- **Status:** Ontwerp ter review
- **Repo:** `oarnolds/positionr-app` (Next.js App Router, Supabase, Drizzle, Claude)
- **Referentie:** `docs/superpowers/specs/2026-05-20-admin-prompt-editor-design.md`
  — zelfde patroon (registry + DB-driven met code-fallback + version-history)
  wordt hier toegepast voor de **layout** van de result-view, parallel naast
  de prompt-editor.

## 1. Doel & context

Admins kunnen via `/admin/prompts/[slug]` al de **prompt** wijzigen die naar
Claude gaat. Wat ze nog niet kunnen: de **layout** van de result-view
aanpassen — secties herordenen, titels overschrijven, secties verbergen, vrije
Markdown-blokken invoegen. Voor iteratieve UX-experimenten zonder code-deploy.

Doel volgens brainstorm: één layout per module, iteratief tweaken. Geen
multi-layout-per-scenario, geen white-label, geen per-klant overrides.

In **fase 1** (deze spec) doen we alleen **Website Check**. ICP volgt in een
aparte spec — die view heeft meer secties en een andere refactor-uitdaging.

## 2. Scope

**In v1**

- DB-laag: `modules.layout_config` (jsonb, nullable) + `module_layout_history`
- Zod-schema `LayoutConfig` met versionering (`version: 1`)
- `getModuleLayout(slug)` helper (DB-fetch met code-fallback)
- `defaultLayoutFor(slug)` helper (bouwt default uit SECTIONS-registry)
- SECTIONS-registry voor Website Check (7 bouwblokken)
- Refactor van `WebsiteCheckResultView` naar config-driven render
- Admin-UI op `/admin/layouts/[slug]`:
  - Sidebar met module-lijst (gefilterd, geen sub-prompts)
  - Drag-and-drop reorder (`@dnd-kit/core` + `@dnd-kit/sortable`)
  - Per sectie: visible-toggle, titel-override, intro-textarea
  - Vrije blokken via TipTap → Markdown opgeslagen
  - Save / Reset naar default / Versie-historie (zelfde patroon als prompts)
- RLS volgens projectpatroon
- Tests (vitest): default-builder, schema-validatie, save/reset/restore

**Buiten v1**

- ICP `FinalIcpView` config-driven maken (aparte spec, fase 2)
- Live preview in de admin-editor (admin test via echte analyse)
- Visuele styling (kleuren, spacing, dichtheid) — design-systeem-onderwerp
- Multi-layout per tier/persona/klant — bewust niet
- Markdown-rendering met geavanceerde features (custom syntax, embeds)

## 3. Architectuurkeuze: section-registry + JSON-config

Onderzochte alternatieven:

- **A — Section-registry + JSON-config** (gekozen). Code definieert per module
  een vaste set bouwblokken; admin configureert volgorde, zichtbaarheid,
  titel-overrides en vrije blokken in een JSON-config. ✅ voorspelbaar,
  validatie-vriendelijk, discovery via UI. ❌ beperkt tot vooraf gedefinieerde
  blokken — totaal nieuwe layout-elementen vragen code.
- **B — Markdown-template met macro's.** Admin schrijft vrije Markdown met
  macros (`{{score-banner}}`). Maximale vrijheid maar tikfouten worden
  letterlijke tekst, geen visuele guardrails. **YAGNI** voor iteratief tweaken.
- **C — Alleen toggle + slot-blokken.** Geen volgorde, geen titel-overrides.
  Dekt niet de scope (4 dimensies: titels, toggle, volgorde, blokken).

**A** is de sweet-spot: gestructureerd genoeg om robuust te zijn, flexibel
genoeg voor de gekozen scope, admin-UX past natuurlijk bij de bestaande
prompt-editor.

## 4. Data-laag

### 4.1 DB-migratie (Drizzle / Postgres)

```sql
ALTER TABLE modules
  ADD COLUMN layout_config jsonb;   -- NULL = gebruik default uit registry

CREATE TABLE module_layout_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug   text NOT NULL REFERENCES modules(slug) ON DELETE CASCADE,
  layout_config jsonb NOT NULL,
  saved_by      uuid NOT NULL,          -- = auth.users.id (admin)
  saved_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX module_layout_history_module_idx
  ON module_layout_history(module_slug, saved_at DESC);
```

### 4.2 RLS

```sql
alter table module_layout_history enable row level security;

create policy "module_layout_history admin all"
  on module_layout_history for all
  using (
    exists (select 1 from profiles
            where profiles.id = auth.uid() and profiles.role = 'admin')
  );
```

`modules.layout_config`-kolom erft de bestaande RLS van `modules`
(public read, admin write) — geen extra policy nodig.

### 4.3 Zod-schema (`lib/modules/layout.ts`)

```ts
import { z } from "zod";

export const LayoutItem = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("section"),
    id: z.string(),                  // bv. "score-banner"
    title: z.string().nullable(),    // null = default uit registry
    intro: z.string().nullable(),    // optioneel
    visible: z.boolean(),
  }),
  z.object({
    kind: z.literal("block"),
    id: z.string(),                  // uniek (bv. uuid bij aanmaken)
    markdown: z.string(),
  }),
]);

export const LayoutConfig = z.object({
  version: z.literal(1),
  items: z.array(LayoutItem),
});
export type LayoutConfig = z.infer<typeof LayoutConfig>;
```

### 4.4 Save / Reset / Restore-flows

| Actie | Stappen |
|---|---|
| **Save** | Snapshot huidige `layout_config` → `module_layout_history`. Update `modules.layout_config` met nieuwe waarde. |
| **Reset** | Snapshot huidige → history. Set `modules.layout_config = NULL` (vanaf nu default). |
| **Restore (uit history)** | Snapshot huidige → history. Update `modules.layout_config` ← waarde uit gekozen history-rij. |

Idempotente order (history-write eerst). Transacties: Supabase JS-client heeft
geen native transacties — twee schrijfacties ge-orderd, crash op stap 2 = extra
history-rij, geen verlies.

## 5. SECTIONS-registry (per module)

Voor Website Check definieren we 7 bouwblokken in `modules/website-check/sections.ts`:

```ts
import type { LucideIcon } from "lucide-react";
import type { WebsiteCheckOutput } from "./schema";

export type SectionDef = {
  id: string;
  defaultTitle: string;
  description: string;        // voor admin-UI: korte omschrijving
  Component: React.ComponentType<{
    data: WebsiteCheckOutput;
    title: string;
    intro: string | null;
  }>;
};

export const SECTIONS: SectionDef[] = [
  { id: "score-banner", defaultTitle: "Overall score", description: "Paarse banner met overall score + samenvattende zin", Component: ScoreBanner },
  { id: "executive-summary", defaultTitle: "Samenvatting", description: "Korte uitleg-paragraaf", Component: ExecutiveSummary },
  { id: "onderdelen-grid", defaultTitle: "Score per onderdeel", description: "Grid met 11 sub-score-kaarten", Component: OnderdelenGrid },
  { id: "sterke-punten", defaultTitle: "Top 3 sterke punten", description: "Bullets met sterke punten", Component: SterkePunten },
  { id: "verbeterpunten", defaultTitle: "Top 3 verbeterpunten", description: "Bullets met verbeterpunten", Component: Verbeterpunten },
  { id: "top-acties", defaultTitle: "Top 5 prioriteitsacties", description: "Genummerde lijst met acties + impact-badges", Component: TopActies },
  { id: "aanvullende-info", defaultTitle: "Aanvullende info", description: "Dynamische extras uit de admin-prompt (passthrough-velden)", Component: AanvullendeInfo },
];
```

Elke `Component` is een klein, gefocust React-element. Bestaande
`WebsiteCheckResultView` wordt opgesplitst — geen logica-wijziging, alleen
structuur.

## 6. Runtime-integratie

### 6.1 `getModuleLayout(slug)`

```ts
// lib/modules/layouts.ts
export async function getModuleLayout(slug: string): Promise<LayoutConfig> {
  const [row] = await db
    .select({ layoutConfig: modules.layoutConfig })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (!row) throw new Error(`Module ${slug} niet in DB`);
  if (!row.layoutConfig) return defaultLayoutFor(slug);
  const parsed = LayoutConfig.safeParse(row.layoutConfig);
  if (!parsed.success) {
    console.warn(`[layout] corrupt config voor ${slug} — fallback op default`);
    return defaultLayoutFor(slug);
  }
  return parsed.data;
}
```

### 6.2 `defaultLayoutFor(slug)`

Per module mapping van slug → SECTIONS. Bouwt config met alle secties zichtbaar
in registry-volgorde, geen overrides:

```ts
function defaultLayoutFor(slug: string): LayoutConfig {
  const sections = SECTIONS_BY_SLUG[slug];
  if (!sections) throw new Error(`Geen SECTIONS-registry voor ${slug}`);
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
```

### 6.3 Result-pages (consumers — twee plekken!)

`WebsiteCheckResultView` wordt op **twee plekken** gerenderd. Beide moeten
`getModuleLayout` aanroepen en de config doorgeven:

```tsx
// app/(app)/modules/website-check/[sessionId]/page.tsx   (ingelogd)
const layout = await getModuleLayout("website-check");
return <WebsiteCheckResultView data={parsed.data} config={layout} />;
```

```tsx
// app/(marketing)/gratis-check/[id]/page.tsx              (publiek)
const layout = await getModuleLayout("website-check");
return <WebsiteCheckResultView data={parsed.data} config={layout} readOnly />;
```

Beide pages krijgen automatisch admin-layout-aanpassingen mee. Geen aparte
configs voor gratis vs. ingelogd in v1 — admin tweaked één layout voor beide.

### 6.4 Nieuwe `WebsiteCheckResultView`

```tsx
export function WebsiteCheckResultView({
  data,
  config,
}: {
  data: WebsiteCheckOutput;
  config: LayoutConfig;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {config.items.map((item, idx) => {
        if (item.kind === "block") {
          return <MarkdownBlock key={item.id} markdown={item.markdown} />;
        }
        if (!item.visible) return null;
        const def = SECTIONS.find((s) => s.id === item.id);
        if (!def) return null; // section verwijderd uit code
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

### 6.5 `MarkdownBlock`-component

Markdown → HTML via `marked` (al in deps), gerenderd met
`dangerouslySetInnerHTML`. Admin is trusted; geen sanitization-laag in v1. De
TipTap-editor in de admin laat geen raw HTML toe (zelfde config als
RichPromptEditor) — extra defense.

## 7. Admin-UI op `/admin/layouts/[slug]`

### 7.1 Routes & sidebar

- `/admin/layouts` → redirect naar `/admin/layouts/website-check` (eerste actieve)
- `/admin/layouts/[slug]` → editor voor die module
- Sidebar (hergebruikt patroon van prompts-sidebar): module-lijst, gefilterd
  op `!parentSlug`. Bovenaan elke detail-pane: link-balkje **Prompt | Layout**
  om binnen één module te schakelen.

### 7.2 Editor-pane layout

```
┌────────────────────────────────────────────────────────────┐
│ Layout — Website Check                       [💾 Opslaan]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ⠿ ☑️ score-banner                                           │
│   Titel:  [Overall score                              ]    │
│   Intro:  [                                           ]    │
│   (Paarse banner met overall score + samenvattende zin)    │
│                                                            │
│ ── (+ vrij blok invoegen) ──                               │
│                                                            │
│ ⠿ ☑️ executive-summary                                      │
│   Titel:  [Samenvatting in één blik                   ]    │
│   …                                                        │
│                                                            │
│ ⠿ 📝 Vrij blok                                  [× weg]     │
│   [TipTap-editor]                                          │
│                                                            │
│ ⠿ ☐ onderdelen-grid     (verborgen)                         │
│   …                                                        │
│                                                            │
│ [↺ Reset naar default]            ▾ Versie-historie (3)    │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Drag-and-drop

Library: `@dnd-kit/core` + `@dnd-kit/sortable`. Modern, toegankelijk (a11y
keyboard-support), ~30kB gzipped. Reden om niet voor pijl-knoppen te kiezen:
de hoofdgebruiker (Olivier) gaat 21 modules iteratief tweaken — drag-drop is
veel sneller.

### 7.4 Vrij-blok-editor

Hergebruik `RichPromptEditor` (bestaand, TipTap). Output: Markdown via
`turndown`. Geen raw HTML-input toegestaan.

### 7.5 Dirty-state

Wisselen van module met onopgeslagen wijzigingen → confirm-dialog.
`beforeunload` met dirty → browser-prompt.

## 8. Foutafhandeling

| Geval | Afhandeling |
|---|---|
| `modules.layout_config` is NULL | Default uit registry — alles werkt zoals nu |
| Corrupt JSON in DB | Zod safeParse faalt → fallback default + console.warn |
| `section.id` bestaat niet meer in code (oudere config) | Skip dat item, render de rest |
| Markdown in vrij blok bevat `<script>` | Admin is trusted; TipTap-editor staat geen raw HTML toe (defense) |
| Config met 0 items (admin heeft alles weggehaald) | Fallback default — lege view is nooit gewenst |
| `dnd-kit` reorder leidt tot duplicaat-ids in `block`-items | Block-ids worden bij aanmaak als `crypto.randomUUID()` gegenereerd; duplicaten zijn praktisch onmogelijk |

## 9. Testing (vitest, bestaand)

| Niveau | Wat |
|---|---|
| Unit | `defaultLayoutFor('website-check')` — bevat alle 7 secties in registry-volgorde, alles visible |
| Unit | `LayoutConfig.safeParse` — valide config slaagt, corrupte JSON faalt |
| Unit | `getModuleLayout` — null DB-veld → default, gevulde rij → parsed |
| Unit | Save/Reset/Restore-server-actions tegen testdatabase (mock) |
| Smoke (prod) | Eén Website Check-analyse na deploy met aangepaste config: zien dat layout matcht |

Geen React-component-tests (geen RTL-setup in dit project — typecheck + smoke).

## 10. Rollout — drie PR's

1. **PR-L1: Data-laag + registry + refactor.** DB-migratie, `LayoutConfig`-
   schema, `getModuleLayout`, `defaultLayoutFor`, SECTIONS-registry voor
   Website Check, `WebsiteCheckResultView`-refactor naar config-driven.
   Tests. Eindgebruik: default-config wordt automatisch toegepast, geen UI
   nodig. Niet-disruptief.
2. **PR-L2: Admin-editor.** `/admin/layouts/[slug]` route, sidebar
   (Prompt | Layout-toggle), drag-drop, save/reset/version-history. Tests.
   Admin kan vanaf nu echt tweaken.
3. **PR-L3 (latere spec):** ICP `FinalIcpView` idem refactoren. Apart omdat
   de view ~10 secties heeft en complexere data-shape.

Elke PR is apart deploybaar/revertbaar.

## 11. Risico's & onbekenden

| Risico | Impact | Mitigatie |
|---|---|---|
| Refactor van `WebsiteCheckResultView` introduceert visuele regressies | Klanten zien iets anders dan voorheen | Default-config produceert identieke output als nu; smoke-test na PR-L1 |
| Admin slaat per ongeluk een onbruikbare config (alles verborgen) | Lege result-view voor échte klanten | Fallback naar default bij 0 items; admin kan altijd resetten |
| `@dnd-kit`-deps wijzigen na release | Drag-drop breekt | Pin op major version; tests in PR-L2 dekken happy-path |
| TipTap roundtrip Markdown→HTML→Markdown niet lossless | Admin verliest formatting | Bestaand probleem in RichPromptEditor, daar al opgelost via `suppressNextEmit`-flag |
| Te veel vrije blokken bij elkaar maken view onleesbaar | UX-degradatie | Buiten v1 te bewaken; later evt. soft-limit |

## 12. Acceptatiecriteria

- DB-migratie toegepast, `layout_config` op modules, `module_layout_history`
  bestaat met RLS aan
- `WebsiteCheckResultView` is config-driven; default-config produceert
  visueel identiek resultaat aan de huidige view (regressie-test via 1
  bestaande sessie)
- Admin kan op `/admin/layouts/website-check`:
  - Secties slepen om te reorderen
  - Visibility togglen
  - Titel + intro overschrijven
  - Vrij Markdown-blok invoegen tussen secties
  - Opslaan + zien in version-history + terugzetten naar oude versie
  - Reset naar default
- Tests (vitest) voor `defaultLayoutFor`, `LayoutConfig`-schema,
  `getModuleLayout`-fallback en save/reset/restore blijven groen
- Bestaande Website Check-tests blijven groen
- Geen secrets/credentials in code; geen breaking changes voor de
  publieke `/gratis-check`-flow
