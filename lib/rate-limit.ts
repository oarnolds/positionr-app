import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const FREE_CHECK_DAILY_LIMIT = 3;

/** Pure check: is een aantal hits ≥ de limiet? */
export function exceedsLimit(count: number): boolean {
  return count >= FREE_CHECK_DAILY_LIMIT;
}

/**
 * Heeft dit e-mailadres in de laatste 24 uur de gratis-check-limiet bereikt?
 * (Telt rijen uit `leads` ongeacht status — running/completed/failed tellen mee.)
 */
export async function isEmailRateLimited(email: string): Promise<boolean> {
  const rows = await db.execute(
    sql`select count(*)::int as c from leads
        where lower(email) = lower(${email})
          and created_at > now() - interval '24 hours'`,
  );
  const count = Number((rows as Array<{ c: number }>)[0]?.c ?? 0);
  return exceedsLimit(count);
}
