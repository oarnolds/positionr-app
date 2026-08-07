"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  collectUniqueImages,
  normalizeBaseUrl,
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
  /** Eerste 10 unique images uit dedupe-volgorde, met thumbnail-URLs. */
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
