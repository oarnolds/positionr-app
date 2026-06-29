import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// `postgres-js` cliënt voor Vercel serverless:
//  - max: 1 voorkomt dat één invocatie de Supabase session-pool (15-limiet)
//    opvreet. Zonder cap pakt postgres-js default 10 connecties per instance,
//    en bij parallel-routes (RSC + sub-fetches) zit je zo aan 'max clients
//    reached'-fouten.
//  - idle_timeout korter houden zodat connecties snel teruggeven worden.
//  - prepare: false omdat Supabase pooler geen prepared statements ondersteunt.
const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export const db = drizzle(sql, { schema });
