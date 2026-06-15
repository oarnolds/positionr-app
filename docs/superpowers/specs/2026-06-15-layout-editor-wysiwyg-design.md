# Spec — WYSIWYG Layout-editor (optie C, twee modi)

**Datum:** 2026-06-15
**Module:** admin / layouts
**Status:** ontwerp, klaar voor implementatieplan

## Probleem

De huidige `/admin/layouts/[slug]` is een lijst-editor met een aparte
Preview-tab. Je ziet aanpassingen niet in context, je moet steeds
wisselen om te checken hoe het eruit ziet, en de lijst-rijen lijken in
niets op de uiteindelijke output.

## Doel

Eén editor-canvas dat de gerenderde output toont en waarop alles
direct te bewerken is. Twee modi:

- **Bewerken** — alle edit-chrome zichtbaar; titels/intro's
  contenteditable; markdown-blokken in een TipTap-editor; drag-drop
  reorder; "+ Vrij blok"-strips tussen items.
- **Voorbeeld** — pixel-identiek aan `/r/[shareSlug]`: geen chrome,
  alleen visible items.

Toggle als pill **rechts naast Opslaan/Reset** in de header.

## Wat blijft 1-op-1

- Route `/admin/layouts/[slug]` en page-level data-fetch.
- Server-actions: `saveModuleLayout`, `resetModuleLayout`,
  `restoreModuleLayout`, `getLayoutHistory`.
- Zod-schema `LayoutConfig` (versie 1).
- `SECTIONS`-registry in `modules/website-check/sections.ts`.
- `WebsiteCheckResultView` als renderer in Voorbeeld-modus en als
  ground-truth voor de output.
- `VersionHistory`-accordion met restore + confirm-dialog.
- Dirty-state-detectie via `baselineRef` in `LayoutEditor`.

## Wat vervalt

- `EditorTab` (lijst met rijen) — vervangen.
- `PreviewTab` (aparte tab) — opgaat in het canvas (Voorbeeld-modus).
- Het tabbed `border-b`-element bovenaan — vervangen door de modus-pill
  in de header.

## Wat verandert

- `SectionItem` → `InlineSection`: wrapper rond de gerenderde sectie
  (uit `SECTIONS`) + edit-chrome.
- `BlockItem` → `InlineBlock`: TipTap-editor in Bewerken
  (hergebruikt setup van `RichPromptEditor` — `marked` voor inkomende
  markdown, `turndown` voor uitgaande), `MarkdownBlock` in Voorbeeld.
- `HoverInsert` → `InsertStrip`: altijd zichtbaar in Bewerken (geen
  hover-trigger meer), verborgen in Voorbeeld.

## Componentstructuur

```
LayoutEditor                  state: layout, mode, dirty
├── EditorHeader              titel + dirty-label
│   └── Toolbar               Opslaan · Reset · [Bewerken|Voorbeeld]
├── LayoutCanvas              mode-aware renderer
│   ├── InsertStrip           "+ Vrij blok invoegen" (Bewerken-only)
│   ├── InlineSection         per section-item
│   │   ├── SectionChrome     drag · eye · trash  (Bewerken-only)
│   │   ├── EditableTitle     contenteditable in Bewerken, statisch in Voorbeeld
│   │   ├── EditableIntro     idem
│   │   └── SectionRenderer   bestaand component uit SECTIONS-registry
│   └── InlineBlock           per block-item
│       ├── BlockChrome       drag · trash  (Bewerken-only)
│       └── MarkdownArea      TipTap in Bewerken, MarkdownBlock in Voorbeeld
└── VersionHistory            ongewijzigd
```

## Gedrag

### Bewerken-modus

- Sectie- en blok-items hebben een dashed kader (subtiel, slate-300).
- Drag-handle (grip) staat links in de marge, altijd zichtbaar.
- Eye- en trash-icoon rechtsboven, altijd zichtbaar.
- Titel = contenteditable. Klik → cursor. Blur of `Escape` commit.
  Leeg veld → toont placeholder `defaultTitle` uit SECTIONS.
- Intro = contenteditable, idem. Leeg veld → onzichtbaar (geen
  ghost-placeholder in de output), maar wel een dunne leeg-prompt in
  Bewerken-modus.
- Markdown-blok = TipTap-editor inline.
- `InsertStrip` tussen elke twee items + vóór het eerste en ná het
  laatste.
- Drag-drop reorder werkt over alle items heen
  (`SortableContext`/`arrayMove` blijft).

### Voorbeeld-modus

- Geen `SectionChrome`, geen `BlockChrome`, geen `InsertStrip`.
- Alleen items waarvoor `visible !== false` (huidig veld is
  `item.visible: boolean`; default true).
- Titel/intro statische tekst.
- Markdown-blok rendert via bestaand `MarkdownBlock`.
- Output is identiek aan `WebsiteCheckResultView` op `/r/[shareSlug]`
  met dezelfde data.

### Mode-toggle

- Pill-component `<ModeToggle mode onChange>`.
- Twee knoppen: "Bewerken" (icoon `edit`), "Voorbeeld" (icoon `eye`).
- Actieve knop: paarse achtergrond, witte tekst. Inactieve:
  transparant, slate-tekst.
- Plaatsing: rechts naast Opslaan/Reset in de header.
- Wissel van Bewerken → Voorbeeld committet automatisch een blur op
  het actieve contenteditable-veld (waarde naar state, geen save).

## Verwijder-semantiek

- **Sectie-trash** → `visible = false`. Sectie blijft in de
  `layout.items`-array. In Bewerken blijft 'ie zichtbaar (faded, met
  "verborgen"-badge en eye-icoon dat weer aanzet). In Voorbeeld wordt
  'ie niet gerenderd. Reden: secties zijn registry-driven, je kan ze
  niet écht weg-deleten zonder de SECTIONS-registry aan te passen.
- **Blok-trash** → blok wordt uit `layout.items` verwijderd. Reden:
  een vrij blok is alleen content, geen registry-entry. Heradd via
  `+ Vrij blok invoegen`.

## Inline-edit interactie

| Veld | Mode | Edit-trigger | Commit |
|------|------|--------------|--------|
| Titel | Bewerken | klik in veld | blur of `Escape` |
| Intro | Bewerken | klik in veld | blur of `Escape` |
| Markdown | Bewerken | direct (TipTap actief) | per keystroke (debounced 300ms) |

Geen autosave op blur — wijzigingen blijven in `layout`-state tot de
gebruiker klikt op **Opslaan**. Dirty-state-banner zoals nu.

## Data-flow

`LayoutEditor` houdt `layout: LayoutConfig` in state. Per item-type
één callback omhoog:

- `onChangeSection(id, patch)` — voor visible/title/intro.
- `onChangeBlock(id, patch)` — voor markdown.
- `onReorder(items)` — drag-drop.
- `onInsertBlock(atIdx)` — `+ Vrij blok`.
- `onRemoveBlock(id)` — blok-trash.

Alle callbacks updaten `layout` met immutable patches; `dirty` wordt
afgeleid uit JSON-stringify-compare met `baselineRef`.

## Migratie

- `LayoutConfig.version` blijft 1. Geen schema-wijziging.
- Bestaande opgeslagen layouts werken zonder transformatie.
- `defaultLayoutFor(slug)` ongewijzigd.

## Testing

- Unit-tests blijven op het service-niveau (`layout.test.ts`,
  `layout-actions.test.ts`).
- Geen nieuwe unit-tests voor inline-edit-componenten (UI te
  imperatief — handmatige verificatie via `/admin/layouts/website-check`).
- Smoke-test: layout van Bewerken naar Voorbeeld en terug, met
  dirty-state, save, en herladen — geen data-loss.

## Out of scope

- Multi-section types (alles blijft `kind: "section" | "block"`).
- Drag-drop tussen layouts.
- Conflict-resolutie bij gelijktijdige edits (geen real-time-sync).
- Mobile-edit-flow (admin is desktop-only).
- Undo/redo (komt later eventueel).
