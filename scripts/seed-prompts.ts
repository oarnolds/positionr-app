/**
 * Seed de `modules.defaultPrompt` + `modules.provider` velden voor alle
 * modules vanuit de FALLBACK_PROMPTS registry + DEFAULT_PROVIDER tabel.
 * Idempotent: schrijft alleen waar defaultPrompt nog leeg is. Bijwerken
 * van provider gebeurt wel altijd (zodat verschuiven van default direct
 * effect heeft).
 *
 * Run: pnpm seed:prompts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { modules } from "../lib/db/schema";
import { FALLBACK_PROMPTS } from "../lib/modules/fallback-prompts";
import type { Provider } from "../lib/ai/pricing";

// Default provider per module — admin kan altijd later wijzigen via de UI.
// Modules met "perplexity" hebben live web-search nodig (markttrends, SEO/SEA,
// concurrentie); de rest werkt op eigen content of vaste kennis met claude.
const DEFAULT_PROVIDER: Record<string, Provider> = {
  // Active
  "website-check": "claude",
  "icp-analyse": "claude",
  "icp-analyse-scan": "claude",
  "icp-analyse-phase1": "claude",
  "icp-analyse-final": "claude",

  // Fundament — soon
  "linkedin-analyse": "perplexity",
  "markttrends-rapport": "perplexity",
  flyercheck: "claude",
  "klantcase-analyse": "claude",
  "propositie-analyse": "claude",

  // Groei — soon
  "website-check-concurrenten": "perplexity",
  "linkedin-concurrentie": "perplexity",
  "markttrends-benefits": "perplexity",
  "features-naar-benefits": "claude",
  "concurrentie-analyse": "perplexity",
  "doelgroep-persona": "claude",
  "propositie-positionering": "claude",

  // Strategie — soon
  marketingstrategie: "perplexity",
  salestriggervragen: "claude",
  "telemarketing-script": "claude",
  kwartaalplan: "claude",
  "seo-quickscan": "perplexity",
  "sea-quickscan": "perplexity",
  "content-kalender": "claude",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing in .env.local");
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(client, { schema: { modules } });

  const slugs = Object.keys(FALLBACK_PROMPTS);
  console.log(`Seeding prompts voor ${slugs.length} modules...\n`);

  for (const slug of slugs) {
    const [existing] = await db
      .select({
        defaultPrompt: modules.defaultPrompt,
        provider: modules.provider,
      })
      .from(modules)
      .where(eq(modules.slug, slug))
      .limit(1);

    if (!existing) {
      console.log(
        `  ⚠ ${slug} bestaat nog niet in modules-tabel — run eerst seed-modules.ts`,
      );
      continue;
    }

    const provider = DEFAULT_PROVIDER[slug] ?? "claude";

    if (existing.defaultPrompt && existing.defaultPrompt.length > 0) {
      // Prompt is al gevuld — niet overschrijven; alleen provider zetten als
      // die nog niet matcht.
      if (existing.provider !== provider) {
        await db
          .update(modules)
          .set({ provider })
          .where(eq(modules.slug, slug));
        console.log(`  ↻ ${slug}: provider ${existing.provider} → ${provider}`);
      } else {
        console.log(`  ✓ ${slug}: al gevuld (skip)`);
      }
    } else {
      await db
        .update(modules)
        .set({ defaultPrompt: FALLBACK_PROMPTS[slug], provider })
        .where(eq(modules.slug, slug));
      console.log(`  ✓ ${slug}: prompt geseed (provider=${provider})`);
    }
  }

  await client.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
