# Strengheidsknop website-check — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een admin-knop (1–5) die de beoordelingsstrengheid van de website-check stuurt via prompt-injectie bij het genereren, zodat cijfer én tekst consistent mee bewegen.

**Architecture:** Eén `strictness`-kolom (default 3) op de `modules`-rij. Een nieuw `lib/modules/strictness.ts` bevat de niveaubetekenis (labels + kalibratieteksten). `getModulePrompt` geeft de waarde mee; de website-check service prikt de kalibratie-instructie in de prompt tussen header en FORMAT-TEMPLATE. De admin bedient de waarde met een schuifknop op de prompt-editor, opgeslagen via een eigen server-actie los van de prompt-history.

**Tech Stack:** Next.js 15 (App Router, server actions), Drizzle ORM + Postgres (Supabase), Zod, Vitest, React 19, Tailwind.

**Ontwerp-spec:** `docs/superpowers/specs/2026-07-15-strengheidsknop-website-check-design.md`

**Volgorde-afhankelijkheden (belangrijk):**
- Task 2 (migratie) moet toegepast zijn op de DB vóór Task 3+ (de code selecteert dan de nieuwe kolom).
- Task 3 werkt de `service.test.ts`-mocks bij zodat de test blijft compileren nadat het return-type van `getModulePrompt` verandert.
- Task 6 wijzigt `editor-pane.tsx` én `page.tsx` in één commit, omdat ze via de nieuwe prop gekoppeld zijn.

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid |
|---|---|
| `lib/modules/strictness.ts` (nieuw) | Niveaubetekenis: labels, kalibratieteksten, `clampStrictness`/`strictnessLabel`/`strictnessInstruction`. |
| `lib/modules/strictness.test.ts` (nieuw) | Unit-tests op de mapping + clamping. |
| `lib/db/schema.ts` (wijzig) | Kolom `strictness` op `modules`. |
| `drizzle/*` (nieuw) | Gegenereerde migratie voor de kolom. |
| `lib/modules/prompts.ts` (wijzig) | `getModulePrompt` retourneert `strictness`. |
| `modules/website-check/service.ts` (wijzig) | Injectie van de kalibratie in `buildPrompt`. |
| `modules/website-check/service.test.ts` (wijzig) | Mock-update + injectie-tests. |
| `app/(admin)/admin/prompts/[slug]/actions.ts` (wijzig) | `saveStrictness`-server-actie. |
| `app/(admin)/admin/prompts/[slug]/page.tsx` (wijzig) | `strictness` laden + doorgeven. |
| `app/(admin)/admin/prompts/[slug]/editor-pane.tsx` (wijzig) | Schuifknop + opslaan. |

---

## Task 1: Strengheid-mapping module

**Files:**
- Create: `lib/modules/strictness.ts`
- Test: `lib/modules/strictness.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/modules/strictness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clampStrictness,
  strictnessInstruction,
  strictnessLabel,
  DEFAULT_STRICTNESS,
} from "./strictness";

describe("clampStrictness", () => {
  it("laat geldige niveaus 1..5 ongemoeid", () => {
    expect(clampStrictness(1)).toBe(1);
    expect(clampStrictness(5)).toBe(5);
  });
  it("rondt af op heel getal", () => {
    expect(clampStrictness(3.4)).toBe(3);
    expect(clampStrictness(3.6)).toBe(4);
  });
  it("klemt buiten bereik", () => {
    expect(clampStrictness(0)).toBe(1);
    expect(clampStrictness(6)).toBe(5);
    expect(clampStrictness(-2)).toBe(1);
  });
  it("valt terug op default bij NaN/oneindig", () => {
    expect(clampStrictness(Number.NaN)).toBe(DEFAULT_STRICTNESS);
    expect(clampStrictness(Number.POSITIVE_INFINITY)).toBe(DEFAULT_STRICTNESS);
  });
});

describe("strictnessLabel", () => {
  it("geeft het juiste label per niveau", () => {
    expect(strictnessLabel(1)).toBe("Mild");
    expect(strictnessLabel(3)).toBe("Evenwichtig");
    expect(strictnessLabel(5)).toBe("Zeer streng");
  });
});

describe("strictnessInstruction", () => {
  it("bevat de niveau-specifieke tekst", () => {
    expect(strictnessInstruction(5)).toContain("zeer streng");
    expect(strictnessInstruction(1)).toContain("welwillend");
  });
  it("plakt altijd de gedeelde grens erachter", () => {
    for (const lvl of [1, 2, 3, 4, 5]) {
      expect(strictnessInstruction(lvl)).toContain(
        "ongeacht de gekozen strengheid",
      );
    }
  });
  it("klemt buiten bereik naar een geldig niveau", () => {
    expect(strictnessInstruction(99)).toContain("zeer streng");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/modules/strictness.test.ts`
Expected: FAIL — kan `./strictness` niet resolven.

- [ ] **Step 3: Write the implementation**

Create `lib/modules/strictness.ts`:

```ts
// lib/modules/strictness.ts
//
// Globale beoordelingsstrengheid voor scorende modules (nu alleen
// website-check). De 1-5 waarde staat op de modules-rij; hier leeft de
// betekenis: labels + de kalibratie-instructie die bij het genereren in de
// prompt wordt geprikt. Bewust NIET in de bewerkbare prompt, zodat de dial
// altijd werkt, ook als de prompt-tekst wijzigt.

export const MIN_STRICTNESS = 1;
export const MAX_STRICTNESS = 5;
export const DEFAULT_STRICTNESS = 3;

export type StrictnessLevel = 1 | 2 | 3 | 4 | 5;

export const STRICTNESS_LABELS: Record<StrictnessLevel, string> = {
  1: "Mild",
  2: "Iets milder",
  3: "Evenwichtig",
  4: "Streng",
  5: "Zeer streng",
};

const LEVEL_INSTRUCTIONS: Record<StrictnessLevel, string> = {
  1: "Beoordeel welwillend en bemoedigend. Waardeer nadrukkelijk wat er goed is en geef de website het voordeel van de twijfel. Geef alleen een cijfer onder de 4 als een onderdeel echt ontbreekt. Formuleer verbeterpunten als aanmoediging, niet als kritiek.",
  2: "Beoordeel mild. Leg de nadruk op wat werkt en benoem gebreken zacht en constructief. Wees eerder gul dan streng met de cijfers.",
  3: "Beoordeel evenwichtig. Benoem sterke en zwakke punten eerlijk, zonder te vleien en zonder af te kraken. Een gemiddelde website krijgt gemiddelde cijfers.",
  4: "Beoordeel streng. Leg de lat hoog: een cijfer van 8 of hoger moet verdiend zijn met concreet, zichtbaar bewijs. Wees kritisch op vage beloftes, ontbrekend bewijs en onduidelijke taal. Een gemiddelde website krijgt eerder een matig cijfer.",
  5: "Beoordeel zeer streng, als een veeleisende expert. Geef een 8 of hoger alleen bij uitmuntende, aantoonbaar bewezen uitvoering. Twijfel telt in het nadeel van het cijfer. Benoem elk gemis scherp, maar blijf respectvol en zakelijk.",
};

const SHARED_GUARDRAIL =
  "Deze twee regels gelden ongeacht de gekozen strengheid: (1) gerichte vaktaal of branchebeeld die de juiste koper aanspreekt en de verkeerde afschrikt is een plus, geen minpunt; (2) content die niet geladen kon worden (zoals de contactpagina of klantcases) krijgt een voorzichtige score, geen afstraffing — strengheid scherpt alleen het oordeel over wat wél zichtbaar is.";

/** Rondt af naar heel getal en klemt in [1,5]. NaN/oneindig → default 3. */
export function clampStrictness(value: number): StrictnessLevel {
  if (!Number.isFinite(value)) return DEFAULT_STRICTNESS;
  const rounded = Math.round(value);
  const clamped = Math.min(MAX_STRICTNESS, Math.max(MIN_STRICTNESS, rounded));
  return clamped as StrictnessLevel;
}

/** Kort label voor de admin-UI, bv. "Evenwichtig". */
export function strictnessLabel(value: number): string {
  return STRICTNESS_LABELS[clampStrictness(value)];
}

/** Niveau-instructie + gedeelde grens, klaar om in de prompt te prikken. */
export function strictnessInstruction(value: number): string {
  const level = clampStrictness(value);
  return `${LEVEL_INSTRUCTIONS[level]}\n\n${SHARED_GUARDRAIL}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/modules/strictness.test.ts`
Expected: PASS (alle beschrijvingen groen).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "lib/modules/strictness" || echo "schoon"`
Expected: `schoon`.

- [ ] **Step 6: Commit**

```bash
git add lib/modules/strictness.ts lib/modules/strictness.test.ts
git commit -m "feat(website-check): strengheid-mapping (1-5 kalibratieteksten)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: DB-kolom `strictness` + migratie

**Files:**
- Modify: `lib/db/schema.ts` (rond regel 85, na `provider`)
- Create: `drizzle/*` (gegenereerd)

- [ ] **Step 1: Voeg de kolom toe aan het schema**

In `lib/db/schema.ts`, binnen `export const modules = pgTable("modules", { ... })`, direct ná de regel `provider: providerEnum("provider").default("claude").notNull(),` toevoegen:

```ts
  strictness: integer("strictness").notNull().default(3),
```

(`integer` is al geïmporteerd in dit bestand — geen import-wijziging nodig.)

- [ ] **Step 2: Genereer de migratie**

Run: `npm run db:generate`
Expected: een nieuw bestand `drizzle/XXXX_<naam>.sql` met `ALTER TABLE "modules" ADD COLUMN "strictness" integer DEFAULT 3 NOT NULL;` plus bijgewerkte `drizzle/meta/*`.

- [ ] **Step 3: Pas de migratie toe op de database**

⚠️ Dit muteert de live/dev-database. De migratie is additief en veilig (nieuwe kolom met default 3; bestaande rijen krijgen automatisch 3).

Run: `npm run db:migrate`
Expected: migratie toegepast, geen fouten.

- [ ] **Step 4: Verifieer de kolom**

Run: `npm run typecheck 2>&1 | grep "schema.ts" || echo "schema schoon"`
Expected: `schema schoon`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(db): strictness-kolom op modules (default 3)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `getModulePrompt` geeft strictness mee

**Files:**
- Modify: `lib/modules/prompts.ts:30-48`
- Modify: `modules/website-check/service.test.ts:19-22` en `:102-105` (mocks groen houden)

- [ ] **Step 1: Breid `getModulePrompt` uit**

Vervang de hele functie `getModulePrompt` in `lib/modules/prompts.ts` door:

```ts
export async function getModulePrompt(
  slug: string,
): Promise<{ prompt: string; provider: ConfigProvider; strictness: number }> {
  const [row] = await db
    .select({
      defaultPrompt: modules.defaultPrompt,
      provider: modules.provider,
      strictness: modules.strictness,
    })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);

  if (!row) throw new Error(`Module ${slug} niet in DB`);

  const strictness = row.strictness ?? 3;

  if (!row.defaultPrompt || row.defaultPrompt.length === 0) {
    const fallback = FALLBACK_PROMPTS[slug];
    if (!fallback) throw new Error(`Geen fallback prompt voor module ${slug}`);
    return {
      prompt: fallback,
      provider: row.provider as ConfigProvider,
      strictness,
    };
  }

  return {
    prompt: row.defaultPrompt,
    provider: row.provider as ConfigProvider,
    strictness,
  };
}
```

- [ ] **Step 2: Houd de bestaande service-test-mocks compileerbaar**

`ServiceDeps.fetchPrompt` is getypeerd als `typeof getModulePrompt`, dus de mocks moeten nu ook `strictness` teruggeven, anders compileert `service.test.ts` niet.

In `modules/website-check/service.test.ts`, in `makeDeps()`, de `fetchPrompt`-mock (regel ~19) uitbreiden:

```ts
    fetchPrompt: vi.fn().mockResolvedValue({
      prompt: "Analyseer {websiteUrl} van {companyName}. Inhoud:\n{scrapedContent}",
      provider: "claude" as const,
      strictness: 3,
    }),
```

En in de test `"runAnalysis: provider='both' → pickAnalyzer ontvangt 'both'"` (regel ~102) de inline override uitbreiden:

```ts
  deps.fetchPrompt = vi.fn().mockResolvedValue({
    prompt: "Analyseer {websiteUrl}. Inhoud:\n{scrapedContent}",
    provider: "both" as const,
    strictness: 3,
  });
```

- [ ] **Step 3: Draai de bestaande suite + typecheck**

Run: `npx vitest run modules/website-check/service.test.ts`
Expected: PASS (gedrag ongewijzigd; injectie komt in Task 4).

Run: `npm run typecheck 2>&1 | grep -E "prompts.ts|service.test" || echo "schoon"`
Expected: `schoon`.

- [ ] **Step 4: Commit**

```bash
git add lib/modules/prompts.ts modules/website-check/service.test.ts
git commit -m "feat(website-check): getModulePrompt geeft strictness mee" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Injecteer de strengheid in de prompt

**Files:**
- Modify: `modules/website-check/service.ts` (import; regel 113 destructuring; `buildPrompt` regel 129-137)
- Test: `modules/website-check/service.test.ts` (nieuwe tests toevoegen)

- [ ] **Step 1: Write the failing tests**

Voeg onderaan `modules/website-check/service.test.ts` toe:

```ts
test("runAnalysis: injecteert de strengheid-kalibratie (default 3) in de prompt", async () => {
  const { deps, analyze } = makeDeps(); // fetchPrompt-mock heeft strictness: 3
  await runAnalysis(
    { sessionId: "s5", userId: USER_ID, websiteUrl: "https://x.nl", companyName: "X" },
    deps,
  );
  const prompt = analyze.mock.calls[0][0].prompt as string;
  expect(prompt).toContain("BEOORDELINGSSTRENGHEID");
  expect(prompt).toContain("Beoordeel evenwichtig");
});

test("runAnalysis: hoge strengheid → strenge kalibratie in de prompt", async () => {
  const { deps, analyze } = makeDeps();
  deps.fetchPrompt = vi.fn().mockResolvedValue({
    prompt: "Analyseer {websiteUrl}. Inhoud:\n{scrapedContent}",
    provider: "claude" as const,
    strictness: 5,
  });
  await runAnalysis(
    { sessionId: "s6", userId: USER_ID, websiteUrl: "https://x.nl", companyName: "X" },
    deps,
  );
  const prompt = analyze.mock.calls[0][0].prompt as string;
  expect(prompt).toContain("Beoordeel zeer streng");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run modules/website-check/service.test.ts -t "strengheid"`
Expected: FAIL — de prompt bevat nog geen `BEOORDELINGSSTRENGHEID`-blok.

- [ ] **Step 3: Voeg de import toe**

Boven in `modules/website-check/service.ts`, bij de overige imports:

```ts
import { strictnessInstruction } from "@/lib/modules/strictness";
```

- [ ] **Step 4: Lees strictness uit fetchPrompt**

In `runAnalysis`, vervang regel 113:

```ts
    const { prompt: template, provider } = await deps.fetchPrompt(MODULE_SLUG);
```

door:

```ts
    const { prompt: template, provider, strictness } = await deps.fetchPrompt(MODULE_SLUG);
```

- [ ] **Step 5: Prik het blok in `buildPrompt`**

Vervang de body van `buildPrompt` (regel 129-137) door:

```ts
    function buildPrompt(scrapedContent: string): string {
      const header = substitutePlaceholders(template, {
        ...globalPlaceholders(),
        websiteUrl: args.websiteUrl,
        companyName: args.companyName || "Onbekend",
        scrapedContent: scrapedContent || "(Kon website niet laden)",
      });
      return `${header}\n\n---\nBEOORDELINGSSTRENGHEID (bepaalt hoe streng je cijfers toekent):\n\n${strictnessInstruction(strictness)}\n\n---\nFORMAT-TEMPLATE (volg deze structuur exact, vervang placeholders door inhoud op basis van de geschraapte data; behoud markdown-structuur, koppen en tabellen):\n\n${formatTemplate}\n\n---\nSchrijf nu de gevulde versie van bovenstaand format. Geef alleen de markdown terug, geen JSON, geen uitleg eromheen.`;
    }
```

(De Perplexity byte-cap blijft correct: `overheadBytes` wordt op `buildPrompt("")` gemeten, dus de strengheid-tekst telt automatisch mee.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run modules/website-check/service.test.ts`
Expected: PASS (alle tests, inclusief de twee nieuwe en de bestaande `FORMAT-TEMPLATE`-assertie).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck 2>&1 | grep "service.ts" || echo "schoon"`
Expected: `schoon`.

- [ ] **Step 8: Commit**

```bash
git add modules/website-check/service.ts modules/website-check/service.test.ts
git commit -m "feat(website-check): injecteer strengheid-kalibratie in de prompt" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `saveStrictness`-server-actie

**Files:**
- Modify: `app/(admin)/admin/prompts/[slug]/actions.ts`

- [ ] **Step 1: Voeg schema + actie toe**

Onderaan `app/(admin)/admin/prompts/[slug]/actions.ts` toevoegen (alle gebruikte imports — `z`, `db`, `modules`, `eq`, `revalidatePath`, `requireAdmin` — staan al in dit bestand):

```ts
const SaveStrictnessSchema = z.object({
  slug: z.string().min(1),
  strictness: z.number().int().min(1).max(5),
});

/** Sla alleen de strengheid op. Bewust los van savePrompt: een strengheid-
 *  wijziging hoort niet in de prompt-version-history. */
export async function saveStrictness(input: unknown): Promise<void> {
  await requireAdmin();
  const { slug, strictness } = SaveStrictnessSchema.parse(input);

  await db
    .update(modules)
    .set({ strictness })
    .where(eq(modules.slug, slug));

  revalidatePath(`/admin/prompts/${slug}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck 2>&1 | grep "actions.ts" || echo "schoon"`
Expected: `schoon`.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/prompts/[slug]/actions.ts"
git commit -m "feat(admin): saveStrictness-actie voor de strengheidsknop" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Admin schuifknop (editor + page samen)

**Files:**
- Modify: `app/(admin)/admin/prompts/[slug]/editor-pane.tsx`
- Modify: `app/(admin)/admin/prompts/[slug]/page.tsx:62-69` en `:112-119`

> Deze twee bestanden zijn gekoppeld via de nieuwe prop `initialStrictness`; ze landen samen om de compile groen te houden.

- [ ] **Step 1: Breid `EditorPane` uit — imports + Props + state**

In `editor-pane.tsx`:

a) Voeg imports toe naast de bestaande:

```ts
import { savePrompt, resetPrompt, saveStrictness } from "./actions";
import { strictnessLabel } from "@/lib/modules/strictness";
```

(vervang de bestaande `import { savePrompt, resetPrompt } from "./actions";`-regel door de eerste hierboven.)

b) Onder de `MODULES_USING_DB_PROMPT`-set toevoegen:

```ts
// Alleen scorende modules tonen de strengheidsknop; anders wekt de knop de
// indruk dat hij ergens invloed op heeft terwijl de runtime hem negeert.
const SCORING_MODULES = new Set<string>(["website-check"]);
```

c) Voeg `initialStrictness` toe aan de `Props`-interface (na `initialProvider`):

```ts
  initialStrictness: number;
```

d) Voeg `initialStrictness` toe aan de gedestructureerde props van `EditorPane` (na `initialProvider`).

e) Voeg state toe naast de bestaande `useState`-regels:

```ts
  const [strictness, setStrictness] = useState(initialStrictness);
  const [strictnessSaving, setStrictnessSaving] = useState(false);
```

f) Neem `initialStrictness` mee in de bestaande sync-`useEffect`:

```ts
  useEffect(() => {
    setPrompt(initialPrompt);
    setProvider(initialProvider);
    setStrictness(initialStrictness);
  }, [initialPrompt, initialProvider, initialStrictness, slug]);
```

- [ ] **Step 2: Voeg de persist-functie toe**

Naast `handleSave`/`handleReset` in `EditorPane`:

```ts
  async function persistStrictness(value: number) {
    setStrictness(value);
    setStrictnessSaving(true);
    try {
      await saveStrictness({ slug, strictness: value });
    } finally {
      setStrictnessSaving(false);
    }
  }
```

- [ ] **Step 3: Render de schuifknop**

In de JSX, direct ná het Provider-blok (de `<div className="mt-6">` met de provider-`<select>`, eindigend op regel ~149) invoegen:

```tsx
      {SCORING_MODULES.has(slug) && (
        <div className="mt-6">
          <label className="text-sm font-medium text-gray-700">
            Beoordelingsstrengheid
          </label>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-xs text-gray-500">Mild</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={strictness}
              onChange={(e) => void persistStrictness(Number(e.target.value))}
              className="w-56"
            />
            <span className="text-xs text-gray-500">Zeer streng</span>
            <span className="ml-2 text-sm font-semibold text-purple-700">
              {strictness} — {strictnessLabel(strictness)}
            </span>
            {strictnessSaving && (
              <span className="text-xs text-gray-400">opslaan…</span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Bepaalt hoe streng de AI cijfers toekent bij nieuwe analyses. 3 is
            evenwichtig (huidig gedrag). De knop raakt bestaande rapporten niet.
          </p>
        </div>
      )}
```

- [ ] **Step 4: Geef `strictness` door vanuit de page**

In `page.tsx`, voeg `strictness` toe aan de module-select (regel 62-69):

```ts
  const [row] = await db
    .select({
      defaultPrompt: modules.defaultPrompt,
      provider: modules.provider,
      strictness: modules.strictness,
    })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);
  if (!row) notFound();
```

En geef de prop door aan `<EditorPane>` (regel 112-119):

```tsx
        <EditorPane
          slug={slug}
          moduleName={meta.name}
          moduleStatus={meta.status}
          initialPrompt={row.defaultPrompt ?? ""}
          initialProvider={row.provider as "claude" | "perplexity"}
          initialStrictness={row.strictness ?? 3}
          placeholders={placeholders}
        />
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck 2>&1 | grep -E "editor-pane|prompts/\[slug\]/page" || echo "schoon"`
Expected: `schoon`.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/prompts/[slug]/editor-pane.tsx" "app/(admin)/admin/prompts/[slug]/page.tsx"
git commit -m "feat(admin): strengheidsknop op de website-check prompt-editor" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Volledige verificatie

**Files:** geen wijzigingen — dit is een verificatie-taak.

- [ ] **Step 1: Volledige testsuite**

Run: `npm run test`
Expected: alle suites groen, inclusief `strictness.test.ts`, `service.test.ts`, `parseReport.test.ts`.

- [ ] **Step 2: Volledige typecheck**

Run: `npm run typecheck 2>&1 | grep -v "\.next/" || echo "schoon buiten .next"`
Expected: geen fouten buiten de bekende gedupliceerde `.next/... 2.ts`-artefacten.

- [ ] **Step 3: Browser-verificatie van de admin-knop**

Start de dev-server via de preview-tool (`.claude/launch.json`, anders `npm run dev`) en open `/admin/prompts/website-check` (inloggen als admin-account vereist).

Verifieer:
1. De schuifknop staat zichtbaar onder Provider, met label "3 — Evenwichtig".
2. Sleep naar 5 → label wordt "5 — Zeer streng", "opslaan…" flitst kort.
3. Herlaad de pagina → de knop staat nog op 5 (waarde is gepersisteerd in de DB).
4. Zet weer terug op 3 en herlaad → staat op 3.

Vang bewijs met een screenshot van de knop op stand 5.

- [ ] **Step 4: (Optioneel) end-to-end prompt-controle**

Als je een echte analyse wilt bevestigen: draai met strengheid 5 een website-check en controleer via de Vercel/runtime-logs of de samengestelde prompt het `BEOORDELINGSSTRENGHEID`-blok met "Beoordeel zeer streng" bevat. Dit is optioneel; de service-test dekt de injectie al deterministisch.

- [ ] **Step 5: Herstel de admin-stand**

Zet de strengheid terug op de gewenste productiewaarde (default 3, tenzij anders afgesproken) zodat de knop niet per ongeluk op een teststand blijft staan.

---

## Self-review (uitgevoerd bij het schrijven)

- **Spec-dekking:** datamodel → T2; kalibratieteksten/helpers → T1; injectie → T4; `getModulePrompt` → T3; admin-UI → T6; `saveStrictness` → T5; testplan → T1/T4/T7. Alle spec-secties gedekt.
- **Geen placeholders:** elke code-stap bevat volledige code; geen TODO/TBD.
- **Type-consistentie:** `strictnessInstruction`/`strictnessLabel`/`clampStrictness` identiek gebruikt in T1, T4, T6; `getModulePrompt`-returnvorm `{prompt, provider, strictness}` consistent tussen T3 (definitie), de service-mocks (T3/T4) en het gebruik in `service.ts` (T4); prop `initialStrictness` gedefinieerd in T6-Props en doorgegeven vanuit page in T6.
- **Groen bij elke commit:** T3 werkt de mocks bij vóór de type-wijziging effect heeft; T6 bundelt editor + page.
