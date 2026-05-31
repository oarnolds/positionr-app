import { and, count, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";

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
  const [row] = await db
    .select({ c: count() })
    .from(leads)
    .where(
      and(
        sql`lower(${leads.email}) = lower(${email})`,
        gt(leads.createdAt, sql`now() - interval '24 hours'`),
      ),
    );
  return exceedsLimit(row?.c ?? 0);
}
