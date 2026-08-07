import Anthropic from "@anthropic-ai/sdk";
import { calculateModelCostCents } from "@/lib/ai/pricing";

const FETCH_TIMEOUT_MS = 6_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude vision-limit per image
const BATCH_SIZE = 8;
// Default-model voor image-descriptions: Haiku 4.5. Kwaliteit is voldoende
// voor de labeling-taak (Logo/Foto/Diagram/SKIP) en ~3x goedkoper dan Sonnet
// 4.6 — bevestigd via de /modules/markdown/vergelijk tool op 2026-08-07 waarin
// Haiku en Sonnet vergelijkbare labels leverden en Fable 5 (duurst) juist
// slechter presteerde op logo-herkenning. Andere Claude-modules (rapport-
// generatie, analyses) blijven Sonnet 4.6 gebruiken via PRICING.claude.model
// omdat daar redenering de bottleneck is, niet cost.
const DEFAULT_IMAGE_DESCRIPTION_MODEL = "claude-haiku-4-5-20251001";
// Parallelle Vision-batches: Anthropic rate-limits genereus per minute, en met 4
// parallel + BATCH_SIZE=8 zitten we op ~32 images "in flight" — ruim onder de
// per-second image-limits die de meeste tier-3 accounts hebben. Meer parallel
// levert diminishing returns op omdat Claude Vision zelf de bottleneck wordt.
const VISION_CONCURRENCY = 4;
// Parallelle image-downloads: bulk downloads van externe URLs; 10 concurrent
// laat de site-server ademen (geen self-DDOS) en snijdt de wall-clock dramatisch.
const DOWNLOAD_CONCURRENCY = 10;

const SUPPORTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const SYSTEM_INSTRUCTION = `Je krijgt N afbeeldingen (genummerd 1..N) met optioneel alt-tekst per afbeelding.
Geef voor elke afbeelding één korte regel met:
- LOGO's: [Logo: <bedrijfsnaam>] als herkenbaar, anders [Logo: <korte omschrijving van het bedrijf>] (bv. tech-startup, advocatenkantoor).
- Meerdere logo's in één afbeelding (klanten/partners): [Klantlogo's: <naam1>, <naam2>, <naam3>].
- FOTO's van mensen/situaties: [Foto: <1 zin>].
- DIAGRAMMEN/SCHEMA's: [Diagram: <korte tekstuele weergave + relaties>].
- GRAFIEKEN: [Grafiek: <titel + hoofdtrend>].
- Decoratief/leeg/onbruikbaar: SKIP (alleen het woord "SKIP").

Formaat van je antwoord — EXACT:
1. <regel of SKIP>
2. <regel of SKIP>
...

Geen uitleg, geen extra tekst, alleen de genummerde lijst.`;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt of is ongeldig");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export type ImageInput = {
  /** Source-identifier (URL of placeholder-id) — gebruikt om descriptions terug te koppelen. */
  key: string;
  buffer: Buffer;
  mimeType: string;
  alt?: string;
};

export type UrlImageInput = {
  key: string;
  url: string;
  alt?: string;
};

/** Mappt een description naar elke key. SKIP/lege regels zijn `null`. */
export type DescriptionMap = Map<string, string | null>;

/** Token-usage van één Vision-call (input+output), voor kost-tracking. */
export type BatchUsage = { inputTokens: number; outputTokens: number };

/** Somt usage van meerdere batches op tot één totaal. */
export function aggregateUsage(usages: BatchUsage[]): BatchUsage {
  return usages.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

/** Resultaat van describeImageBuffers/describeImageUrls: descriptions + kost-tracking. */
export type DescribeResult = {
  descriptions: DescriptionMap;
  usage: BatchUsage;
  costCents: number;
  batchesOk: number;
  batchesFailed: number;
};

async function downloadImage(
  url: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "PositionrBot/1.0 (+https://app.positionr.nl)" },
        redirect: "follow",
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (!SUPPORTED_MIME.has(contentType)) return null;
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_IMAGE_BYTES) return null;
      return { buffer: Buffer.from(ab), mimeType: contentType };
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

function parseNumberedLines(text: string, count: number): Array<string | null> {
  const result: Array<string | null> = Array.from({ length: count }, () => null);
  const re = /^\s*(\d+)\.\s*(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = parseInt(m[1], 10) - 1;
    if (n < 0 || n >= count) continue;
    const value = m[2].trim();
    if (!value || value.toUpperCase() === "SKIP") {
      result[n] = null;
    } else {
      result[n] = value;
    }
  }
  return result;
}

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

/**
 * Werker-pool die maximaal `limit` items parallel verwerkt. Behoudt input-order
 * in results. Verschil met Promise.all: throughput blijft constant hoog omdat
 * snelle items direct doorschuiven naar het volgende item i.p.v. te wachten op
 * de traagste van hun batch.
 */
async function poolMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Beschrijft een set images via Claude vision. Verwerkt in batches van
 * BATCH_SIZE, VISION_CONCURRENCY batches parallel; faalt zacht (lege
 * description) bij fouten zodat de scrape doorgaat.
 *
 * `options.model` laat de caller een ander Claude-model kiezen (voor de
 * /modules/markdown/vergelijk kost-vergelijking); default =
 * DEFAULT_IMAGE_DESCRIPTION_MODEL (Haiku 4.5).
 */
export async function describeImageBuffers(
  images: ImageInput[],
  options: { model?: string } = {},
): Promise<DescribeResult> {
  const model = options.model ?? DEFAULT_IMAGE_DESCRIPTION_MODEL;
  const map: DescriptionMap = new Map();
  if (images.length === 0) {
    return { descriptions: map, usage: { inputTokens: 0, outputTokens: 0 }, costCents: 0, batchesOk: 0, batchesFailed: 0 };
  }

  const batches: ImageInput[][] = [];
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    batches.push(images.slice(i, i + BATCH_SIZE));
  }
  const batchUsages: BatchUsage[] = [];
  let batchesOk = 0;
  let batchesFailed = 0;
  const visionStart = Date.now();
  await poolMap(batches, VISION_CONCURRENCY, async (batch, idx) => {
    const batchNum = idx + 1;
    const batchStart = Date.now();
    try {
      const { descriptions, usage } = await describeBatch(batch, model);
      batchUsages.push(usage);
      batch.forEach((img, j) => map.set(img.key, descriptions[j]));
      batchesOk++;
      console.log(
        `[md-timing]   vision batch ${batchNum}/${batches.length} (n=${batch.length}) model=${model} done in ${Date.now() - batchStart}ms`,
      );
    } catch (err) {
      // Vision-call mislukt — laat deze batch leeg en ga door.
      batch.forEach((img) => map.set(img.key, null));
      batchesFailed++;
      console.warn(
        `[md-timing]   vision batch ${batchNum}/${batches.length} model=${model} FAILED in ${Date.now() - batchStart}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
  const usage = aggregateUsage(batchUsages);
  const costCents = calculateModelCostCents(model, usage.inputTokens, usage.outputTokens);
  console.log(
    `[md-timing] describeImageBuffers TOTAL vision ${Date.now() - visionStart}ms for ${images.length} images (${batches.length} batches, model=${model}, concurrency=${VISION_CONCURRENCY}, costCents=${costCents})`,
  );
  return { descriptions: map, usage, costCents, batchesOk, batchesFailed };
}

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

/**
 * Variant die zelf images downloadt aan de hand van URL. Skipt images die
 * niet te downloaden zijn (timeout, te groot, niet-ondersteund mime-type).
 * Downloads gebeuren parallel (DOWNLOAD_CONCURRENCY). `options.model` wordt
 * doorgegeven aan describeImageBuffers.
 */
export async function describeImageUrls(
  images: UrlImageInput[],
  options: { model?: string } = {},
): Promise<DescribeResult> {
  const downloaded = await downloadImages(images);
  return describeImageBuffers(downloaded, options);
}
