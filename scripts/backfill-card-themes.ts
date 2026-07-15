/**
 * Eenmalige backfill: geeft bestaande GOEDGEKEURDE kaarten zonder themes een
 * thema-suggestie. Idempotent — kaarten die al themes hebben worden overgeslagen.
 * Draaien: `pnpm exec tsx scripts/backfill-card-themes.ts`
 */
import { config } from "dotenv";

// Env laden vóór alle andere modules: lib/db/client leest DATABASE_URL al bij
// import, dus de rest wordt dynamisch geïmporteerd ná deze config()-call.
config({ path: ".env.local" });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/client");
  const { knowledgeCards } = await import("@/lib/db/schema");
  const { suggestThemes } = await import("@/lib/knowledge/themes");

  const cards = await db
    .select()
    .from(knowledgeCards)
    .where(eq(knowledgeCards.status, "goedgekeurd"));
  const todo = cards.filter((c) => !c.themes || c.themes.length === 0);
  console.log(`${todo.length} goedgekeurde kaarten zonder themes (van ${cards.length}).`);

  let done = 0;
  for (const c of todo) {
    const themes = await suggestThemes({ title: c.title, kern: c.kern, tags: c.tags });
    if (themes.length > 0) {
      await db
        .update(knowledgeCards)
        .set({ themes, updatedAt: new Date() })
        .where(eq(knowledgeCards.id, c.id));
    }
    done++;
    console.log(`[${done}/${todo.length}] ${c.title} → ${themes.join(", ") || "(geen)"}`);
  }
  console.log("Klaar.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
