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
