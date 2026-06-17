# Spec — Layout-editor wordt markdown-template, runtime herschrijft AI-output

**Datum:** 2026-06-16
**Module:** admin / layouts + runtime
**Status:** ontwerp, klaar voor implementatieplan

## Probleem

De huidige WYSIWYG layout-editor (sections, drag-drop, vrij-blokken) is te
gefragmenteerd. Een admin kan wel secties verslepen, maar niet de uiteindelijke
output-tekst zelf vormgeven. De AI produceert structured JSON die door
sections-componenten gerenderd wordt — wat de admin op het scherm wil zien
matcht niet altijd wat er in de prompt-editor staat.

## Doel

Eén markdown-document per module dat zowel **blauwdruk** is voor de admin
(wat de output moet worden) als **template** voor de runtime (wat de AI moet
produceren). Admin past het document aan → AI volgt het format → eindgebruiker
ziet output in die vorm.

## Architectuur op hoofdlijnen

```
┌─────────────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Admin: /admin/layouts/  │     │  DB: modules │     │ Runtime: AI-call │
│ [slug] textarea + preview│ ──> │.format_example│ ──> │ prompt + template│
└─────────────────────────┘     └──────────────┘     └─────────────────┘
                                                              │
                                                              ▼
                                                ┌──────────────────────┐
                                                │ AI retourneert raw   │
                                                │ markdown (filled)    │
                                                └──────────┬───────────┘
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │ sessions.output      │
                                                │ (text, niet JSON)    │
                                                └──────────┬───────────┘
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │ ResultView →         │
                                                │ <MarkdownBlock />    │
                                                └──────────────────────┘
```

## 1. Admin-UI

### `/admin/layouts` — modules-grid

Vervangt de huidige sidebar+single-module-editor. Toont **alle 21 modules**
uit `lib/modules/registry.ts` als kaarten in een grid.

Per kaart:
- Module-naam (display title).
- Slug als kleine mono-tekst.
- Pakket-badge (Fundament / Groei / Strategie) in pakket-kleur.
- Status-indicator: ✓ als `modules.format_example IS NOT NULL`, anders niets.
- Hele kaart is klikbaar → `/admin/layouts/[slug]`.

Geen filters, geen sortering — caller is admin, 21 items past op één scherm.

### `/admin/layouts/[slug]` — split-pane editor

Vervangt de huidige `LayoutEditor` + alle WYSIWYG-componenten.

Layout:
```
┌─────────────────────────────────────────────────────────────┐
│  Layout — <module-naam>      [Opslaan]  niet-opgeslagen ●  │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│  [textarea, monospace]   │  [live preview]                  │
│  raw markdown            │  via MarkdownBlock               │
│                          │                                  │
│  50% breedte             │  50% breedte                     │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

- Textarea: `<textarea>` met `font-mono`, full-height van het editor-blok,
  geen rich-text. Controlled component, state in client.
- Preview: rendert dezelfde markdown via bestaande `MarkdownBlock`.
- Save-knop alleen actief bij dirty. Bij click → server-action
  `saveFormatExample(slug, markdown)`.
- Dirty-detectie via vergelijking met `baselineRef` (zoals oude
  `LayoutEditor`).
- `beforeunload`-prompt bij dirty state.
- Slug-validatie op page-level: alleen slugs uit registry zijn geldig,
  anders `notFound()`.

Geen tabs, geen version-history, geen reset-knop. (Komen eventueel later.)

## 2. DB-changes

### Migratie

```sql
-- Toevoegen
ALTER TABLE modules
  ADD COLUMN format_example text;

-- Seed website-check uit huidige file (de markitdown-versie die nu in
-- modules/website-check/format-example.md staat)
UPDATE modules
   SET format_example = '<...volledige markdown...>'
 WHERE slug = 'website-check';

-- Droppen
ALTER TABLE modules DROP COLUMN layout_config;
DROP TABLE module_layout_history;

-- sessions.output: jsonb → text
ALTER TABLE sessions DROP COLUMN output;
ALTER TABLE sessions ADD COLUMN output text;
```

Bestaande sessies verliezen hun output (`text` is null). Pre-launch
acceptabel — geen klant-data.

### RLS

`modules.format_example` valt onder bestaande modules-tabel RLS. Admin-rol
(`profile.role = 'admin'`) mag updaten — al bestaande policy.

## 3. Runtime

### Helpers

`getFormatExample(slug)` wordt herschreven: leest uit `modules.format_example`
in plaats van uit een file. Signature blijft `(slug: string) => Promise<string | null>`.
De server-action `saveFormatExample(slug, markdown)` is nieuw en update dezelfde
kolom.

### `runAnalysis` in `modules/website-check/service.ts`

Nieuwe flow:

```ts
async function runAnalysis(sessionId, input) {
  const scraped = await scrape(input.url);
  const promptTemplate = await getModulePrompt('website-check');
  const formatTemplate = await getFormatExample('website-check');
  if (!formatTemplate) throw new Error('format_example ontbreekt');

  const userPrompt = buildUserPrompt({
    scraped,
    formatTemplate,
    // andere placeholders zoals {DatumVandaag} blijven
  });

  const markdown = await analyze({
    systemPrompt: promptTemplate.system,
    userPrompt,
    // Geen schema-validatie, AI retourneert raw text
  });

  await db.update(sessions)
    .set({ output: markdown, status: 'completed', completedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}
```

### User-prompt-strategie

Het gebruiker-prompt (gebouwd in `prompt.ts`) krijgt een nieuwe sectie:

```
[scraped website-content]
---
FORMAT-TEMPLATE (volg deze structuur exact, vervang placeholders door
inhoud op basis van de geschraapte data; behoud markdown-structuur,
behoud koppen, behoud tabellen):

[format_example markdown ingesloten]
---
Schrijf nu de gevulde versie van bovenstaand format. Geef alleen de
markdown terug, geen JSON, geen uitleg.
```

Geen placeholder-substitutie aan onze kant. De AI ziet `[KLANTNAAM]` en
`[DATUM VANDAAG]` en vult ze in op basis van de scraped data + system date.

### Output-validatie

- Minimaal: response is non-empty string.
- Geen Zod-schema. Geen JSON-parsing.
- Telemetrie (cost, tokens) blijft via bestaande `analyze()`-wrapper.

### Renderer

`WebsiteCheckResultView` wordt vereenvoudigd tot:

```tsx
export function WebsiteCheckResultView({ markdown }: { markdown: string }) {
  return <MarkdownBlock markdown={markdown} />;
}
```

Geen `data: WebsiteCheckOutput`, geen `layout: LayoutConfig`. Page-route
leest `sessions.output` (text) en geeft het door.

## 4. Wat verdwijnt

### Files

- `app/(admin)/admin/layouts/[slug]/layout-editor.tsx`
- `app/(admin)/admin/layouts/[slug]/layout-canvas.tsx`
- `app/(admin)/admin/layouts/[slug]/inline-section.tsx`
- `app/(admin)/admin/layouts/[slug]/inline-block.tsx`
- `app/(admin)/admin/layouts/[slug]/insert-strip.tsx`
- `app/(admin)/admin/layouts/[slug]/mode-toggle.tsx`
- `app/(admin)/admin/layouts/[slug]/format-example-drawer.tsx`
- `app/(admin)/admin/layouts/[slug]/version-history.tsx`
- `app/(admin)/admin/layouts/sidebar.tsx`
- `app/(admin)/admin/layouts/page.tsx` (oude versie — vervangen door grid)
- `app/(admin)/admin/layouts/[slug]/page.tsx` (oude — vervangen door editor)
- `modules/website-check/sections.tsx`
- `modules/website-check/sections-meta.ts`
- `modules/website-check/components/WebsiteCheckResultView.tsx` (vervangen door dunne wrapper)
- `lib/modules/layout.ts` (Zod-schema)
- `lib/modules/layouts.ts` (getModuleLayout helper)
- `lib/modules/layout-actions.ts` (save/reset/restore/history)
- `lib/modules/preview-data.ts` (geen sections-fixture meer nodig)
- `lib/modules/format-examples.ts` (file-based helper — vervangen door DB-read)
- `modules/website-check/format-example.md` (na seeding)

### DB

- `modules.layout_config` kolom
- `module_layout_history` tabel
- `sessions.output` van jsonb → text (data-loss)

### Schema

- `modules/website-check/schema.ts`: `WebsiteCheckOutput` Zod-schema (output)
  weg. Input-schema (URL-validatie) blijft.

## 5. Wat blijft

- `modules/website-check/{prompt.ts, scraper.ts, service.ts}` — bewerkt
  maar niet weg.
- AI-providers (`lib/ai/*`) — ongewijzigd.
- Admin prompt-editor (`/admin/prompts/[slug]`) — ongewijzigd.
- Sessions-flow (`startAnalysis`, `regenerateAnalysis`) — ongewijzigd
  contract, alleen de service erachter geeft markdown i.p.v. JSON.
- Share-link `/r/[shareSlug]` — werkt via dezelfde sessions-tabel.
- `MarkdownBlock` — basis voor zowel admin-preview als runtime-render.

## 6. Backward-compat

Pre-launch, geen klant-data, geen migratiezorg.
- Bestaande sessies verliezen `output` (data-loss).
- Bestaande share-links blijven werken maar tonen lege output tot iemand
  een nieuwe analyse start.

## 7. Edge cases

- **Slug zonder `format_example`** in DB → admin-editor toont lege
  textarea met placeholder "Begin met je format-voorbeeld…".
- **Slug niet in registry** → `notFound()`.
- **AI retourneert leeg/extreem korte response** → status `failed` met
  error-message "AI-output leeg".
- **AI verzint extra structuur of slaat secties over** → admin merkt het
  in de session-output. Geen automatische correctie in v1.

## 8. Testing

- Unit:
  - `getFormatExample(slug)` reads from DB (vervangt file-based test).
  - `saveFormatExample(slug, markdown)` updates DB row.
  - `runAnalysis` happy-path: stubt AI met fixed markdown, controleert dat
    `sessions.output` de markdown bevat.
- Geen UI-tests voor editor (consistent met huidig beleid).
- E2E smoke-test via dev-server: open `/admin/layouts`, klik website-check,
  edit textarea, save, herlaad, content blijft.

## 9. Out of scope

- Version-history voor format-examples (komt mogelijk later).
- Markdown-editor met syntax-highlighting / autocomplete.
- Andere modules dan website-check krijgen runtime-implementatie
  (deze spec dekt alleen website-check; andere modules komen los).
- Templating-engine voor placeholder-substitutie aan onze kant — AI doet
  alles.
- Migratie van bestaande sessies-data.
