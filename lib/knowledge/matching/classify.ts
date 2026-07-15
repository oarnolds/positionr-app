import { analyzeClaudeRaw } from "@/lib/ai/claude-raw";
import { TAXONOMY, filterValidThemes } from "@/lib/knowledge/taxonomy";
import type { MatchableSection } from "./types";

export function buildClassifyPrompt(sections: MatchableSection[]): string {
  const opties = TAXONOMY.map((t) => `- ${t.slug}: ${t.label}`).join("\n");
  const secs = sections
    .map((s) => `[${s.key}] ${s.titel}\n${s.tekst}`)
    .join("\n\n");
  return `Je bepaalt per sectie welke marketing/sales-thema's aan de orde zijn, UITSLUITEND uit een vaste taxonomie.

TAXONOMIE:
${opties}

SECTIES:
${secs}

Geef UITSLUITEND een JSON-object terug dat elke sectie-sleutel (tussen [ ]) mapt op een array van 0 tot 3 passende thema-slugs uit de taxonomie, bijvoorbeeld {"sectie-0":["waardepropositie"],"sectie-1":[]}. Geen tekst eromheen.`;
}

export function parseClassify(
  raw: string,
  keys: string[],
): Record<string, string[]> {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const result: Record<string, string[]> = {};
  if (start === -1 || end === -1 || end < start) return result;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return result;
  }
  if (!parsed || typeof parsed !== "object") return result;
  const obj = parsed as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const [k, v] of Object.entries(obj)) {
    if (!allowed.has(k) || !Array.isArray(v)) continue;
    result[k] = filterValidThemes(v.filter((x): x is string => typeof x === "string"));
  }
  return result;
}

export async function classifySections(
  sections: MatchableSection[],
): Promise<Record<string, string[]>> {
  if (sections.length === 0) return {};
  const { markdown } = await analyzeClaudeRaw({
    prompt: buildClassifyPrompt(sections),
  });
  return parseClassify(markdown, sections.map((s) => s.key));
}
