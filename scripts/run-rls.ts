/**
 * Run RLS-policies uit drizzle/0001_rls.sql.
 * Idempotent — kun je meermaals draaien.
 */
import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing");
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const rlsSql = readFileSync(resolve("drizzle/0001_rls.sql"), "utf-8");
  console.log("Running RLS policies...");
  await sql.unsafe(rlsSql);
  console.log("✓ RLS policies applied");
  await sql.end();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
