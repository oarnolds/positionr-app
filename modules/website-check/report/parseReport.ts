export type ReportBlocks = {
  cover: {
    raw: string;
    score: string | null;
  } | null;
  strengths: string[] | null;
  improvements: string[] | null;
  bodyMarkdown: string;
};

const SCORE_RE = /(\d+[,.]\d+)\s*\/\s*10/;
const STRENGTHS_RE = /^##\s+Sterke punten\s*$/i;
const IMPROVEMENTS_RE = /^##\s+(?:Grootste\s+)?[Vv]erbeterpunten\s*$/;

function extractList(lines: string[], startIdx: number): { items: string[]; endIdx: number } {
  const items: string[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    const bullet = line.match(/^[*-]\s+(.*)$/);
    if (bullet) {
      items.push(bullet[1]);
      i++;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) break;
    if (line.trim() === "") {
      i++;
      continue;
    }
    break;
  }
  return { items, endIdx: i };
}

export function parseReport(markdown: string): ReportBlocks {
  if (!markdown) {
    return { cover: null, strengths: null, improvements: null, bodyMarkdown: "" };
  }
  const lines = markdown.split("\n");
  const firstH1 = lines.findIndex((l) => /^#\s+/.test(l));

  let cover: ReportBlocks["cover"] = null;
  let bodyStart = 0;
  if (firstH1 === -1) {
    const coverRaw = markdown.trim();
    if (coverRaw) {
      const scoreMatch = coverRaw.match(SCORE_RE);
      cover = { raw: coverRaw, score: scoreMatch?.[1] ?? null };
    }
    return {
      cover,
      strengths: null,
      improvements: null,
      bodyMarkdown: "",
    };
  }
  if (firstH1 > 0) {
    const coverRaw = lines.slice(0, firstH1).join("\n").trim();
    if (coverRaw) {
      const scoreMatch = coverRaw.match(SCORE_RE);
      cover = { raw: coverRaw, score: scoreMatch?.[1] ?? null };
    }
    bodyStart = firstH1;
  }

  const bodyLines = lines.slice(bodyStart);

  let strengths: string[] | null = null;
  let improvements: string[] | null = null;
  const stripIndices = new Set<number>();

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    if (STRENGTHS_RE.test(line)) {
      const { items, endIdx } = extractList(bodyLines, i + 1);
      if (items.length > 0) {
        strengths = items;
        for (let j = i; j < endIdx; j++) stripIndices.add(j);
      }
    } else if (IMPROVEMENTS_RE.test(line)) {
      const { items, endIdx } = extractList(bodyLines, i + 1);
      if (items.length > 0) {
        improvements = items;
        for (let j = i; j < endIdx; j++) stripIndices.add(j);
      }
    }
  }

  if (!(strengths && improvements)) {
    return {
      cover,
      strengths: null,
      improvements: null,
      bodyMarkdown: bodyLines.join("\n"),
    };
  }

  const remaining = bodyLines.filter((_, idx) => !stripIndices.has(idx));
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const ln of remaining) {
    const blank = ln.trim() === "";
    if (blank && prevBlank) continue;
    collapsed.push(ln);
    prevBlank = blank;
  }

  return {
    cover,
    strengths,
    improvements,
    bodyMarkdown: collapsed.join("\n").trim(),
  };
}
