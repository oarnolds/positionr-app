import JSZip from "jszip";
import * as cheerio from "cheerio";

export type ExtractedBook = {
  title: string | null;
  author: string | null;
  language: string | null;
  chapters: string[];
};

const CHAPTER_RE = /^\s*(HOOFDSTUK|CHAPTER)\b.*$/im;
const WORDS_PER_BLOCK = 6000;

/**
 * Splitst platte tekst in hoofdstukken. Eerst op HOOFDSTUK/CHAPTER-koppen;
 * als die ontbreken, in blokken van ~WORDS_PER_BLOCK woorden zodat elk blok
 * binnen één LLM-call past.
 */
export function splitIntoChapters(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split("\n");
  const hasHeadings = lines.some((l) => CHAPTER_RE.test(l));

  if (hasHeadings) {
    const chapters: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (CHAPTER_RE.test(line) && current.some((l) => l.trim())) {
        chapters.push(current.join("\n").trim());
        current = [];
      }
      current.push(line);
    }
    if (current.some((l) => l.trim())) chapters.push(current.join("\n").trim());
    return chapters.filter((c) => c.length > 0);
  }

  const words = trimmed.split(/\s+/);
  const blocks: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_BLOCK) {
    blocks.push(words.slice(i, i + WORDS_PER_BLOCK).join(" "));
  }
  return blocks;
}

function stripXhtml(xhtml: string): string {
  const $ = cheerio.load(xhtml);
  $("script, style").remove();
  // Blok-elementen scheiden met een newline, anders plakt .text() de tekst
  // van bv. <h1> en <p> aan elkaar ("KopTekst...").
  $("p, div, br, li, h1, h2, h3, h4, h5, h6, section, article").each((_, el) => {
    $(el).append("\n");
  });
  return $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Eerste metadata-waarde; probeert de dc:-namespace én de losse tag. */
function metaText($opf: cheerio.CheerioAPI, tag: string): string | null {
  const el = $opf(`dc\\:${tag}, metadata > ${tag}`).first();
  const text = el.text().trim();
  return text || null;
}

function resolvePath(base: string, href: string): string {
  const parts = base.split("/").slice(0, -1);
  for (const seg of href.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

export async function extractEpub(buffer: Buffer): Promise<ExtractedBook> {
  const zip = await JSZip.loadAsync(buffer);

  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("EPUB: container.xml ontbreekt");
  const opfPath = cheerio
    .load(containerXml, { xmlMode: true })("rootfile")
    .attr("full-path");
  if (!opfPath) throw new Error("EPUB: geen rootfile in container.xml");

  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error(`EPUB: ${opfPath} ontbreekt`);
  const $opf = cheerio.load(opfXml, { xmlMode: true });

  const title = metaText($opf, "title");
  const author = metaText($opf, "creator");
  const language = metaText($opf, "language");

  const manifest = new Map<string, string>();
  $opf("manifest item").each((_, el) => {
    const id = $opf(el).attr("id");
    const href = $opf(el).attr("href");
    if (id && href) manifest.set(id, href);
  });

  const chapters: string[] = [];
  const itemrefs = $opf("spine itemref").toArray();
  for (const ref of itemrefs) {
    const idref = $opf(ref).attr("idref");
    const href = idref ? manifest.get(idref) : undefined;
    if (!href) continue;
    const docPath = resolvePath(opfPath, href);
    const xhtml = await zip.file(docPath)?.async("text");
    if (!xhtml) continue;
    const text = stripXhtml(xhtml);
    // Drempel houdt nav/cover/lege documenten buiten, maar laat echte
    // (korte) hoofdstukken door.
    if (text.split(/\s+/).filter(Boolean).length >= 5) chapters.push(text);
  }

  return { title, author, language, chapters };
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedBook> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return {
    title: data.info?.Title?.trim() || null,
    author: data.info?.Author?.trim() || null,
    language: null,
    chapters: splitIntoChapters(data.text),
  };
}

export async function extractBook(
  buffer: Buffer,
  kind: "pdf" | "epub",
): Promise<ExtractedBook> {
  return kind === "epub" ? extractEpub(buffer) : extractPdf(buffer);
}
