# Website Check Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw de Website Check-module in `oarnolds/positionr-app`: gebruiker laat z'n B2B-website analyseren (11 onderdelen + scores + acties), resultaat **op het scherm** (geen PDF), met historie, deelbare read-only link en herlaad/versies.

**Architecture:** Spiegelt ICP-analyse: `modules/website-check/{schema,prompt,scraper,service,components}` + `app/(app)/modules/website-check/{page,actions,[sessionId]}` + publieke route `app/r/[shareSlug]`. Hergebruikt bestaande `sessions`-tabel en `profiles`-velden — geen nieuwe tabellen. AI via `analyzeWithCachedSystem`.

**Tech Stack:** Next.js (App Router) · TypeScript · Drizzle ORM (postgres-js) · Supabase Auth · `@anthropic-ai/sdk` (Claude Sonnet 4.6) · Zod · Tailwind · pnpm · Vitest (nieuw).

**Spec:** `docs/superpowers/specs/2026-05-19-website-check-module-design.md`

---

## File Structure

**Aan te maken:**
- `vitest.config.ts` — vitest-config (eenmalig, voor alle module-tests)
- `modules/website-check/index.ts` — MODULE_SLUG-constant + barrel
- `modules/website-check/schema.ts` — Zod input/output schema's
- `modules/website-check/schema.test.ts`
- `modules/website-check/prompt.ts` — SYSTEM_PROMPT + buildUserPrompt()
- `modules/website-check/prompt.test.ts`
- `modules/website-check/scraper.ts` — scrapeWebsite()
- `modules/website-check/scraper.test.ts`
- `modules/website-check/service.ts` — createSession + runAnalysis
- `modules/website-check/service.test.ts`
- `modules/website-check/components/WebsiteCheckResultView.tsx`
- `app/(app)/modules/website-check/actions.ts` — server actions
- `app/(app)/modules/website-check/[sessionId]/page.tsx` — resultaatpagina
- `app/r/[shareSlug]/page.tsx` — publieke deellink
- `app/r/[shareSlug]/layout.tsx` — `noindex` metadata voor `/r/*`

**Te wijzigen:**
- `package.json` — vitest-deps + `test`/`test:watch` scripts
- `app/(app)/modules/website-check/page.tsx` — placeholder → echte invoer + historie

---

## Task 0: Vitest opzetten (test-infra)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `modules/website-check/__smoke__.test.ts` (tijdelijk, wordt later vervangen)

- [ ] **Step 1: Vitest installeren als devDependency**

```bash
pnpm add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: `vitest.config.ts` aanmaken**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["modules/**/*.test.ts", "lib/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: scripts toevoegen aan `package.json`**

Voeg toe aan `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: smoke-test schrijven die faalt-bedoeld-en-dan-slaagt**

```ts
// modules/website-check/__smoke__.test.ts
import { test, expect } from "vitest";

test("vitest werkt", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: tests draaien (eerste keer)**

Run: `pnpm test`
Expected: `1 passed` (smoke-test slaagt).

- [ ] **Step 6: commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts modules/website-check/__smoke__.test.ts
git commit -m "test: vitest opgezet voor module-tests"
```

---

## Task 1: MODULE_SLUG-constant + barrel

**Files:**
- Create: `modules/website-check/index.ts`

- [ ] **Step 1: Failing test**

```ts
// modules/website-check/__smoke__.test.ts (vervang inhoud)
import { test, expect } from "vitest";
import { MODULE_SLUG } from "./index";

test("MODULE_SLUG = 'website-check'", () => {
  expect(MODULE_SLUG).toBe("website-check");
});
```

- [ ] **Step 2: Run en zie 'm falen**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Implementatie**

```ts
// modules/website-check/index.ts
export const MODULE_SLUG = "website-check" as const;
```

- [ ] **Step 4: Run, slaagt**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Hernoem het smoke-bestand naar wat het is**

```bash
git mv modules/website-check/__smoke__.test.ts modules/website-check/index.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add modules/website-check/index.ts modules/website-check/index.test.ts
git commit -m "feat(website-check): module slug-constant"
```

---

## Task 2: Zod output-schema

**Files:**
- Create: `modules/website-check/schema.ts`
- Create: `modules/website-check/schema.test.ts`

- [ ] **Step 1: Failing test**

```ts
// modules/website-check/schema.test.ts
import { test, expect } from "vitest";
import { WebsiteCheckOutputSchema, WebsiteCheckInputSchema } from "./schema";

const validOutput = {
  companyName: "Datapas B.V.",
  websiteUrl: "https://datapas.nl",
  overallScore: 7.4,
  executiveSummary: "Sterke propositie, zwakke CTA's.",
  onderdelen: Array.from({ length: 11 }, (_, i) => ({
    naam: `Onderdeel ${i + 1}`,
    score: 7,
    toelichting: "ok",
    verbeterpunten: ["punt"],
  })),
  sterkePunten: ["a", "b", "c"],
  verbeterpunten: ["x", "y", "z"],
  topActies: [
    { actie: "fix CTA", impact: "hoog" as const, toelichting: "primair" },
  ],
};

test("output schema accepteert geldige analyse", () => {
  expect(() => WebsiteCheckOutputSchema.parse(validOutput)).not.toThrow();
});

test("output schema weigert ongeldige impact", () => {
  const bad = { ...validOutput, topActies: [{ actie: "x", impact: "extreem", toelichting: "y" }] };
  expect(() => WebsiteCheckOutputSchema.parse(bad)).toThrow();
});

test("input schema vereist URL", () => {
  expect(() => WebsiteCheckInputSchema.parse({ websiteUrl: "" })).toThrow();
  expect(() => WebsiteCheckInputSchema.parse({ websiteUrl: "https://x.nl" })).not.toThrow();
});
```

- [ ] **Step 2: Run, faalt**

Run: `pnpm test schema`
Expected: FAIL (module bestaat niet).

- [ ] **Step 3: Implementatie**

```ts
// modules/website-check/schema.ts
import { z } from "zod";

export const ImpactSchema = z.enum(["hoog", "middel", "laag"]);

export const WebsiteCheckInputSchema = z.object({
  websiteUrl: z.string().trim().min(3, "URL is verplicht"),
  companyName: z.string().trim().optional(),
});
export type WebsiteCheckInput = z.infer<typeof WebsiteCheckInputSchema>;

const OnderdeelSchema = z.object({
  naam: z.string(),
  score: z.number().min(1).max(10),
  toelichting: z.string(),
  verbeterpunten: z.array(z.string()),
});

const ActieSchema = z.object({
  actie: z.string(),
  impact: ImpactSchema,
  toelichting: z.string(),
});

export const WebsiteCheckOutputSchema = z.object({
  companyName: z.string(),
  websiteUrl: z.string(),
  overallScore: z.number().min(1).max(10),
  executiveSummary: z.string(),
  onderdelen: z.array(OnderdeelSchema),
  sterkePunten: z.array(z.string()),
  verbeterpunten: z.array(z.string()),
  topActies: z.array(ActieSchema),
});
export type WebsiteCheckOutput = z.infer<typeof WebsiteCheckOutputSchema>;
```

- [ ] **Step 4: Run, slaagt**

Run: `pnpm test schema`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/schema.ts modules/website-check/schema.test.ts
git commit -m "feat(website-check): Zod-schemas voor input + analyse-output"
```

---

## Task 3: Prompt-module

**Files:**
- Create: `modules/website-check/prompt.ts`
- Create: `modules/website-check/prompt.test.ts`

- [ ] **Step 1: Failing test**

```ts
// modules/website-check/prompt.test.ts
import { test, expect } from "vitest";
import { SYSTEM_PROMPT, buildUserPrompt, ONDERDELEN } from "./prompt";

test("11 vaste onderdelen in juiste volgorde", () => {
  expect(ONDERDELEN).toHaveLength(11);
  expect(ONDERDELEN[0]).toBe("Waardepropositie");
  expect(ONDERDELEN[6]).toBe("CTA's");
  expect(ONDERDELEN[10]).toBe("Contactpagina");
});

test("SYSTEM_PROMPT eist Nederlands + JSON", () => {
  expect(SYSTEM_PROMPT).toMatch(/Nederlands/);
  expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/json/);
});

test("buildUserPrompt bevat input + alle 11 onderdelen", () => {
  const p = buildUserPrompt({
    companyName: "Datapas B.V.",
    websiteUrl: "https://datapas.nl",
    scrapedContent: "Onze homepage tekst…",
  });
  expect(p).toContain("Datapas B.V.");
  expect(p).toContain("https://datapas.nl");
  expect(p).toContain("Onze homepage tekst…");
  for (const naam of ONDERDELEN) expect(p).toContain(naam);
});
```

- [ ] **Step 2: Run, faalt**

Run: `pnpm test prompt`
Expected: FAIL.

- [ ] **Step 3: Implementatie (port van Manus prompt)**

```ts
// modules/website-check/prompt.ts
export const ONDERDELEN = [
  "Waardepropositie",
  "Klantvoordelen",
  "Diensten/Features",
  "Proces",
  "Bewijsvoering",
  "Klantcases",
  "CTA's",
  "Content",
  "Schrijfstijl",
  "Actualiteit",
  "Contactpagina",
] as const;

const ONDERDEEL_DETAILS: Record<(typeof ONDERDELEN)[number], string> = {
  Waardepropositie: "Is deze direct duidelijk, onderscheidend en relevant?",
  Klantvoordelen: "Zijn de voordelen concreet, resultaatgericht en overtuigend?",
  "Diensten/Features": "Is helder uitgelegd wat het bedrijf doet en hoe het werkt?",
  Proces: "Is het stappenplan duidelijk en logisch?",
  Bewijsvoering: "Kwaliteit en zichtbaarheid van cases, referenties en testimonials.",
  Klantcases: "Beschrijven ze: klant, uitdaging, oplossing, resultaten?",
  "CTA's": "Zichtbaarheid, duidelijkheid en conversiekracht.",
  Content: "Aanwezigheid en relevantie van blogs, nieuws, whitepapers.",
  Schrijfstijl: "Inside-out of outside-in (klantgericht)?",
  Actualiteit: "Kloppen data, visuals en content nog?",
  Contactpagina: "Vindbaarheid, volledigheid en gebruiksgemak.",
};

export const SYSTEM_PROMPT = `Je bent een expert in B2B website analyse en conversie-optimalisatie.
Analyseer de opgegeven websitecontent grondig en geef een gestructureerde beoordeling.
Antwoord ALTIJD in het Nederlands. Geef alleen geldige JSON terug (geen markdown, geen uitleg eromheen).`;

export function buildUserPrompt(args: {
  companyName: string;
  websiteUrl: string;
  scrapedContent: string;
}): string {
  const lijst = ONDERDELEN.map(
    (n, i) => `${i + 1}. ${n} – ${ONDERDEEL_DETAILS[n]}`
  ).join("\n");
  return `Analyseer de volgende B2B-website en geef een gestructureerde beoordeling.

BEDRIJF: ${args.companyName || "Onbekend"}
WEBSITE URL: ${args.websiteUrl}

WEBSITE CONTENT:
${args.scrapedContent || "(Kon website niet laden)"}

Beoordeel de volgende 11 onderdelen elk met een score van 1-10 en een korte toelichting:
${lijst}

Geef ook:
- Een overall score (gemiddelde, 1-10)
- Een executive summary (2-3 zinnen)
- Top 3 sterke punten
- Top 3 verbeterpunten
- Top 5 concrete acties met hoogste impact (gesorteerd op prioriteit, elk met impact: hoog|middel|laag).`;
}
```

- [ ] **Step 4: Run, slaagt**

Run: `pnpm test prompt`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/prompt.ts modules/website-check/prompt.test.ts
git commit -m "feat(website-check): system + user prompts (port van Manus)"
```

---

## Task 4: Scraper

**Files:**
- Create: `modules/website-check/scraper.ts`
- Create: `modules/website-check/scraper.test.ts`

- [ ] **Step 1: Failing test**

```ts
// modules/website-check/scraper.test.ts
import { test, expect, vi, afterEach } from "vitest";
import { scrapeWebsite, normalizeUrl, htmlToText } from "./scraper";

afterEach(() => vi.restoreAllMocks());

test("normalizeUrl: voegt https:// toe als schema ontbreekt", () => {
  expect(normalizeUrl("datapas.nl")).toBe("https://datapas.nl");
  expect(normalizeUrl("http://x.nl")).toBe("http://x.nl");
  expect(normalizeUrl("https://x.nl")).toBe("https://x.nl");
});

test("htmlToText: strip scripts/styles/nav, behoudt zichtbare tekst", () => {
  const html = `
    <html><head><style>p{color:red}</style></head>
    <body><nav>menu</nav><script>var x=1</script>
    <h1>Hallo</h1><p>wereld</p></body></html>`;
  const t = htmlToText(html);
  expect(t).toContain("Hallo");
  expect(t).toContain("wereld");
  expect(t).not.toContain("menu");
  expect(t).not.toContain("color:red");
  expect(t).not.toContain("var x=1");
});

test("scrapeWebsite: succesvol → tekst (≤6000 tekens)", async () => {
  const big = "<p>" + "a".repeat(20000) + "</p>";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => big,
  }));
  const t = await scrapeWebsite("https://datapas.nl");
  expect(t.length).toBeLessThanOrEqual(6000);
});

test("scrapeWebsite: gooit bij HTTP-fout", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
    text: async () => "",
  }));
  await expect(scrapeWebsite("https://x.nl")).rejects.toThrow(/503/);
});
```

- [ ] **Step 2: Run, faalt**

Run: `pnpm test scraper`
Expected: FAIL.

- [ ] **Step 3: Implementatie**

```ts
// modules/website-check/scraper.ts
const MAX_CHARS = 6000;
const FETCH_TIMEOUT_MS = 12_000;

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeWebsite(rawUrl: string): Promise<string> {
  const url = normalizeUrl(rawUrl);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PositionrBot/1.0 (+https://positionr.nl)" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Fetch faalde: HTTP ${res.status}`);
    const html = await res.text();
    const text = htmlToText(html);
    if (!text) throw new Error("Geen bruikbare tekst gevonden");
    return text.slice(0, MAX_CHARS);
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 4: Run, slaagt**

Run: `pnpm test scraper`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/scraper.ts modules/website-check/scraper.test.ts
git commit -m "feat(website-check): scraper (URL-norm + HTML→tekst + fetch)"
```

---

## Task 5: Service — createSession + runAnalysis

**Files:**
- Create: `modules/website-check/service.ts`
- Create: `modules/website-check/service.test.ts`

> De service heeft DB-zijde-effecten. We injecteren de DB-helpers via een
> klein `deps`-object → testbaar zonder echte Drizzle-mocks.

- [ ] **Step 1: Failing test**

```ts
// modules/website-check/service.test.ts
import { test, expect, vi } from "vitest";
import { runAnalysis, type ServiceDeps } from "./service";
import type { WebsiteCheckOutput } from "./schema";

const mkOutput = (): WebsiteCheckOutput => ({
  companyName: "Datapas B.V.",
  websiteUrl: "https://datapas.nl",
  overallScore: 7,
  executiveSummary: "ok",
  onderdelen: Array.from({ length: 11 }, () => ({
    naam: "x", score: 7, toelichting: "y", verbeterpunten: [],
  })),
  sterkePunten: ["a","b","c"], verbeterpunten: ["x","y","z"],
  topActies: [{ actie: "fix", impact: "hoog", toelichting: "nu" }],
});

function makeDeps(): ServiceDeps & { _state: { updates: any[] } } {
  const state = { updates: [] as any[] };
  return {
    _state: state,
    scrape: vi.fn().mockResolvedValue("scraped text"),
    analyze: vi.fn().mockResolvedValue({
      data: mkOutput(),
      promptUsed: "p", llmModel: "claude-sonnet-4-6",
      llmInputTokens: 100, llmOutputTokens: 50, llmCostCents: 1,
    }),
    updateSession: vi.fn(async (id, patch) => { state.updates.push({ id, patch }); }),
  };
}

test("runAnalysis: succes → update met status=approved + output + telemetrie", async () => {
  const deps = makeDeps();
  await runAnalysis(
    { sessionId: "s1", websiteUrl: "https://datapas.nl", companyName: "Datapas B.V." },
    deps,
  );
  expect(deps.scrape).toHaveBeenCalledWith("https://datapas.nl");
  expect(deps.analyze).toHaveBeenCalled();
  expect(deps._state.updates).toHaveLength(1);
  const patch = deps._state.updates[0].patch;
  expect(patch.status).toBe("approved");
  expect(patch.output).toBeDefined();
  expect(patch.llmModel).toBe("claude-sonnet-4-6");
  expect(patch.completedAt).toBeInstanceOf(Date);
});

test("runAnalysis: scrape-fout → status=failed + errorMessage", async () => {
  const deps = makeDeps();
  deps.scrape = vi.fn().mockRejectedValue(new Error("boom"));
  await runAnalysis(
    { sessionId: "s1", websiteUrl: "https://x.nl", companyName: "X" },
    deps,
  );
  const patch = deps._state.updates[0].patch;
  expect(patch.status).toBe("failed");
  expect(patch.errorMessage).toMatch(/boom/);
});
```

- [ ] **Step 2: Run, faalt**

Run: `pnpm test service`
Expected: FAIL.

- [ ] **Step 3: Implementatie**

```ts
// modules/website-check/service.ts
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { analyzeWithCachedSystem, type AnalyzeResult } from "@/lib/ai/claude";
import { scrapeWebsite } from "./scraper";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import {
  WebsiteCheckOutputSchema,
  type WebsiteCheckOutput,
} from "./schema";
import { MODULE_SLUG } from "./index";

export type ServiceDeps = {
  scrape: (url: string) => Promise<string>;
  analyze: (args: { system: string; user: string }) => Promise<AnalyzeResult<WebsiteCheckOutput>>;
  updateSession: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

function generateShareSlug(): string {
  return randomBytes(8).toString("hex");
}

// Default deps die in productie de echte DB/Claude gebruiken
export const defaultDeps: ServiceDeps = {
  scrape: scrapeWebsite,
  analyze: ({ system, user }) =>
    analyzeWithCachedSystem({ system, user, schema: WebsiteCheckOutputSchema }),
  updateSession: async (id, patch) => {
    await db.update(sessions).set(patch).where(eq(sessions.id, id));
  },
};

/**
 * Maakt een nieuwe sessie aan (status=running) en retourneert id + slug.
 * Aanroeper triggert daarna runAnalysis.
 */
export async function createWebsiteCheckSession(input: {
  userId: string;
  websiteUrl: string;
  companyName: string;
}): Promise<{ sessionId: string; shareSlug: string }> {
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

/**
 * Voert de analyse uit: scrape → Claude → update sessie.
 * Updates lopen via deps zodat we kunnen mocken in tests.
 */
export async function runAnalysis(
  args: { sessionId: string; websiteUrl: string; companyName: string },
  deps: ServiceDeps = defaultDeps,
): Promise<void> {
  try {
    const scraped = await deps.scrape(args.websiteUrl);
    const user = buildUserPrompt({
      companyName: args.companyName,
      websiteUrl: args.websiteUrl,
      scrapedContent: scraped,
    });
    const result = await deps.analyze({ system: SYSTEM_PROMPT, user });
    await deps.updateSession(args.sessionId, {
      status: "approved",
      output: result.data,
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

- [ ] **Step 4: Run, slaagt**

Run: `pnpm test service`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/service.ts modules/website-check/service.test.ts
git commit -m "feat(website-check): service createSession + runAnalysis (TDD met mocks)"
```

---

## Task 6: Server actions

**Files:**
- Create: `app/(app)/modules/website-check/actions.ts`

> Server actions zijn moeilijk puur te unit-testen (Next-runtime + redirect).
> Verificatie gebeurt in Task 11 als runtime-smoke-test.

- [ ] **Step 1: Implementatie**

```ts
// app/(app)/modules/website-check/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles, sessions } from "@/lib/db/schema";
import {
  createWebsiteCheckSession,
  runAnalysis,
} from "@/modules/website-check/service";
import { WebsiteCheckInputSchema } from "@/modules/website-check/schema";
import { MODULE_SLUG } from "@/modules/website-check";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/website-check");
  return user;
}

export async function startAnalysis(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = WebsiteCheckInputSchema.parse({
    websiteUrl: formData.get("websiteUrl"),
    companyName: formData.get("companyName") ?? undefined,
  });

  // 1) Profiel bijwerken (gedeeld profiel voor alle modules)
  await db
    .update(profiles)
    .set({
      websiteUrl: parsed.websiteUrl,
      ...(parsed.companyName ? { companyName: parsed.companyName } : {}),
    })
    .where(eq(profiles.id, user.id));

  // 2) Sessie aanmaken
  const { sessionId } = await createWebsiteCheckSession({
    userId: user.id,
    websiteUrl: parsed.websiteUrl,
    companyName: parsed.companyName ?? "",
  });

  // 3) Synchroon analyseren (slik fouten — sessie krijgt status=failed)
  await runAnalysis({
    sessionId,
    websiteUrl: parsed.websiteUrl,
    companyName: parsed.companyName ?? "",
  });

  revalidatePath("/modules/website-check");
  redirect(`/modules/website-check/${sessionId}`);
}

export async function regenerateAnalysis(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sourceSessionId = String(formData.get("sourceSessionId") ?? "");
  const [src] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sourceSessionId))
    .limit(1);
  if (!src || src.userId !== user.id || src.moduleSlug !== MODULE_SLUG) {
    redirect("/modules/website-check");
  }
  const input = src.input as { websiteUrl: string; companyName?: string };
  const { sessionId } = await createWebsiteCheckSession({
    userId: user.id,
    websiteUrl: input.websiteUrl,
    companyName: input.companyName ?? "",
  });
  await runAnalysis({
    sessionId,
    websiteUrl: input.websiteUrl,
    companyName: input.companyName ?? "",
  });
  revalidatePath("/modules/website-check");
  redirect(`/modules/website-check/${sessionId}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/modules/website-check/actions.ts
git commit -m "feat(website-check): server actions startAnalysis + regenerateAnalysis"
```

---

## Task 7: WebsiteCheckResultView component

**Files:**
- Create: `modules/website-check/components/WebsiteCheckResultView.tsx`

> Pure presentatie-component. Geen tests (visueel; verificatie via Task 11).
> Implementeert de goedgekeurde hybride layout uit spec §6.

- [ ] **Step 1: Implementatie**

```tsx
// modules/website-check/components/WebsiteCheckResultView.tsx
import type { WebsiteCheckOutput } from "../schema";

function scoreColor(score: number): { bg: string; text: string; bar: string } {
  if (score >= 7.5) return { bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (score >= 5) return { bg: "bg-amber-100", text: "text-amber-700", bar: "bg-amber-500" };
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

export function WebsiteCheckResultView({
  data,
  readOnly = false,
}: {
  data: WebsiteCheckOutput;
  readOnly?: boolean;
}) {
  const overall = scoreColor(data.overallScore);
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Hero */}
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
          <p className="mt-2 text-gray-800">
            <strong>Samenvatting:</strong> {data.executiveSummary}
          </p>
        </div>
      </div>

      {/* Onderdelen */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Onderdelen ({data.onderdelen.length})</h2>
      <div className="space-y-2">
        {data.onderdelen.map((o, i) => {
          const c = scoreColor(o.score);
          return (
            <div key={i} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <strong>
                  {i + 1}. {o.naam}
                </strong>
                <span className={`rounded-md px-2.5 py-0.5 text-sm font-extrabold ${c.bg} ${c.text}`}>
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

      {/* Sterk / Verbeter */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-bold text-emerald-700">Top 3 sterke punten</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
            {data.sterkePunten.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-700">Top 3 verbeterpunten</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
            {data.verbeterpunten.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      </div>

      {/* Acties */}
      <h2 className="mt-8 mb-3 text-lg font-bold">Top 5 prioriteitsacties</h2>
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

      {!readOnly && (
        <p className="mt-8 text-xs text-gray-500">
          Knoppen "Opnieuw analyseren" + "Deel" worden op de resultaatpagina toegevoegd (Task 9).
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add modules/website-check/components/WebsiteCheckResultView.tsx
git commit -m "feat(website-check): WebsiteCheckResultView component (hybride layout)"
```

---

## Task 8: Module-startpagina (invoer + historie)

**Files:**
- Modify: `app/(app)/modules/website-check/page.tsx` (vervangt placeholder)

- [ ] **Step 1: Implementatie**

```tsx
// app/(app)/modules/website-check/page.tsx
import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";
import { redirect } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { profiles, sessions } from "@/lib/db/schema";
import { MODULE_SLUG } from "@/modules/website-check";
import { startAnalysis } from "./actions";

export default async function WebsiteCheckHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/website-check");

  const [profile] = await db
    .select({ companyName: profiles.companyName, websiteUrl: profiles.websiteUrl })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const history = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      input: sessions.input,
      output: sessions.output,
      status: sessions.status,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), eq(sessions.moduleSlug, MODULE_SLUG)))
    .orderBy(desc(sessions.createdAt))
    .limit(20);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/modules" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Website Check</h1>
          <p className="text-gray-600">
            Analyseer uw B2B-website op waardepropositie, CTA&apos;s, content en verbeterpunten.
          </p>
        </div>
      </div>

      <form action={startAnalysis} className="mt-8 space-y-3 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Website-URL</span>
          <input
            name="websiteUrl"
            type="text"
            defaultValue={profile?.websiteUrl ?? ""}
            placeholder="bijv. https://uwbedrijf.nl"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Bedrijfsnaam (optioneel)</span>
          <input
            name="companyName"
            type="text"
            defaultValue={profile?.companyName ?? ""}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 font-semibold text-white">
          Analyseer website
        </button>
      </form>

      <h2 className="mt-10 mb-2 text-lg font-bold">Eerdere checks</h2>
      {history.length === 0 ? (
        <p className="text-sm text-gray-500">Nog geen eerdere analyses.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => {
            const input = (h.input as { websiteUrl?: string }) ?? {};
            const out = (h.output as { overallScore?: number } | null) ?? null;
            return (
              <li key={h.id}>
                <Link
                  href={`/modules/website-check/${h.id}`}
                  className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
                >
                  <div>
                    <div className="text-sm font-semibold">{input.websiteUrl ?? "—"}</div>
                    <div className="text-xs text-gray-500">
                      {h.createdAt instanceof Date ? h.createdAt.toLocaleString("nl-NL") : String(h.createdAt)} · {h.status}
                    </div>
                  </div>
                  {out?.overallScore !== undefined && (
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 text-sm font-bold text-purple-700">
                      {out.overallScore.toFixed(1)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/modules/website-check/page.tsx
git commit -m "feat(website-check): startpagina met invoer + historie (vervangt placeholder)"
```

---

## Task 9: Resultaatpagina + "opnieuw" + "deel"

**Files:**
- Create: `app/(app)/modules/website-check/[sessionId]/page.tsx`

- [ ] **Step 1: Implementatie**

```tsx
// app/(app)/modules/website-check/[sessionId]/page.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
import { MODULE_SLUG } from "@/modules/website-check";
import { regenerateAnalysis } from "../actions";

export default async function WebsiteCheckResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/modules/website-check/${sessionId}`);

  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!row || row.userId !== user.id || row.moduleSlug !== MODULE_SLUG) notFound();

  const header = (
    <div className="mx-auto max-w-4xl px-6 pt-6">
      <Link href="/modules/website-check" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Terug
      </Link>
    </div>
  );

  if (row.status === "running") {
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-lg font-semibold">Bezig met analyseren…</p>
          <p className="mt-1 text-sm text-gray-600">Dit duurt ongeveer 10-30 seconden. Ververs de pagina als het te lang lijkt te duren.</p>
        </div>
      </>
    );
  }

  if (row.status === "failed") {
    const input = row.input as { websiteUrl?: string };
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-lg font-semibold text-rose-700">Analyse mislukt</p>
          <p className="mt-1 text-sm text-gray-700">{row.errorMessage ?? "Onbekende fout."}</p>
          <form action={regenerateAnalysis} className="mt-4">
            <input type="hidden" name="sourceSessionId" value={row.id} />
            <button className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white">Opnieuw proberen</button>
          </form>
          <Link href="/modules/website-check" className="ml-3 text-sm text-purple-700 underline">
            Of: andere URL invoeren
          </Link>
          <p className="mt-3 text-xs text-gray-500">URL: {input.websiteUrl ?? "—"}</p>
        </div>
      </>
    );
  }

  // status === "approved"
  const parsed = WebsiteCheckOutputSchema.safeParse(row.output);
  if (!parsed.success) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-6 py-16 text-center text-rose-700">
          Resultaat-output is ongeldig opgeslagen.
        </div>
      </>
    );
  }

  const shareUrl = row.shareSlug
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/r/${row.shareSlug}`
    : "";

  return (
    <>
      {header}
      <WebsiteCheckResultView data={parsed.data} />
      <div className="mx-auto mt-2 mb-12 flex max-w-4xl items-center gap-3 px-6">
        <form action={regenerateAnalysis}>
          <input type="hidden" name="sourceSessionId" value={row.id} />
          <button className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 font-semibold text-white">
            Opnieuw analyseren
          </button>
        </form>
        {shareUrl && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-4 py-2 font-semibold"
            title="Open deellink (kopieer URL uit adresbalk om te delen)"
          >
            Deel (read-only link)
          </a>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/modules/website-check/\[sessionId\]/page.tsx
git commit -m "feat(website-check): resultaatpagina (running/failed/approved + opnieuw + deel)"
```

---

## Task 10: Publieke deelroute `/r/[shareSlug]`

**Files:**
- Create: `app/r/[shareSlug]/layout.tsx`
- Create: `app/r/[shareSlug]/page.tsx`

> Geen auth. Leest sessie via drizzle `db` (postgres-rol, omzeilt RLS) strikt op
> `shareSlug` én `status='approved'`. Render `WebsiteCheckResultView readOnly`.
> `noindex` zodat zoekmachines het niet indexeren.

- [ ] **Step 1: layout met noindex**

```tsx
// app/r/[shareSlug]/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
```

- [ ] **Step 2: page met sessie-lookup op shareSlug**

```tsx
// app/r/[shareSlug]/page.tsx
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
import { MODULE_SLUG } from "@/modules/website-check";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ shareSlug: string }>;
}) {
  const { shareSlug } = await params;
  const [row] = await db
    .select({ output: sessions.output, status: sessions.status, moduleSlug: sessions.moduleSlug })
    .from(sessions)
    .where(and(eq(sessions.shareSlug, shareSlug), eq(sessions.status, "approved")))
    .limit(1);

  if (!row || row.moduleSlug !== MODULE_SLUG) notFound();

  const parsed = WebsiteCheckOutputSchema.safeParse(row.output);
  if (!parsed.success) notFound();

  return <WebsiteCheckResultView data={parsed.data} readOnly />;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: geen errors.

- [ ] **Step 4: Commit**

```bash
git add app/r/\[shareSlug\]/layout.tsx app/r/\[shareSlug\]/page.tsx
git commit -m "feat(website-check): publieke read-only deellink /r/[shareSlug] (noindex)"
```

---

## Task 11: Runtime-smoke (lokaal) + push naar productie

**Files:** — (geen wijzigingen; verificatie + deploy)

- [ ] **Step 1: Volledige testsuite**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: alles slaagt.

- [ ] **Step 2: Lokaal smoke-testen**

```bash
pnpm dev
```
Doorloop in de browser (`http://localhost:3000`, ingelogd):
1. Open `/modules/website-check` → invoerformulier zichtbaar, URL voor-ingevuld uit profiel (indien al gevuld); historie leeg of correct.
2. Submit met `https://datapas.nl` → redirect naar `[sessionId]`, "Bezig met analyseren…", dan resultaat met overall score + 11 onderdelen + acties.
3. Klik **Opnieuw analyseren** → nieuwe sessie, oude blijft in historie.
4. Klik **Deel (read-only link)** → opent `/r/<shareSlug>` zonder auth, toont read-only resultaat (geen knoppen).
5. Forceer fout: submit een ongeldige URL (bv. `https://ditbestaatzeker-niet-12345.nl`) → resultaatpagina toont nette foutmelding + "Opnieuw proberen".

- [ ] **Step 3: Pre-push checks**

```bash
git status              # verwacht: clean (alleen lib/db/schema.ts WIP blijft staan)
git --no-pager log --oneline origin/main..HEAD   # lijst van nieuwe commits
```

- [ ] **Step 4: Push naar oarnolds (vraag user-bevestiging vóórdat dit draait)**

```bash
git push origin main
```
Verwacht: succesvolle push; Vercel start auto-deploy van het nieuwste commit.

- [ ] **Step 5: Productie-verificatie**

Wacht ~1-2 min, dan in Vercel-dashboard: nieuwste deployment **Ready**. Doorloop dezelfde 5 stappen op `https://positionr.nl/modules/website-check`. Test de deellink eenmaal in een **incognito-venster** (geen auth) om read-only weergave te bevestigen.

---

## Self-Review

**Spec-dekking:**
- §2 scope v1: ✓ (Tasks 0-10)
- §3 modulestructuur: ✓ (Tasks 1-7, 8-10)
- §3 datamodel (geen nieuwe tabel, hergebruik `profiles` + `sessions`): ✓ (Task 6 update profiles, Task 5 insert/update sessions)
- §4 user-flow: ✓ (Tasks 6, 8, 9)
- §5 AI-analyse (scrape + Claude + Zod + telemetrie): ✓ (Tasks 3, 4, 5)
- §6 hybride resultaat: ✓ (Task 7)
- §7 output-schema: ✓ (Task 2)
- §8 delen + noindex + capability-URL: ✓ (Task 10)
- §9 foutafhandeling: ✓ (Task 5 failed-pad, Task 9 UI)
- §10 tests: ✓ (Task 0 vitest, Tasks 2, 3, 4, 5 met TDD)
- §11 uitgesteld: nvt (zit niet in v1-plan).

**Geen placeholders:** alle code-stappen bevatten complete code; geen "TBD".

**Type-consistentie:** `MODULE_SLUG`, `ServiceDeps`, `WebsiteCheckOutput`,
`WebsiteCheckOutputSchema`, `WebsiteCheckInputSchema` worden consistent gebruikt
in Tasks 1-10. Server actions importeren uit `@/modules/website-check`.
`status`-waarden (`running`/`approved`/`failed`) overal uit de bestaande
`sessionStatus`-enum.

Klaar voor uitvoering.
