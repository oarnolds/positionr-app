/**
 * Seed-script voor één module's format_example.
 * Voorbeeld: pnpm tsx scripts/seed-format-example.ts website-check
 * Leest modules/<slug>/format-example.md en schrijft naar
 * modules.format_example in de DB.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { modules } from "@/lib/db/schema";

async function main() {
  const slug = process.argv[2];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    console.error("Gebruik: pnpm tsx scripts/seed-format-example.ts <slug>");
    process.exit(1);
  }
  const path = join(process.cwd(), "modules", slug, "format-example.md");
  const markdown = await readFile(path, "utf8");
  const result = await db
    .update(modules)
    .set({ formatExample: markdown })
    .where(eq(modules.slug, slug))
    .returning({ slug: modules.slug });
  if (result.length === 0) {
    console.error(`Geen module-rij gevonden voor slug=${slug}`);
    process.exit(1);
  }
  console.log(`Seeded format_example voor ${slug} (${markdown.length} chars)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
