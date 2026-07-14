export type ReportBlocks = {
  cover: {
    raw: string;
    score: string | null;
  } | null;
  strengths: string[] | null;
  improvements: string[] | null;
  bodyMarkdown: string;
};

export type Onderdeel = {
  nr: number;
  slug: string;
  titel: string;
  score: number | null;
  watWeZien: string;
  waaromDitTelt: string;
  watJeKuntDoen: string[];
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseSamenvatting(markdown: string): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^#\s+Samenvatting\s*$/i.test(l));
  if (start === -1) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  const text = out.join("\n").trim();
  return text || null;
}

const ONDERDEEL_RE =
  /^###\s+(\d+)\.\s+(.+?)\s*[—–-]\s*(\d+(?:[.,]\d+)?)\s*\/\s*10\s*$/;

export function parseOnderdelen(markdown: string): Onderdeel[] {
  const lines = markdown.split("\n");
  const out: Onderdeel[] = [];
  let cur: Onderdeel | null = null;
  let bucket: "watWeZien" | "waaromDitTelt" | "watJeKuntDoen" | null = null;
  const push = () => {
    if (cur) out.push(cur);
  };

  for (const line of lines) {
    const head = line.match(ONDERDEEL_RE);
    if (head) {
      push();
      cur = {
        nr: Number(head[1]),
        titel: head[2].trim(),
        slug: slugify(head[2]),
        score: Number(head[3].replace(",", ".")),
        watWeZien: "",
        waaromDitTelt: "",
        watJeKuntDoen: [],
      };
      bucket = null;
      continue;
    }
    if (!cur) continue;
    // Onderdeel eindigt bij de volgende H1/H2 (bv. "# De vijf belangrijkste acties").
    if (/^#{1,2}\s/.test(line)) {
      push();
      cur = null;
      bucket = null;
      continue;
    }
    const sub = line.match(/^####\s+(.*)$/);
    if (sub) {
      const label = sub[1].toLowerCase();
      if (label.startsWith("wat we zien")) bucket = "watWeZien";
      else if (label.startsWith("waarom")) bucket = "waaromDitTelt";
      else if (label.startsWith("wat je kunt doen")) bucket = "watJeKuntDoen";
      else bucket = null;
      continue;
    }
    if (bucket === "watJeKuntDoen") {
      const b = line.match(/^[*-]\s+(.*)$/);
      if (b) cur.watJeKuntDoen.push(b[1].trim());
    } else if (bucket === "watWeZien") {
      const t = line.trim();
      if (t) cur.watWeZien = cur.watWeZien ? `${cur.watWeZien} ${t}` : t;
    } else if (bucket === "waaromDitTelt") {
      const t = line.trim();
      if (t) cur.waaromDitTelt = cur.waaromDitTelt ? `${cur.waaromDitTelt} ${t}` : t;
    }
  }
  push();
  return out;
}

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
