/**
 * Seed de `modules`-tabel vanuit de statische registry.
 * Run: pnpm tsx scripts/seed-modules.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { modules } from "../lib/db/schema";
import { MODULES } from "../lib/modules/registry";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing in .env.local");
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(client, { schema: { modules } });

  console.log(`Seeding ${MODULES.length} modules...`);

  for (const m of MODULES) {
    await db
      .insert(modules)
      .values({
        slug: m.slug,
        name: m.name,
        description: m.description,
        status: m.status,
        defaultPrompt: "",
      })
      .onConflictDoUpdate({
        target: modules.slug,
        set: {
          name: m.name,
          description: m.description,
          status: m.status,
          updatedAt: sql`now()`,
        },
      });
    console.log(`  ✓ ${m.slug} (${m.status})`);
  }

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
