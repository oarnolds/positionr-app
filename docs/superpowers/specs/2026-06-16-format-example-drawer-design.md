# Spec — Format-voorbeeld drawer in layout-editor

**Datum:** 2026-06-16
**Module:** admin / layouts
**Status:** ontwerp, klaar voor implementatieplan

## Probleem

De prompt + output van een module wijken in de praktijk af van het format
dat we voor ogen hebben. Er is geen referentie-document zichtbaar tijdens
het werken in de admin, dus de admin moet uit zijn hoofd weten hoe het
resultaat eruit hoort te zien.

## Doel

Per module een statisch referentie-voorbeeld (markdown) dat met één klik
zichtbaar wordt in een drawer rechts van de layout-editor. Doel: tijdens
het tunen van prompt of layout kan de admin het format-voorbeeld erbij
pakken zonder de admin te verlaten.

## Naming-decisie

De huidige modus-toggle gebruikt al de label "Voorbeeld" voor de live
preview. Om naming-conflict te vermijden:

- Modus-toggle wordt **`Bewerken | Preview`** (was: `Bewerken | Voorbeeld`).
- De nieuwe knop heet **`Voorbeeld`** en opent de drawer met het
  format-voorbeeld.

## Opslag

Per module een bestand `format-example.md` in de module-folder:

```
modules/website-check/format-example.md
modules/icp-analyse/format-example.md       (later, indien aangeleverd)
modules/<andere>/format-example.md          (later)
```

Geen DB-veld, geen upload-UI. Bestand wordt versie-gecontroleerd via git.
Update-pad: admin levert nieuwe docx → handmatige conversie naar markdown
→ commit naar repo.

Eerste exemplaar: `modules/website-check/format-example.md`, gegenereerd
uit `FORMAT_Website_analyse_Template.docx` die de gebruiker heeft
aangeleverd op 2026-06-16. De markdown-output van markitdown wordt
ingezet als baseline.

## Helper

Nieuwe server-only helper `lib/modules/format-examples.ts`:

```ts
export async function getFormatExample(slug: string): Promise<string | null>
```

- Leest `modules/<slug>/format-example.md` via `fs/promises`.
- Slug-validatie: alleen `[a-z0-9-]+` toegestaan om path-traversal te
  voorkomen.
- Bestand ontbreekt → `null`.
- Andere fs-fouten → `null` (gelogd).
- Gecached per request: page.tsx roept 'm hooguit één keer per render.

## Server-side fetch

`app/(admin)/admin/layouts/[slug]/page.tsx` (server-component) roept
`getFormatExample(slug)` aan en geeft het resultaat door als prop aan
`LayoutEditor`.

## UI

### Knop in de toolbar

Nieuwe ghost-button `[Voorbeeld]` met `BookOpen`-icoon (lucide-react),
geplaatst **links van** de modus-toggle. Toolbar volgorde links→rechts:

```
[Opslaan] [Reset] [Voorbeeld] [Bewerken | Preview]
```

Knop wordt **niet gerenderd** als `formatExample === null` (geen bestand
voor deze module).

### Drawer

Nieuw client-component
`app/(admin)/admin/layouts/[slug]/format-example-drawer.tsx`:

- Position: fixed, rechts uitgelijnd, full-height.
- Breedte: 50vw (responsive: minimaal 480px, maximaal 720px).
- Achtergrond: wit, schaduw aan de linker rand voor visuele scheiding.
- Sticky header bovenin: "Voorbeeld — Website Check" (of moduletitel),
  X-knop rechts.
- Body: scrollable, padding, prose-typografie (gebruikt bestaande
  `MarkdownBlock` voor render).
- Geen edit-functionaliteit. Pure read-only.

### Sluit-gedrag

- Klik op X.
- Klik op overlay buiten de drawer (lichte semi-transparante backdrop
  links van de drawer).
- `Escape`-toets.

### State

`LayoutEditor` houdt `drawerOpen: boolean` in lokale `useState`. Default
`false`. Knop togglet naar `true`. Drawer-callbacks zetten naar `false`.

## Componentstructuur

```
LayoutEditor
├── EditorHeader
│   ├── Title + dirty-label
│   └── Toolbar
│       ├── Opslaan
│       ├── Reset
│       ├── Voorbeeld (alleen als formatExample !== null)
│       └── ModeToggle ["Bewerken" | "Preview"]
├── LayoutCanvas (ongewijzigd)
├── VersionHistory (ongewijzigd)
└── FormatExampleDrawer (open/close via drawerOpen state)
```

## Bestandsplan

**Nieuw:**

- `lib/modules/format-examples.ts` — helper `getFormatExample(slug)`.
- `app/(admin)/admin/layouts/[slug]/format-example-drawer.tsx` — drawer
  component met sluit-gedrag.
- `modules/website-check/format-example.md` — eerste content.

**Gewijzigd:**

- `app/(admin)/admin/layouts/[slug]/page.tsx` — roept helper aan, geeft
  prop door.
- `app/(admin)/admin/layouts/[slug]/layout-editor.tsx` — accepteert
  `formatExample`-prop, beheert `drawerOpen`-state, rendert Voorbeeld-knop
  en drawer.
- `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx` — label "Voorbeeld"
  wordt "Preview". `EditorMode`-string-literal blijft `"preview"` (alleen
  het label-tekst verandert).

## Edge cases

- **Slug die niet matcht aan een module-folder** (bv. een toekomstige
  catalogus-entry zonder code) → `getFormatExample` returns `null` →
  knop verschijnt niet.
- **Markdown bevat afbeeldingen** → `MarkdownBlock` rendert standaard
  `<img>`-tags; afbeeldingen moeten in `public/` staan of een absolute
  URL hebben. Voor de eerste content is dit n.v.t. (geen afbeeldingen in
  het docx).
- **Zeer lange voorbeelden** → drawer-body is scrollable, geen
  performance-zorg verwacht.

## Out of scope

- Knop in `/admin/layouts` modules-lijst.
- Knop in `/admin/prompts/[slug]` (komt mogelijk later).
- Upload- of edit-UI vanuit admin.
- Voorbeelden voor andere modules dan website-check — die komen als de
  admin ze aanlevert.
- Templating / placeholder-vervanging in het voorbeeld. Het document is
  een statische referentie, geen runtime-template.
- Side-by-side modus waarbij drawer permanent open blijft naast de
  editor. Drawer is altijd overlay-style.

## Testing

- Unit-tests:
  - `lib/modules/format-examples.test.ts`: valid-slug → string,
    invalid-slug → null, missing-file → null.
- Geen UI-tests voor drawer (consistent met `LayoutEditor`-policy:
  handmatige browser-check).
