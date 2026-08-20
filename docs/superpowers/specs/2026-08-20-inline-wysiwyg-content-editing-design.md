# Inline WYSIWYG content editing — Design Spec

**Datum:** 2026-08-20
**Scope:** admin kan alle statische kopij op de homepage inline op de live pagina bewerken. Buiten scope in v1: images, andere marketing-pages, admin-routes zelf, drag-drop layout (staat al in `/admin/layouts`).
**Achterliggend probleem:** elke tekstwijziging vereist nu een code-edit + commit + deploy. Olivier is hands-on maar niet-technisch: hij wil op de site kunnen klikken op een tekst en die direct kunnen bewerken.
**Emotionele doelstelling:** editen voelt als typen in Notion, niet als een form invullen. De site moet er in normale modus exact zo uitzien als voor bezoekers — edit-mode is een extra laag, geen andere pagina.

---

## 1. Kern-architectuur

### 1.1 Data-model

Twee tabellen, allebei simpel:

**`site_content`** — de actuele waarde per content-key
| kolom | type | opmerking |
|---|---|---|
| `key` | text | primary key, hierarchisch `homepage.hero.title` |
| `value` | text | rendered-ready HTML voor rich velden, plain string voor plain velden |
| `updated_at` | timestamptz | default now |
| `updated_by` | uuid | → `auth.users.id`, nullable |

**`site_content_history`** — versie-log per key, gebruikt voor undo
| kolom | type | opmerking |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()` |
| `key` | text | → `site_content.key` (geen FK; row kan verwijderd worden) |
| `value` | text | snapshot bij save |
| `saved_at` | timestamptz | default now |
| `saved_by` | uuid | nullable |
| `note` | text | optioneel, bv. "Undo" |

Beide tabellen krijgen RLS: `for all to authenticated using(true) with check(true)` (uniform-pattern zoals de rest van positionr-app). Bezoekers zonder login lezen via server-actions die de service-key gebruiken.

Prune-regel voor `site_content_history`: bewaar per key de laatste 20 versies (10 is te weinig als je snel edit, 100 wordt rommelig).

### 1.2 Content-key namespace

Convention: `<page>.<section>.<optioneel-item>.<veld>`. Voorbeelden:
- `homepage.hero.title`
- `homepage.hero.subtitle`
- `homepage.hero.cta_primary_label`
- `homepage.hero.micro_copy`
- `homepage.painpoints.eyebrow`
- `homepage.painpoints.title`
- `homepage.painpoints.intro`
- `homepage.painpoints.q.1` t/m `q.9`
- `homepage.howitworks.step.1.title`, `homepage.howitworks.step.1.body`
- `homepage.foundations.card.cialdini.title`
- `homepage.foundations.card.cialdini.body`
- `homepage.founders.olivier.name`, `homepage.founders.olivier.intro`
- `homepage.faq.q.1`, `homepage.faq.a.1`
- `homepage.finalcta.title`, `homepage.finalcta.subtitle`, `homepage.finalcta.micro`

Elke key krijgt een default in code (§1.3). Naming is expliciet, geen impliciete iteraties — als je een 10e FAQ toevoegt zet je `homepage.faq.q.10` erbij.

### 1.3 Content-registry en defaults

Alle keys leven in één file `lib/content/registry.ts`:

```ts
export type ContentKey =
  | "homepage.hero.title"
  | "homepage.hero.subtitle"
  | ... // union van alle keys — typo's worden compile-error

export type ContentKind = "plain" | "rich"; // plain = string, rich = HTML

export const CONTENT_META: Record<ContentKey, { kind: ContentKind; default: string }> = {
  "homepage.hero.title": { kind: "plain", default: "De second opinion voor je marketingbeslissingen." },
  "homepage.hero.subtitle": { kind: "plain", default: "Wat een bureau in dagen doet, ..." },
  "homepage.faq.a.1": { kind: "rich", default: "<p>Ja. De rapportages leggen uit ...</p>" },
  ...
};
```

Voordelen:
- Één plek om te zien welke keys bestaan
- TypeScript vangt typo's
- Defaults kunnen worden gedeployd zonder DB-migratie
- Site werkt uit de box als tabel leeg is

### 1.4 Server-side lookup

```ts
// lib/content/get.ts (server-only)
export async function getContent(key: ContentKey): Promise<string> {
  const [row] = await db
    .select({ value: siteContent.value })
    .from(siteContent)
    .where(eq(siteContent.key, key))
    .limit(1);
  return row?.value ?? CONTENT_META[key].default;
}

export async function getContentBatch<K extends ContentKey>(
  keys: readonly K[],
): Promise<Record<K, string>> { ... }
```

`getContentBatch` is efficiënt: één DB-query voor alle homepage-keys tegelijk. Wordt aangeroepen in `app/(marketing)/page.tsx` (server-component).

---

## 2. Rendering en propagatie

### 2.1 Server → client props

`app/(marketing)/page.tsx` haalt alle homepage-content in één keer op en geeft aan elke sectie mee als props:

```tsx
export default async function HomePage() {
  const content = await getContentBatch(HOMEPAGE_KEYS);
  return (
    <div className="bg-cream">
      <Hero content={content} />
      <PainPoints content={content} />
      <HowItWorks content={content} />
      ...
    </div>
  );
}
```

Elke sectie declareert welke keys ze gebruikt en pakt ze uit `content`. Alternatief was per-sectie fetch, maar batch = 1 query = sneller LCP.

### 2.2 `<Editable>` component

```tsx
<Editable
  contentKey="homepage.hero.title"
  value={content["homepage.hero.title"]}
  as="h1"
  className="font-display text-4xl ..."
/>
```

Rendert in twee modi:

**Normale modus** (default) — server-component pad:
- Rendert exact als `<h1 className="...">{value}</h1>` voor `plain`, of met `dangerouslySetInnerHTML` voor `rich`
- Geen client JS, geen overhead
- SEO-vriendelijk, statisch

**Edit-modus** (edit-mode active + user is admin) — client-component pad:
- Zelfde element, maar met contenteditable+listener voor `plain`, of ingebouwde TipTap-editor voor `rich`
- Subtiele stippel-border op hover, dikker bij focus
- Save on blur of Cmd+S
- Optimistic UI: element toont direct nieuwe waarde
- "Opgeslagen ✓"-indicator flikkert 2s in de rechter-bovenhoek van het element

De sectie-componenten weten NIET welke modus actief is. `<Editable>` handelt dat af via een client-side context provider (§3).

### 2.3 Rich vs plain keuze per veld

| Type | Voorbeelden | Editor |
|---|---|---|
| plain | koppen (h1/h2/h3), button-labels, badge-tekst, footer-links | `contenteditable="plaintext-only"` |
| rich | body-paragrafen, FAQ-antwoorden, oprichter-bio's | TipTap via `RichPromptEditor` (bestaand) |

Standaard = plain. Alleen expliciet in `CONTENT_META` op `rich` zetten waar het meerwaarde heeft (bold, cursief, links).

---

## 3. Edit-mode activatie

### 3.1 Toegangscontrole

- Alleen users met `profiles.role = 'admin'` mogen edit-mode activeren.
- Server-actions checken dit hard (§4.3). Client-side "je ziet de knop niet" is puur UX; server is source of truth.

### 3.2 Aan-/uitzetten

- In de marketing-nav verschijnt een **"Bewerkmodus"-toggle-knop** alleen als user admin is.
- Klik → cookie `wysiwyg=1` (path=/, httpOnly=false — client leest 'm) + page reload.
- Klik opnieuw → cookie weg + reload → normale weergave.
- Cookie duurt 1 dag (herloggen sluit edit-mode automatisch).

### 3.3 Floating edit-bar

Bovenaan de pagina, boven de nav, sticky:
```
┌────────────────────────────────────────────────────────────────┐
│  ✏  Bewerkmodus aan   [↺ Ongedaan maken laatste]   [× Sluit]  │
└────────────────────────────────────────────────────────────────┘
```
- Zachte paarse achtergrond (`bg-primary/10`), dunne onderlijn
- Undo-knop pakt de een-na-laatste history-entry van de globaal-laatst-gewijzigde key en overschrijft
- Sluit-knop = edit-mode uit

### 3.4 Client-side context

Een `<EditModeProvider>` in de marketing-layout leest de cookie server-side en bezorgt via context:
```ts
{ enabled: boolean, isAdmin: boolean, currentUserId: string | null }
```
`<Editable>` reageert daarop. In normale modus is er geen client-component-boom nodig behalve de al bestaande motion-wrappers.

---

## 4. Save-mechaniek

### 4.1 Server-action `saveContent`

```ts
"use server";
export async function saveContent(
  key: ContentKey,
  value: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const meta = CONTENT_META[key];
  if (!meta) return { ok: false, error: "Onbekende content-key" };
  const clean = meta.kind === "rich" ? sanitizeHtml(value) : value.trim();
  await db.insert(siteContent).values({ key, value: clean, updatedBy: userId })
    .onConflictDoUpdate({ target: siteContent.key, set: { value: clean, updatedBy: userId, updatedAt: new Date() } });
  await db.insert(siteContentHistory).values({ key, value: clean, savedBy: userId });
  await pruneHistory(key, 20);
  revalidatePath("/");
  return { ok: true };
}
```

### 4.2 HTML-sanitizer

Voor `rich` velden: `sanitize-html` (dep toe te voegen).
- **Whitelist tags:** `p, br, strong, em, a, ul, ol, li`
- **Whitelist attributes op `a`:** `href, target, rel` (waarbij `href` alleen `http(s)://` of relatief)
- Alles anders wordt stripped
- `<script>`, `<iframe>`, event-handlers → weg

### 4.3 `requireAdmin`

```ts
async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Niet ingelogd");
  const [profile] = await db.select({ role: profiles.role })
    .from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  if (profile?.role !== "admin") throw new Error("Geen admin-rechten");
  return data.user.id;
}
```

### 4.4 Server-action `undoLast`

```ts
export async function undoLast(): Promise<{ ok: true; key: ContentKey } | { ok: false; error: string }> {
  await requireAdmin();
  // Pak de laatst-gewijzigde key
  const [latest] = await db.select().from(siteContentHistory).orderBy(desc(siteContentHistory.savedAt)).limit(1);
  if (!latest) return { ok: false, error: "Nog niks om ongedaan te maken" };
  // Pak de vorige entry voor die key
  const [prev] = await db.select().from(siteContentHistory)
    .where(and(eq(siteContentHistory.key, latest.key), ne(siteContentHistory.id, latest.id)))
    .orderBy(desc(siteContentHistory.savedAt)).limit(1);
  const restoredValue = prev?.value ?? CONTENT_META[latest.key as ContentKey].default;
  await saveContent(latest.key as ContentKey, restoredValue); // maakt weer nieuwe entry, note "Undo"
  return { ok: true, key: latest.key as ContentKey };
}
```

### 4.5 Optimistic UI + save-status

Client-side houdt `<Editable>` een `saving` en `savedRecently` state bij:
1. onBlur → toon "Opslaan…" spinner in hoek
2. server-action resolvet → toon "✓ Opgeslagen" 2s → fade weg
3. server-action faalt → toon "⚠ Niet opgeslagen" rood + originele waarde herstellen

---

## 5. Rendering (server-side detail)

Elke sectie-component wordt hertyped:

```tsx
// before
export function Hero() { return <h1>De second opinion...</h1> }

// after
type Props = { content: Record<HeroKey, string> };
export function Hero({ content }: Props) {
  return (
    <Editable
      contentKey="homepage.hero.title"
      value={content["homepage.hero.title"]}
      as="h1"
      className="font-display text-4xl ..."
    />
  );
}

export const HERO_KEYS = [
  "homepage.hero.title",
  "homepage.hero.subtitle",
  ...
] as const;
type HeroKey = typeof HERO_KEYS[number];
```

`app/(marketing)/page.tsx` bundelt alle sectie-keys:
```tsx
const HOMEPAGE_KEYS = [...HERO_KEYS, ...PAINPOINTS_KEYS, ...] as const;
```

### 5.1 Client-secties met content-props

Secties die client-component moeten blijven (motion, dnd): idem props. Ze zijn `"use client"` maar accepteren serialized strings — geen probleem.

### 5.2 SEO-check

Bezoekers zien altijd server-gerenderde HTML met de echte content (uit DB of default). `<Editable>` in normale modus rendert exact hetzelfde element als de oude hardcoded versie. Google Lighthouse SEO-score moet niet dalen.

---

## 6. Foutafhandeling

| Geval | Afhandeling |
|---|---|
| Content-key mist in DB | Val terug op default uit `CONTENT_META` |
| Onbekende key in `saveContent` | Return error; UI toont "onbekende sectie" |
| `sanitize-html` strip alles weg (bv. alleen `<script>`) | Save lege string; toon waarschuwing |
| User is niet admin | `requireAdmin` throwt, client krijgt 403-achtig |
| Cookie `wysiwyg=1` maar user is niet admin | Server-side detecteert, cookie wordt genegeerd, edit-bar niet gerenderd |
| Concurrent save van 2 admins tegelijk | Last-write-wins. History bewaart beide. Undo werkt correct. |
| History leeg bij undo | Val terug op default |

---

## 7. Testing (vitest)

| Niveau | Wat |
|---|---|
| Unit | `getContent(key)` — DB-hit, DB-miss → default |
| Unit | `getContentBatch(keys)` — één query, alle waarden gepacked |
| Unit | `sanitize-html` config strip `<script>`, `iframe`, event-handlers |
| Unit | `saveContent` — happy path (update + history + prune), admin-check |
| Unit | `undoLast` — restore vorige waarde, insert nieuwe history-entry met note "Undo" |
| Unit | `pruneHistory(key, 20)` — laat exact 20 laatste rijen staan |
| Smoke (prod) | Als admin: klik hero-h1, typ nieuwe tekst, tab-out, refresh — nieuwe tekst is er |
| Smoke (prod) | Als bezoeker: geen edit-bar zichtbaar, geen extra JS in HTML source |

Geen RTL — geen UI-testing setup in dit project (consistent met PR-L1/L2).

---

## 8. Rollout — drie PR's

1. **PR-C1: Data-laag + content-registry.** DB-migratie voor `site_content` + `site_content_history` + RLS. `lib/content/{registry,get,save}.ts`. Sanitizer. Tests. `getContentBatch` in `page.tsx`. Alle homepage-secties krijgen `content`-prop maar rendert nog met plain `<h1>` etc. — geen visueel verschil. Bezoekers zien DB-content bij een DB-hit, defaults anders. **Deliverable: pagina werkt exact zoals nu, maar via DB.**
2. **PR-C2: `<Editable>`-component + edit-mode UI.** `<Editable>` client-wrapper met contenteditable (plain) en TipTap-inline (rich). `EditModeProvider` + cookie. Nav-toggle voor admins. Floating edit-bar met undo-knop. Save-actions, optimistic UI. **Deliverable: admin kan inline editen op de live pagina.**
3. **PR-C3 (later spec):** uitbreiden naar `/prijzen`, `/voorwaarden`, `/privacy`, `/gratis-check`.

Elke PR is apart deploybaar/revertbaar.

---

## 9. Risico's & onbekenden

| Risico | Impact | Mitigatie |
|---|---|---|
| Client-bundle wordt groter (TipTap voor rich edit) | ~50kB extra JS in bundle | TipTap is al aanwezig voor `RichPromptEditor`. Lazy-load `<Editable>`'s edit-modus alleen als cookie zegt edit=1. Bezoekers zonder cookie krijgen niks van TipTap. |
| Content-key registry raakt out-of-sync met code | Section rendert lege string of crash | TypeScript union voor `ContentKey` vangt typo's compile-time. Als een key in code wordt gebruikt maar niet in `CONTENT_META`, weigert TypeScript te compileren. |
| Onveilige HTML in `rich` velden | XSS-risico | `sanitize-html` met strikte whitelist. Server-side sanitized ook bij save (client is niet vertrouwd). |
| Twee admins editen dezelfde key tegelijk | Laatste wint, ander weet 't niet | Acceptabel voor v1 (Olivier is enige admin). Later evt. Realtime-locks via Supabase Realtime. |
| Cookie manipulatie (`wysiwyg=1` zetten zonder admin te zijn) | Bezoeker ziet edit-UI | Server-side checkt admin bij render; edit-bar rendert niet, `saveContent` weigert. UI is puur cosmetisch. |
| Homepage-page cached door Vercel/Next | Nieuwe content niet meteen zichtbaar | `revalidatePath("/")` in `saveContent`. Optioneel `export const revalidate = 0` op page.tsx (kost SSR-cache maar altijd verse content). |
| Onbedoelde massa-edits per ongeluk | Slordige tekst live | Undo-knop in bar. Later evt. "geldig HTML"-warning bij lege strings. |
| Optimistic UI mist error state | User denkt opgeslagen, is niet | Duidelijke `⚠` bij fail, waarde revert automatisch, toast met "Niet opgeslagen — probeer opnieuw". |

---

## 10. Acceptatiecriteria

### PR-C1
- [ ] `site_content` + `site_content_history` tabellen + RLS bestaan in productie
- [ ] `lib/content/registry.ts` exporteert alle homepage-content-keys als typed union + defaults
- [ ] `app/(marketing)/page.tsx` roept `getContentBatch` aan en geeft `content` als prop door
- [ ] Alle homepage-secties (`Hero`, `PainPoints`, `HowItWorks`, `Foundations`, `Founders`, `AgencyComparison`, `PlansTeaser`, `Faq`, `FinalCta`, `HomeFooter`) accepteren en gebruiken `content`
- [ ] Bezoekers zien homepage exact zoals nu (defaults matchen huidige hardcoded strings 1-op-1)
- [ ] `pnpm test` groen (nieuwe tests toegevoegd voor `getContent` / `saveContent` / `sanitize` / `undo` / `prune`)
- [ ] `pnpm typecheck` schoon
- [ ] `pnpm build` schoon

### PR-C2
- [ ] Admin ziet in de marketing-nav een "Bewerkmodus"-toggle
- [ ] Klik → cookie `wysiwyg=1` gezet + reload
- [ ] Floating edit-bar bovenaan met undo-knop
- [ ] Klik op elke `<Editable>` tekst → contenteditable of TipTap-editor
- [ ] Tab-out of Cmd+S → save + "✓ Opgeslagen" indicator + revalidate
- [ ] Undo-knop reset laatste wijziging
- [ ] Bezoeker (niet-admin, geen cookie): geen edit-bar, geen extra JS bundle, geen visueel verschil
- [ ] Server-actions weigeren als user niet admin
- [ ] `sanitize-html` strip `<script>`/`<iframe>`/event-handlers uit rich velden
- [ ] Alle tests groen, typecheck schoon, build schoon

---

## 11. Volgende stap

Implementatieplan voor **PR-C1** in `docs/superpowers/plans/2026-08-20-content-editing-data-layer.md`, met bite-sized tasks à la PR-L1 / PR-L2. PR-C2 krijgt eigen plan na PR-C1 succesvol live is.
