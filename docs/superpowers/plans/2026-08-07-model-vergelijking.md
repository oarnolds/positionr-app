# Model-vergelijking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nieuwe `/modules/markdown/vergelijk` pagina waarmee je een URL invoert en de kost + kwaliteit van image-descriptions vergelijkt tussen Haiku 4.5, Opus 5 en Fable 5.

**Architecture:** Extending `lib/scraping/image-description.ts` met een optionele `model` parameter en usage-tracking. Aparte pagina met server action die pages 1x scrapet, images 1x downloadt, en de descriptie parallel door 3 modellen laat lopen. Client-component voor de UI (form + result-tabel) — geen persistente state, alles in-memory.

**Tech Stack:** Next.js 15 (server actions + client components), Anthropic SDK (usage in response), Vitest (unit tests voor pricing/aggregation).

**Ontwerp-doc:** `docs/superpowers/specs/2026-08-07-model-vergelijking-design.md`

---

## Task 1: Model-keyed pricing + helper

Voegt per-model pricing toe naast de bestaande provider-keyed `PRICING`. Bestaande code (`calculateCostCents` per provider) blijft werken; nieuwe code gebruikt `calculateModelCostCents` per exacte model-string.

**Files:**
- Modify: `lib/ai/pricing.ts`
- Create: `lib/ai/pricing.test.ts`

- [ ] **Step 1: Verify Fable 5 pricing before hard-coding a value**

Fable 5 pricing was niet bevestigd tijdens spec. Gebruik WebFetch om de actuele pricing op te halen:

```
WebFetch("https://www.anthropic.com/pricing", "What are the input and output token prices for claude-fable-5?")
```

Als niet vindbaar: gebruik conservatieve tussenschatting `{ input: 6, output: 22.5 }` (tussen Sonnet $3/$15 en Opus $15/$75 in). Werk het commentaar in de code bij zodat helder is dat dit een schatting is die naderhand geverifieerd moet worden.

- [ ] **Step 2: Write failing test for calculateModelCostCents**

Create `lib/ai/pricing.test.ts`:

```typescript
import { describe, test, expect } from "vitest";
import { calculateModelCostCents, MODEL_PRICING } from "./pricing";

describe("calculateModelCostCents", () => {
  test("haiku 4.5: 100k input + 10k output tokens → correct cents", () => {
    // Haiku 4.5: $1/M input, $5/M output
    // 100_000 * 1 / 1_000_000 = $0.10 input
    // 10_000 * 5 / 1_000_000 = $0.05 output
    // Totaal $0.15 = 15 cent
    const cents = calculateModelCostCents(
      "claude-haiku-4-5-20251001",
      100_000,
      10_000,
    );
    expect(cents).toBe(15);
  });

  test("opus 5: 100k input + 10k output tokens → correct cents", () => {
    // Opus 5: $15/M input, $75/M output
    // 100_000 * 15 / 1_000_000 = $1.50
    // 10_000 * 75 / 1_000_000 = $0.75
    // Totaal $2.25 = 225 cent
    const cents = calculateModelCostCents("claude-opus-5", 100_000, 10_000);
    expect(cents).toBe(225);
  });

  test("unknown model falls back to Sonnet pricing", () => {
    const knownCents = calculateModelCostCents("claude-sonnet-4-6", 1_000_000, 100_000);
    const unknownCents = calculateModelCostCents("does-not-exist", 1_000_000, 100_000);
    expect(unknownCents).toBe(knownCents);
  });

  test("all three vergelijk-modellen exist in MODEL_PRICING", () => {
    expect(MODEL_PRICING["claude-haiku-4-5-20251001"]).toBeDefined();
    expect(MODEL_PRICING["claude-opus-5"]).toBeDefined();
    expect(MODEL_PRICING["claude-fable-5"]).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/ai/pricing.test.ts`
Expected: FAIL — `MODEL_PRICING` en `calculateModelCostCents` bestaan nog niet.

- [ ] **Step 4: Add MODEL_PRICING + calculateModelCostCents to pricing.ts**

Voeg onderaan `lib/ai/pricing.ts` toe (gebruik de Fable 5 waarde uit Step 1):

```typescript
/**
 * Per-model pricing voor Claude-modellen. Gebruikt door tools die expliciet
 * een model kiezen (zoals /modules/markdown/vergelijk), i.p.v. het huidige
 * default-model uit PRICING.claude.model.
 *
 * Fable 5 pricing bevestigd via Anthropic pricing page op 2026-08-07:
 * TODO — vul hier de exacte bron en waarde in na Step 1.
 */
export const MODEL_PRICING: Record<
  string,
  { inputPerMTokUsd: number; outputPerMTokUsd: number }
> = {
  "claude-haiku-4-5-20251001": { inputPerMTokUsd: 1, outputPerMTokUsd: 5 },
  "claude-sonnet-4-6": { inputPerMTokUsd: 3, outputPerMTokUsd: 15 },
  "claude-opus-5": { inputPerMTokUsd: 15, outputPerMTokUsd: 75 },
  "claude-fable-5": { inputPerMTokUsd: 6, outputPerMTokUsd: 22.5 }, // TODO: verify — see Step 1
};

/**
 * Zelfde formule als calculateCostCents maar per exacte model-string.
 * Onbekende models vallen terug op het default-Claude tarief (Sonnet), zodat
 * we bij een typo geen NaN of $0 terugkrijgen.
 */
export function calculateModelCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[model] ?? {
    inputPerMTokUsd: PRICING.claude.inputPerMTokUsd,
    outputPerMTokUsd: PRICING.claude.outputPerMTokUsd,
  };
  const usd =
    (inputTokens / 1_000_000) * p.inputPerMTokUsd +
    (outputTokens / 1_000_000) * p.outputPerMTokUsd;
  return Math.round(usd * 100);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/ai/pricing.test.ts`
Expected: PASS — alle 4 tests groen.

- [ ] **Step 6: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app
git add lib/ai/pricing.ts lib/ai/pricing.test.ts
git commit -m "feat(pricing): MODEL_PRICING + calculateModelCostCents voor per-model kost-tracking

Naast de bestaande provider-keyed PRICING nu ook per-model entries voor
Haiku 4.5, Sonnet 4.6, Opus 5 en Fable 5. Voorbereidend voor de
/modules/markdown/vergelijk pagina die per model de exacte Claude-kosten
wil tonen."
```

---

## Task 2: Model + usage tracking in image-description.ts

`describeBatch` accepteert nu een `model` parameter en retourneert usage per call. `describeImageBuffers` accumuleert die usage over batches en berekent per model de totale kost. `describeImageUrls` geeft die aggregatie door.

**Files:**
- Modify: `lib/scraping/image-description.ts`
- Create: `lib/scraping/image-description.test.ts`

- [ ] **Step 1: Write failing test for cost aggregation**

Create `lib/scraping/image-description.test.ts`:

```typescript
import { describe, test, expect } from "vitest";
import { aggregateUsage } from "./image-description";

describe("aggregateUsage", () => {
  test("sums input+output tokens across batches", () => {
    const usages = [
      { inputTokens: 1000, outputTokens: 100 },
      { inputTokens: 2000, outputTokens: 200 },
      { inputTokens: 500, outputTokens: 50 },
    ];
    expect(aggregateUsage(usages)).toEqual({
      inputTokens: 3500,
      outputTokens: 350,
    });
  });

  test("empty array returns zero", () => {
    expect(aggregateUsage([])).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scraping/image-description.test.ts`
Expected: FAIL — `aggregateUsage` bestaat niet.

- [ ] **Step 3: Add types + exported aggregateUsage helper**

Voeg bovenin `lib/scraping/image-description.ts` (na de bestaande consts) toe:

```typescript
export type BatchUsage = { inputTokens: number; outputTokens: number };

export function aggregateUsage(usages: BatchUsage[]): BatchUsage {
  return usages.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}
```

- [ ] **Step 4: Run test to verify aggregateUsage passes**

Run: `npx vitest run lib/scraping/image-description.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend describeBatch to accept model + return usage**

Wijzig de bestaande `describeBatch` signature — nieuwe versie:

```typescript
async function describeBatch(
  batch: ImageInput[],
  model: string,
): Promise<{ descriptions: Array<string | null>; usage: BatchUsage }> {
  const content: Anthropic.Messages.ContentBlockParam[] = [];
  batch.forEach((img, i) => {
    content.push({
      type: "text",
      text: `Afbeelding ${i + 1}${img.alt ? ` (alt: "${img.alt}")` : ""}:`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: img.buffer.toString("base64"),
      },
    });
  });
  content.push({ type: "text", text: SYSTEM_INSTRUCTION });

  const response = await getClient().messages.create({
    model,
    max_tokens: 1500,
    messages: [{ role: "user", content }],
  });

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";
  return {
    descriptions: parseNumberedLines(text, batch.length),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
```

- [ ] **Step 6: Extend describeImageBuffers to accept model + return usage aggregate**

Nieuwe versie van de bestaande `describeImageBuffers`:

```typescript
export type DescribeResult = {
  descriptions: DescriptionMap;
  usage: BatchUsage;
  costCents: number;
  batchesOk: number;
  batchesFailed: number;
};

export async function describeImageBuffers(
  images: ImageInput[],
  options: { model?: string } = {},
): Promise<DescribeResult> {
  const model = options.model ?? PRICING.claude.model;
  const map: DescriptionMap = new Map();
  const batchUsages: BatchUsage[] = [];
  let batchesOk = 0;
  let batchesFailed = 0;

  if (images.length === 0) {
    return {
      descriptions: map,
      usage: { inputTokens: 0, outputTokens: 0 },
      costCents: 0,
      batchesOk: 0,
      batchesFailed: 0,
    };
  }

  const batches: ImageInput[][] = [];
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    batches.push(images.slice(i, i + BATCH_SIZE));
  }
  const visionStart = Date.now();
  await poolMap(batches, VISION_CONCURRENCY, async (batch, idx) => {
    const batchNum = idx + 1;
    const batchStart = Date.now();
    try {
      const { descriptions, usage } = await describeBatch(batch, model);
      batch.forEach((img, j) => map.set(img.key, descriptions[j]));
      batchUsages.push(usage);
      batchesOk++;
      console.log(
        `[md-timing]   vision batch ${batchNum}/${batches.length} (n=${batch.length}, model=${model}) done in ${Date.now() - batchStart}ms`,
      );
    } catch (err) {
      batch.forEach((img) => map.set(img.key, null));
      batchesFailed++;
      console.warn(
        `[md-timing]   vision batch ${batchNum}/${batches.length} (model=${model}) FAILED in ${Date.now() - batchStart}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
  console.log(
    `[md-timing] describeImageBuffers TOTAL vision ${Date.now() - visionStart}ms for ${images.length} images (${batches.length} batches, model=${model}, concurrency=${VISION_CONCURRENCY})`,
  );

  const usage = aggregateUsage(batchUsages);
  const costCents = calculateModelCostCents(
    model,
    usage.inputTokens,
    usage.outputTokens,
  );
  return { descriptions: map, usage, costCents, batchesOk, batchesFailed };
}
```

Voeg bovenin toe:

```typescript
import { PRICING, calculateModelCostCents } from "@/lib/ai/pricing";
```

- [ ] **Step 7: Update describeImageUrls to pass model + return usage**

Nieuwe versie:

```typescript
export async function describeImageUrls(
  images: UrlImageInput[],
  options: { model?: string } = {},
): Promise<DescribeResult> {
  const dlStart = Date.now();
  let slowDownloads = 0;
  const results = await poolMap(images, DOWNLOAD_CONCURRENCY, async (img) => {
    const t0 = Date.now();
    const data = await downloadImage(img.url);
    const dt = Date.now() - t0;
    if (dt > 3000) {
      slowDownloads++;
      console.log(
        `[md-timing]   slow download ${dt}ms ${data ? "ok" : "FAIL"} ${img.url}`,
      );
    }
    if (!data) return null;
    return {
      key: img.key,
      buffer: data.buffer,
      mimeType: data.mimeType,
      alt: img.alt,
    } as ImageInput;
  });
  const downloaded = results.filter((r): r is ImageInput => r !== null);
  console.log(
    `[md-timing] image downloads done in ${Date.now() - dlStart}ms (attempted=${images.length}, ok=${downloaded.length}, skipped=${images.length - downloaded.length}, slow>3s=${slowDownloads}, concurrency=${DOWNLOAD_CONCURRENCY})`,
  );
  return describeImageBuffers(downloaded, options);
}
```

- [ ] **Step 8: Fix bestaande callers voor de nieuwe return type**

Zoek waar `describeImageUrls` gebruikt wordt en pas aan (return value verandert van `DescriptionMap` naar `DescribeResult`):

Run: `grep -rn "describeImageUrls\|describeImageBuffers" --include="*.ts" --include="*.tsx" /Users/olivierarnolds/Desktop/positionr-app/lib /Users/olivierarnolds/Desktop/positionr-app/modules /Users/olivierarnolds/Desktop/positionr-app/app`

Verwacht: hits in `lib/scraping/url-to-markdown.ts` (in `urlToMarkdown`). Wijzig daar de call:

Van:
```typescript
const descriptions = includeImages
  ? await describeImageUrls(Array.from(allImagesByUrl.values()))
  : (new Map() as DescriptionMap);
console.log(
  `[md-timing] describeImageUrls done in ${Date.now() - describeStart}ms (descriptions=${descriptions.size})`,
);
```

Naar:
```typescript
const describeResult = includeImages
  ? await describeImageUrls(Array.from(allImagesByUrl.values()))
  : { descriptions: new Map() as DescriptionMap, usage: { inputTokens: 0, outputTokens: 0 }, costCents: 0, batchesOk: 0, batchesFailed: 0 };
const descriptions = describeResult.descriptions;
console.log(
  `[md-timing] describeImageUrls done in ${Date.now() - describeStart}ms (descriptions=${descriptions.size}, costCents=${describeResult.costCents}, batchesOk=${describeResult.batchesOk}, batchesFailed=${describeResult.batchesFailed})`,
);
```

- [ ] **Step 9: Type-check + run all tests**

Run: `cd /Users/olivierarnolds/Desktop/positionr-app && npx tsc --noEmit 2>&1 | grep -v "cache-life.d 2.ts"`
Expected: geen output (= geen type errors buiten de bekende duplicate).

Run: `npx vitest run lib/scraping/image-description.test.ts lib/ai/pricing.test.ts`
Expected: alle tests PASS.

Run alle tests om regressies te vangen: `npx vitest run`
Expected: alles groen (of dezelfde failures als vóór deze wijziging — vergelijk vooraf).

- [ ] **Step 10: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app
git add lib/scraping/image-description.ts lib/scraping/image-description.test.ts lib/scraping/url-to-markdown.ts
git commit -m "feat(scraping): model-parameter + usage/cost tracking in describeImage*

describeBatch, describeImageBuffers en describeImageUrls accepteren nu
een optionele model-string (default = PRICING.claude.model). Return-type
is uitgebreid met usage (input+output tokens) en costCents per call.

Voorbereidend voor de /modules/markdown/vergelijk tool. Bestaande
urlToMarkdown-call is bijgewerkt naar het nieuwe return-type."
```

---

## Task 3: Server action voor vergelijking-run

Server action fetch pages 1x (via bestaande `urlToMarkdown`), download images 1x (via nieuwe helper), en laat 3 modellen parallel de descriptions maken. Geeft structured result direct terug (client component slaat op in state).

**Files:**
- Create: `app/(app)/modules/markdown/vergelijk/actions.ts`
- Modify: `lib/scraping/image-description.ts` (kleine helper om downloads te scheiden van describes)

- [ ] **Step 1: Export downloadImages als aparte helper**

In `lib/scraping/image-description.ts`, splits het download-deel uit `describeImageUrls` naar een aparte exported functie. Voeg toe:

```typescript
/**
 * Download-only variant van describeImageUrls: geeft alleen de gedownloade
 * buffers terug, zonder ze te beschrijven. Gebruikt door tools die dezelfde
 * images door meerdere modellen willen halen (in-memory hergebruik).
 */
export async function downloadImages(
  images: UrlImageInput[],
): Promise<ImageInput[]> {
  const dlStart = Date.now();
  let slowDownloads = 0;
  const results = await poolMap(images, DOWNLOAD_CONCURRENCY, async (img) => {
    const t0 = Date.now();
    const data = await downloadImage(img.url);
    const dt = Date.now() - t0;
    if (dt > 3000) {
      slowDownloads++;
      console.log(
        `[md-timing]   slow download ${dt}ms ${data ? "ok" : "FAIL"} ${img.url}`,
      );
    }
    if (!data) return null;
    return {
      key: img.key,
      buffer: data.buffer,
      mimeType: data.mimeType,
      alt: img.alt,
    } as ImageInput;
  });
  const downloaded = results.filter((r): r is ImageInput => r !== null);
  console.log(
    `[md-timing] downloadImages done in ${Date.now() - dlStart}ms (attempted=${images.length}, ok=${downloaded.length}, skipped=${images.length - downloaded.length}, slow>3s=${slowDownloads}, concurrency=${DOWNLOAD_CONCURRENCY})`,
  );
  return downloaded;
}
```

En herschrijf `describeImageUrls` om deze te hergebruiken:

```typescript
export async function describeImageUrls(
  images: UrlImageInput[],
  options: { model?: string } = {},
): Promise<DescribeResult> {
  const downloaded = await downloadImages(images);
  return describeImageBuffers(downloaded, options);
}
```

- [ ] **Step 2: Create the action file**

Create `app/(app)/modules/markdown/vergelijk/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeBaseUrl,
  urlToMarkdown,
  type UrlToMarkdownOptions,
} from "@/lib/scraping/url-to-markdown";
import {
  downloadImages,
  describeImageBuffers,
  type ImageInput,
  type DescribeResult,
} from "@/lib/scraping/image-description";

const COMPARE_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-opus-5",
  "claude-fable-5",
] as const;

export type CompareModel = (typeof COMPARE_MODELS)[number];

/** Serialiseerbare vorm van 1 image voor client-rendering. */
export type CompareImage = {
  key: string;
  url: string;
  alt?: string;
};

/** Resultaat per model (client-serialiseerbaar). */
export type CompareModelResult = {
  model: CompareModel;
  costCents: number;
  wallClockMs: number;
  imagesAttempted: number;
  imagesOk: number;
  batchesOk: number;
  batchesFailed: number;
  /** Map van image-key → beschrijving (null = SKIP of fail). */
  descriptionsByKey: Record<string, string | null>;
  /** Alleen gezet als de model-run als geheel exploded (i.p.v. per-batch). */
  fatalError?: string;
};

export type CompareResult = {
  websiteUrl: string;
  totalWallClockMs: number;
  /** Eerste 10 unique images uit dedupe-volgorde, met thumbnails-URLs. */
  sampleImages: CompareImage[];
  /** Aantal unique images in de test-set. */
  totalImagesInSet: number;
  results: CompareModelResult[];
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/markdown/vergelijk");
  return user;
}

async function runOneModel(
  images: ImageInput[],
  model: CompareModel,
): Promise<CompareModelResult> {
  const start = Date.now();
  try {
    const result: DescribeResult = await describeImageBuffers(images, { model });
    const descriptionsByKey: Record<string, string | null> = {};
    for (const [key, desc] of result.descriptions) descriptionsByKey[key] = desc;
    return {
      model,
      costCents: result.costCents,
      wallClockMs: Date.now() - start,
      imagesAttempted: images.length,
      imagesOk: Array.from(result.descriptions.values()).filter((v) => v !== null).length,
      batchesOk: result.batchesOk,
      batchesFailed: result.batchesFailed,
      descriptionsByKey,
    };
  } catch (err) {
    return {
      model,
      costCents: 0,
      wallClockMs: Date.now() - start,
      imagesAttempted: images.length,
      imagesOk: 0,
      batchesOk: 0,
      batchesFailed: 0,
      descriptionsByKey: {},
      fatalError: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runComparison(rawUrl: string): Promise<CompareResult> {
  await requireUser();

  const websiteUrl = normalizeBaseUrl(rawUrl);
  const overallStart = Date.now();

  // Stap 1: pages 1x scrapen (alleen voor image-collection). Reguliere caps
  // gelden (150 unique images).
  const opts: UrlToMarkdownOptions = { includeImages: true };
  const scrape = await urlToMarkdown(websiteUrl, opts);

  // Stap 2: verzamel unique image URLs uit de scrape. urlToMarkdown geeft
  // die niet direct terug, dus we scrapen opnieuw via de pages-URLs? Nee —
  // beter: we hergebruiken de logica door direct de pages te lezen. Voor MVP
  // gebruiken we een minimale her-parse: haal images uit de eerste ~pages
  // via een tweede lichte call. Zie evt. verbetering hieronder.
  //
  // Voor deze eerste versie: we gebruiken de pages-URLs uit scrape.pages en
  // roepen intern een extractor aan. Simpelst: refactor niet nu — voeg een
  // export toe aan url-to-markdown die alleen de unique images teruggeeft.
  //
  // Zie Step 3: we voegen een helper toe in url-to-markdown.
  throw new Error("Zie Step 3 — image extractor nog niet toegevoegd");
}
```

- [ ] **Step 3: Add extractUniqueImages helper to url-to-markdown.ts**

Refactor: de image-collection-logica uit `urlToMarkdown` moet ook als losstaande functie beschikbaar zijn, zodat de vergelijk-tool alleen de images kan ophalen zonder de hele markdown-samenstelling te draaien.

In `lib/scraping/url-to-markdown.ts`, voeg toe (naast de bestaande `urlToMarkdown`):

```typescript
/**
 * Lichtgewicht variant van urlToMarkdown: fetcht pages, verzamelt unique
 * images (met dezelfde cap MAX_UNIQUE_IMAGES_TOTAL en dedup-volgorde), maar
 * doet géén image-descriptions of markdown-assembly. Bedoeld voor tools die
 * alleen de image-set willen (bv. de model-vergelijk-pagina).
 */
export async function collectUniqueImages(
  rawUrl: string,
  options: UrlToMarkdownOptions = {},
): Promise<{ baseUrl: string; images: UrlImageInput[]; truncated: boolean }> {
  const baseUrl = normalizeBaseUrl(rawUrl);
  const { urls } = await resolveTargetUrls(baseUrl, options);
  const turndown = createTurndown();
  const targets = urls.map((u, i) => ({ url: u, isHome: i === 0 }));
  const settled = await mapWithConcurrency(targets, FETCH_CONCURRENCY, (t) =>
    pageToMarkdown(t.url, turndown, true, t.isHome ? baseUrl : null),
  );

  const allImagesByUrl = new Map<string, UrlImageInput>();
  let truncated = false;
  outer: for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value) continue;
    for (const img of r.value.images) {
      if (allImagesByUrl.has(img.url)) continue;
      if (allImagesByUrl.size >= MAX_UNIQUE_IMAGES_TOTAL) {
        truncated = true;
        break outer;
      }
      allImagesByUrl.set(img.url, img);
    }
  }
  return {
    baseUrl,
    images: Array.from(allImagesByUrl.values()),
    truncated,
  };
}
```

- [ ] **Step 4: Vervang de placeholder in actions.ts met de volledige implementation**

Vervang de body van `runComparison` (alles na `overallStart`):

```typescript
  // Stap 1: verzamel unique images (max 150). Gebruikt normale sitemap-flow.
  const { images } = await collectUniqueImages(websiteUrl, {
    includeImages: true,
  });
  const totalImagesInSet = images.length;

  if (totalImagesInSet === 0) {
    return {
      websiteUrl,
      totalWallClockMs: Date.now() - overallStart,
      sampleImages: [],
      totalImagesInSet: 0,
      results: COMPARE_MODELS.map((model) => ({
        model,
        costCents: 0,
        wallClockMs: 0,
        imagesAttempted: 0,
        imagesOk: 0,
        batchesOk: 0,
        batchesFailed: 0,
        descriptionsByKey: {},
        fatalError: "Geen images gevonden op deze URL",
      })),
    };
  }

  // Stap 2: download alle images 1x → Buffer[] in-memory.
  const buffers = await downloadImages(images);

  // Stap 3: drie modellen parallel de descriptions laten maken.
  const results = await Promise.all(
    COMPARE_MODELS.map((model) => runOneModel(buffers, model)),
  );

  // Stap 4: sample van eerste 10 images voor visuele vergelijking.
  const sampleImages: CompareImage[] = images.slice(0, 10).map((img) => ({
    key: img.key,
    url: img.url,
    alt: img.alt,
  }));

  return {
    websiteUrl,
    totalWallClockMs: Date.now() - overallStart,
    sampleImages,
    totalImagesInSet,
    results,
  };
}
```

Vergeet niet de `collectUniqueImages` import bovenaan:

```typescript
import {
  collectUniqueImages,
  normalizeBaseUrl,
  type UrlToMarkdownOptions,
} from "@/lib/scraping/url-to-markdown";
```

(en verwijder de `urlToMarkdown` import als die niet meer nodig is)

- [ ] **Step 5: Type-check**

Run: `cd /Users/olivierarnolds/Desktop/positionr-app && npx tsc --noEmit 2>&1 | grep -v "cache-life.d 2.ts" | head -20`
Expected: geen output (geen echte type-errors).

- [ ] **Step 6: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app
git add lib/scraping/image-description.ts lib/scraping/url-to-markdown.ts app/\(app\)/modules/markdown/vergelijk/actions.ts
git commit -m "feat(vergelijk): server action + collectUniqueImages helper

Nieuwe /modules/markdown/vergelijk/actions.ts met runComparison() die
pages 1x scrapet, images 1x downloadt, en 3 modellen (Haiku 4.5, Opus 5,
Fable 5) parallel de descriptions laat maken. Retourneert een
serialiseerbare CompareResult voor de client.

collectUniqueImages exposeert de image-verzamel-fase van urlToMarkdown
als losse helper zodat de vergelijk-tool niet de hele markdown-assembly
en RAG-indexing draait."
```

---

## Task 4: Client component + page voor UI

Client component met form, useTransition voor loading state, en resultaat-tabel. Server component eromheen doet alleen auth-check en rendert de client component. `maxDuration = 300` op de page.

**Files:**
- Create: `app/(app)/modules/markdown/vergelijk/page.tsx`
- Create: `app/(app)/modules/markdown/vergelijk/VergelijkClient.tsx`

- [ ] **Step 1: Create VergelijkClient.tsx (client component)**

Create `app/(app)/modules/markdown/vergelijk/VergelijkClient.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { runComparison, type CompareResult } from "./actions";

export function VergelijkClient() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await runComparison(url);
        setResult(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-3 rounded-2xl border-2 border-purple-200 bg-purple-50 p-5"
      >
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">Website-URL</span>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="bijv. https://uwbedrijf.nl"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
            disabled={isPending}
          />
        </label>
        <button
          type="submit"
          disabled={isPending || url.length < 3}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Bezig… (kan enkele minuten duren)" : "Vergelijk 3 modellen"}
        </button>
        <p className="text-xs text-gray-600">
          Fetcht pages 1x, downloadt images 1x, laat vervolgens Haiku 4.5,
          Opus 5 en Fable 5 parallel dezelfde images beschrijven. Verwachte
          kost per run: <strong>$5-8</strong>.
        </p>
      </form>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Fout:</strong> {error}
        </div>
      ) : null}

      {result ? <ResultView result={result} /> : null}
    </div>
  );
}

function ResultView({ result }: { result: CompareResult }) {
  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border bg-white p-4 text-sm">
        <div>
          <strong>URL:</strong> {result.websiteUrl}
        </div>
        <div>
          <strong>Totale wall-clock:</strong>{" "}
          {(result.totalWallClockMs / 1000).toFixed(1)}s
        </div>
        <div>
          <strong>Unique images in test-set:</strong> {result.totalImagesInSet}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {result.results.map((r) => (
          <div key={r.model} className="rounded-2xl border-2 bg-white p-4">
            <h3 className="text-base font-bold">{modelLabel(r.model)}</h3>
            <div className="mt-1 text-xs text-gray-500">{r.model}</div>
            {r.fatalError ? (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <strong>Fataal:</strong> {r.fatalError}
              </div>
            ) : (
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Kost:</dt>
                  <dd className="font-bold">
                    ${(r.costCents / 100).toFixed(2)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Wall-clock:</dt>
                  <dd>{(r.wallClockMs / 1000).toFixed(1)}s</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Images ok:</dt>
                  <dd>
                    {r.imagesOk} / {r.imagesAttempted}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Batches ok/fail:</dt>
                  <dd>
                    {r.batchesOk} / {r.batchesFailed}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">
        Kwaliteit-vergelijking (eerste 10 images)
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left">Image</th>
              {result.results.map((r) => (
                <th key={r.model} className="p-2 text-left">
                  {modelLabel(r.model)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.sampleImages.map((img) => (
              <tr key={img.key} className="border-b align-top">
                <td className="p-2">
                  <img
                    src={img.url}
                    alt={img.alt ?? ""}
                    className="h-16 w-16 rounded border object-contain"
                  />
                </td>
                {result.results.map((r) => (
                  <td key={r.model} className="max-w-xs p-2 text-xs">
                    {r.descriptionsByKey[img.key] ?? (
                      <span className="text-gray-400">— (SKIP of fail)</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function modelLabel(model: string): string {
  if (model === "claude-haiku-4-5-20251001") return "Haiku 4.5";
  if (model === "claude-opus-5") return "Opus 5";
  if (model === "claude-fable-5") return "Fable 5";
  return model;
}
```

- [ ] **Step 2: Create page.tsx (server component wrapper)**

Create `app/(app)/modules/markdown/vergelijk/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VergelijkClient } from "./VergelijkClient";

// De vergelijking laat 3 modellen parallel 150 images beschrijven. Zelfs
// bij worst-case parallel-runs komen we niet boven ~120s, maar we pakken
// 300s voor headroom bij trage sites/Anthropic-latency.
export const maxDuration = 300;

export default async function VergelijkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/modules/markdown/vergelijk");

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
          <Scale className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Model-vergelijking</h1>
          <p className="text-gray-600">
            Vergelijk kost en kwaliteit van image-descriptions tussen
            Haiku 4.5, Opus 5 en Fable 5.
          </p>
        </div>
      </div>

      <VergelijkClient />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/olivierarnolds/Desktop/positionr-app && npx tsc --noEmit 2>&1 | grep -v "cache-life.d 2.ts" | head -20`
Expected: geen output.

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app
git add app/\(app\)/modules/markdown/vergelijk/page.tsx app/\(app\)/modules/markdown/vergelijk/VergelijkClient.tsx
git commit -m "feat(vergelijk): UI voor model-vergelijking pagina

Server component + client component voor /modules/markdown/vergelijk.
Form + useTransition voor loading, resultaat-cards per model met kost/tijd,
en side-by-side tabel met eerste 10 images voor kwaliteits-eyeballing.
maxDuration=300 voor headroom."
```

---

## Task 5: Ontsluit de nieuwe pagina + verify

Zorg dat een user de pagina kan vinden (link vanaf `/modules`), en verifieer end-to-end op Vercel.

**Files:**
- Modify: `app/(app)/modules/_components/markdown-library-card.tsx` (of vergelijkbaar — check waar de MarkdownLibraryCard-link nu ligt)

- [ ] **Step 1: Find the right place to add a link**

Run: `grep -rn "MarkdownLibraryCard\|markdown-library-card" /Users/olivierarnolds/Desktop/positionr-app/app --include="*.tsx"`

Bepaal aan de hand van dit resultaat waar de "Markdown bibliotheek"-card wordt gerenderd. Voeg daar een subtiele link toe naar `/modules/markdown/vergelijk` — bijvoorbeeld als kleine knop onder de bestaande snapshot-lijst met tekst "Vergelijk modellen (experimenteel)".

Als de structuur onduidelijk is: alternatief is een `<Link>` toevoegen op `app/(app)/modules/page.tsx` zelf, naast de MarkdownLibraryCard.

- [ ] **Step 2: Add the link**

Voeg een link toe (exacte plek hangt af van Step 1). Voorbeeld voor `MarkdownLibraryCard`:

```tsx
<Link
  href="/modules/markdown/vergelijk"
  className="inline-flex items-center gap-1 text-xs text-purple-700 hover:underline"
>
  Vergelijk modellen (experimenteel) →
</Link>
```

- [ ] **Step 3: Commit + push naar main (auto-deploy Vercel)**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app
git add -A app/\(app\)/modules/
git commit -m "feat(vergelijk): link naar vergelijk-pagina vanaf /modules"
git push origin main
```

**⚠️ Vraag de user eerst om toestemming voordat je pusht.** Alle voorgaande commits mogen lokaal blijven tot dit punt.

- [ ] **Step 4: Wacht op deploy + verify handmatig**

- Wacht ~2 minuten tot Vercel-deploy klaar is
- Ga naar `/modules/markdown/vergelijk` in de browser
- Voer een kleine test-URL in (bv. eigen website — niet fourtop, dat is $5+ per run)
- Verifieer:
  - Loading-state werkt (button disabled + tekst "Bezig…")
  - Na completion: 3 kolommen met kost/tijd/counts, en tabel met 10 images
  - Alle 3 modellen tonen redelijke descriptions
  - Kost per model komt overeen met globale schatting

- [ ] **Step 5: Check Vercel logs voor onverwachte errors**

Open Vercel dashboard → Logs → filter op `[md-timing]`. Verifieer:
- Elke van de 3 modellen loggt zijn eigen batches met de juiste `model=` prefix
- Geen 429-rate-limits (als wel: verlaag `VISION_CONCURRENCY` of run modellen sequentieel)

- [ ] **Step 6: Update Fable 5 pricing als de eerste run afwijkt**

De schatting Fable 5 = $6/M input / $22.5/M output was een gok. Vergelijk in Vercel Dashboard → Billing hoeveel de test-run daadwerkelijk kostte volgens Anthropic. Als de kost significant afwijkt van wat de UI toont: pas `MODEL_PRICING["claude-fable-5"]` aan.

---

## Self-Review

**Spec coverage:**
- Nieuwe pagina `/modules/markdown/vergelijk`: Task 4 ✓
- Backend fetch pages 1x + max 150 images: Task 3 (`collectUniqueImages`) ✓
- 3 modellen parallel Haiku/Opus/Fable: Task 3 (`Promise.all` over `runOneModel`) ✓
- Per-model meting kost/tijd/ok/fail: Task 3 (`CompareModelResult`) ✓
- Side-by-side UI met 10 images: Task 4 (`ResultView`) ✓
- `describeImageBuffers/Urls` optionele model-param + usage: Task 2 ✓
- Nieuwe pricing entries: Task 1 ✓
- `maxDuration = 300` op nieuwe pagina: Task 4 Step 2 ✓
- Foutafhandeling (1 model faalt): Task 3 (`runOneModel` catch + `fatalError`) ✓
- `urlToMarkdown`-fout (site down): Task 4 (`VergelijkClient` catch + `error`-render) ✓
- Geen DB-migratie, geen aanpassing aan bestaande snapshot-flow: geen taak wijzigt `snapshot-service.ts` of `markdownSnapshots`-schema ✓

**Placeholder scan:** Task 1 Step 4 heeft een `TODO — vul hier de exacte bron en waarde in na Step 1` — dat is opzettelijk (verifiëren tijdens implementatie), geen leeg placeholder. Geen andere red flags.

**Type consistency:** `DescribeResult` in Task 2 matcht wat `runOneModel` in Task 3 gebruikt. `CompareResult` velden in Task 3 matchen wat `ResultView` in Task 4 rendert (`sampleImages`, `results`, `descriptionsByKey`). ✓
