import Anthropic from "@anthropic-ai/sdk";
import { PRICING } from "@/lib/ai/pricing";

const FETCH_TIMEOUT_MS = 6_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude vision-limit per image
const BATCH_SIZE = 8;

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
  batch: ImageInput[]
): Promise<Array<string | null>> {
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
    model: PRICING.claude.model,
    max_tokens: 1500,
    messages: [{ role: "user", content }],
  });

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";
  return parseNumberedLines(text, batch.length);
}

/**
 * Beschrijft een set images via Claude vision. Verwerkt in batches van
 * BATCH_SIZE; faalt zacht (lege description) bij fouten zodat de scrape
 * doorgaat.
 */
export async function describeImageBuffers(
  images: ImageInput[]
): Promise<DescriptionMap> {
  const map: DescriptionMap = new Map();
  if (images.length === 0) return map;

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    try {
      const results = await describeBatch(batch);
      batch.forEach((img, j) => map.set(img.key, results[j]));
    } catch {
      // Vision-call mislukt — laat deze batch leeg en ga door.
      batch.forEach((img) => map.set(img.key, null));
    }
  }
  return map;
}

/**
 * Variant die zelf images downloadt aan de hand van URL. Skipt images die
 * niet te downloaden zijn (timeout, te groot, niet-ondersteund mime-type).
 */
export async function describeImageUrls(
  images: UrlImageInput[]
): Promise<DescriptionMap> {
  const downloaded: ImageInput[] = [];
  for (const img of images) {
    const data = await downloadImage(img.url);
    if (!data) continue;
    downloaded.push({
      key: img.key,
      buffer: data.buffer,
      mimeType: data.mimeType,
      alt: img.alt,
    });
  }
  return describeImageBuffers(downloaded);
}
