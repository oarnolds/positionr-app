import { z } from "zod";

/**
 * Eén item in de result-view-layout. Discriminated union:
 *  - "section" verwijst naar een vooraf gedefinieerde bouwblok uit de
 *    SECTIONS-registry van de module.
 *  - "block" is een vrij Markdown-blok, door admin geschreven.
 */
export const LayoutItem = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("section"),
    id: z.string(),                  // verwijst naar SECTIONS[i].id
    title: z.string().nullable(),    // null = gebruik default uit registry
    intro: z.string().nullable(),    // optionele inleidende tekst boven de sectie
    visible: z.boolean(),
  }),
  z.object({
    kind: z.literal("block"),
    id: z.string(),                  // uniek (crypto.randomUUID bij aanmaken)
    markdown: z.string(),
  }),
]);
export type LayoutItem = z.infer<typeof LayoutItem>;

export const LayoutConfig = z.object({
  version: z.literal(1),
  items: z.array(LayoutItem),
});
export type LayoutConfig = z.infer<typeof LayoutConfig>;
