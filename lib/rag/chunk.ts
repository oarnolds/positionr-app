const TARGET_CHARS = 2_000; // ~500 tokens
const MAX_CHARS = 3_500; // hard limit voordat we forceren te splitsen
const MIN_CHARS = 200; // skip extreem korte chunks (bv. "—" of een datum)

export type Chunk = {
  content: string;
  headingPath: string[];
};

type Block = {
  headingPath: string[];
  lines: string[];
};

/**
 * Splits markdown in semantisch coherente chunks van ~500 tokens.
 * Strategie:
 *   1. Loop regel voor regel, houd heading-pad bij (h1 > h2 > h3).
 *   2. Verzamel content-blokken per heading-pad.
 *   3. Per blok: als het tot ~TARGET_CHARS past, return als chunk;
 *      anders split op alinea-grens (`\n\n`).
 */
export function chunkMarkdown(markdown: string): Chunk[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  const headingStack: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    blocks.push({ headingPath: [...headingStack], lines: buffer });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      while (headingStack.length >= level) headingStack.pop();
      headingStack.push(title);
      // Voeg ook de heading zelf toe als eerste regel van het volgend blok
      // zodat de chunk-text de heading bevat (handig voor embedding-context).
      buffer.push(line);
      continue;
    }
    buffer.push(line);
  }
  flush();

  const chunks: Chunk[] = [];

  for (const block of blocks) {
    const text = block.lines.join("\n").trim();
    if (text.length < MIN_CHARS) {
      // Te kort — probeer te mergen met vorige chunk als die nog ruimte heeft.
      const prev = chunks[chunks.length - 1];
      if (
        prev &&
        prev.headingPath.join("/") === block.headingPath.join("/") &&
        prev.content.length + text.length + 2 < MAX_CHARS
      ) {
        prev.content = `${prev.content}\n\n${text}`;
        continue;
      }
      if (text.length === 0) continue;
    }

    if (text.length <= TARGET_CHARS) {
      chunks.push({ content: text, headingPath: block.headingPath });
      continue;
    }

    // Te lang — split op paragraph (\n\n) en plak terug tot ~TARGET_CHARS.
    const paragraphs = text.split(/\n{2,}/);
    let current = "";
    for (const p of paragraphs) {
      const pTrim = p.trim();
      if (!pTrim) continue;
      if (current.length + pTrim.length + 2 > MAX_CHARS && current) {
        chunks.push({ content: current.trim(), headingPath: block.headingPath });
        current = "";
      }
      if (pTrim.length > MAX_CHARS) {
        // Eén alinea zelf te lang — split op zinnen (ruwe split op `.`).
        const sentences = pTrim.split(/(?<=[.!?])\s+/);
        let chunk = current ? `${current}\n\n` : "";
        for (const s of sentences) {
          if (chunk.length + s.length + 1 > MAX_CHARS && chunk.trim()) {
            chunks.push({ content: chunk.trim(), headingPath: block.headingPath });
            chunk = "";
          }
          chunk += (chunk ? " " : "") + s;
        }
        current = chunk;
      } else {
        current = current ? `${current}\n\n${pTrim}` : pTrim;
      }
    }
    if (current.trim()) {
      chunks.push({ content: current.trim(), headingPath: block.headingPath });
    }
  }

  return chunks.filter((c) => c.content.trim().length > 0);
}
