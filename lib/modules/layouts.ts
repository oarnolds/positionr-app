import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";
import { LayoutConfig } from "./layout";
import type { LayoutConfig as LayoutConfigType } from "./layout";
import {
  WEBSITE_CHECK_SECTION_META,
  type SectionMeta,
} from "@/modules/website-check/sections-meta";

/**
 * Per module-slug de section-metadata.
 * Verwijst naar `*-meta.ts` (JSX-vrij) — niet naar de tsx-file met componenten,
 * zodat deze module ook in vitest geladen kan worden zonder React-parser.
 */
const SECTIONS_META_BY_SLUG: Record<string, SectionMeta[]> = {
  "website-check": WEBSITE_CHECK_SECTION_META,
};

/**
 * Bouwt de default-layout voor een module uit zijn SECTIONS-registry:
 * alle secties zichtbaar, in registry-volgorde, zonder titel-overrides.
 */
export function defaultLayoutFor(slug: string): LayoutConfigType {
  const meta = SECTIONS_META_BY_SLUG[slug];
  if (!meta) {
    throw new Error(`Geen SECTIONS-registry voor module ${slug}`);
  }
  return {
    version: 1,
    items: meta.map((s) => ({
      kind: "section" as const,
      id: s.id,
      title: null,
      intro: null,
      visible: true,
    })),
  };
}

/**
 * Haalt de actieve layout-config voor een module op uit de DB.
 * Valt terug op `defaultLayoutFor(slug)` als:
 *  - `modules.layout_config` is NULL (geen admin-config ingesteld)
 *  - DB-waarde is corrupt (Zod safeParse faalt)
 * Gooit een Error als de module niet in de DB staat.
 */
export async function getModuleLayout(slug: string): Promise<LayoutConfigType> {
  const [row] = await db
    .select({ layoutConfig: modules.layoutConfig })
    .from(modules)
    .where(eq(modules.slug, slug))
    .limit(1);

  if (!row) throw new Error(`Module ${slug} niet in DB`);

  if (!row.layoutConfig) {
    return defaultLayoutFor(slug);
  }

  const parsed = LayoutConfig.safeParse(row.layoutConfig);
  if (!parsed.success) {
    console.warn(`[layout] corrupt config voor ${slug} — fallback op default`);
    return defaultLayoutFor(slug);
  }
  return parsed.data;
}
