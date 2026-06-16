import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Leest het statische format-voorbeeld voor een module
 * (`modules/<slug>/format-example.md`). Returnt null als de slug niet
 * matcht aan de toegestane vorm of het bestand ontbreekt.
 *
 * Server-only — gebruikt fs.
 */
export async function getFormatExample(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) return null;
  const path = join(process.cwd(), "modules", slug, "format-example.md");
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
